import { randomUUID } from "crypto";
import { query, queryOne } from "../db/pool";
import { webSearch, searchStockVideo, searchStockImage } from "../providers/search/pexels_and_search";
import { generateScript, generateStoryboard, generateYouTubePack } from "../providers/llm/openai";
import { generateImage as replicateImage, generateVideo as replicateVideo } from "../providers/image/replicate";
import { generateVoice } from "../providers/tts/elevenlabs";
import { recordGenerationEvent, getRemainingMinutes } from "../costTracking/recordEvent";
import { uploadFromUrl, uploadBuffer } from "../render/storage";
import { renderQueue } from "../queue/queue";

/**
 * Runs research -> script -> storyboard -> visual generation -> voice, then
 * hands composition off to the render queue (consumed by worker.ts). Running
 * this inline in the API process is fine at MVP volume since each stage here
 * is fast (LLM/API calls); only composition (the genuinely slow, CPU-heavy
 * step) goes through the queue.
 */
export async function runVideoPipeline(videoId: string) {
  const video = await queryOne<any>("SELECT * FROM videos WHERE id = $1", [videoId]);
  if (!video) throw new Error("Video not found");

  const remaining = await getRemainingMinutes(video.user_id);
  if (remaining <= 0) {
    await setStatus(videoId, "failed");
    throw new Error("Insufficient production balance");
  }

  try {
    await setStatus(videoId, "researching");
    const keyConcepts: string[] = video.topic.split(/\s+/).slice(0, 6);

    const t0 = Date.now();
    const { results, cost: searchCost } = await webSearch(process.env.SERPER_API_KEY!, video.topic);
    await recordGenerationEvent({
      userId: video.user_id, videoId, providerId: "serper", modelName: "search",
      inputUnits: 1, outputUnits: results.length, actualCostInr: searchCost,
      generationTimeMs: Date.now() - t0, retryCount: 0, productionMode: video.production_mode,
    });
    for (const r of results) {
      await query(
        `INSERT INTO research_items (id, video_id, source_url, source_title, fact_summary, confidence) VALUES ($1,$2,$3,$4,$5,'medium')`,
        [randomUUID(), videoId, r.url, r.title, r.snippet]
      );
    }

    await setStatus(videoId, "scripting");
    const t1 = Date.now();
    const scriptResult = await generateScript(process.env.OPENAI_API_KEY!, {
      topic: video.topic, targetAudience: "Indian YouTube viewers new to the topic", keyConcepts,
      research: results.map((r) => ({ factSummary: r.snippet, sourceTitle: r.title })),
      durationSec: video.duration_target_sec, style: video.content_style ?? "educational", language: video.language,
    });
    await recordGenerationEvent({
      userId: video.user_id, videoId, providerId: "openai", modelName: "gpt-4o-mini",
      inputUnits: 0, outputUnits: 0, actualCostInr: scriptResult.cost,
      generationTimeMs: Date.now() - t1, retryCount: 0, productionMode: video.production_mode,
    });
    await query(
      `INSERT INTO scripts (id, video_id, version, content, word_count) VALUES ($1,$2,1,$3,$4)`,
      [randomUUID(), videoId, scriptResult.script, scriptResult.script.split(/\s+/).length]
    );

    await setStatus(videoId, "storyboarding");
    const t2 = Date.now();
    const storyboardResult = await generateStoryboard(process.env.OPENAI_API_KEY!, {
      script: scriptResult.script, durationSec: video.duration_target_sec,
    });
    await recordGenerationEvent({
      userId: video.user_id, videoId, providerId: "openai", modelName: "gpt-4o-mini",
      inputUnits: 0, outputUnits: 0, actualCostInr: storyboardResult.cost,
      generationTimeMs: Date.now() - t2, retryCount: 0, productionMode: video.production_mode,
    });

    for (const scene of storyboardResult.scenes as any[]) {
      await query(
        `INSERT INTO storyboard_scenes
         (id, video_id, scene_number, duration_seconds, narration, visual_type, visual_prompt,
          on_screen_text, transition, music_cue, sfx_cue, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,
        [randomUUID(), videoId, scene.scene_number, scene.duration_seconds, scene.narration,
         scene.visual_type, scene.visual_prompt, scene.on_screen_text ?? null,
         scene.transition ?? "cut", scene.music_cue ?? null, scene.sfx_cue ?? null]
      );
    }

    await setStatus(videoId, "generating_visuals");
    const scenes = await query<any>("SELECT * FROM storyboard_scenes WHERE video_id = $1 ORDER BY scene_number", [videoId]);

    for (const scene of scenes) {
      const t3 = Date.now();
      let assetUrl: string | null = null;
      let providerId = "";
      let cost = 0;
      let visualType = scene.visual_type;

      switch (scene.visual_type) {
        case "stock_video": {
          const r = await searchStockVideo(process.env.PEXELS_API_KEY!, scene.visual_prompt);
          assetUrl = r.videoUrl; cost = r.cost; providerId = "pexels"; break;
        }
        case "stock_image": {
          const r = await searchStockImage(process.env.PEXELS_API_KEY!, scene.visual_prompt);
          assetUrl = r.imageUrl; cost = r.cost; providerId = "pexels"; break;
        }
        case "ai_image": {
          const r = await replicateImage(process.env.REPLICATE_API_TOKEN!, { prompt: scene.visual_prompt, aspectRatio: "16:9" });
          assetUrl = r.imageUrl; cost = r.cost; providerId = "replicate"; break;
        }
        case "ai_video": {
          if (video.production_mode === "standard") {
            // Auto-downgrade to protect Standard-tier cost economics (spec Principle 4)
            const r = await replicateImage(process.env.REPLICATE_API_TOKEN!, { prompt: scene.visual_prompt, aspectRatio: "16:9" });
            assetUrl = r.imageUrl; cost = r.cost; providerId = "replicate"; visualType = "ai_image";
          } else {
            const r = await replicateVideo(process.env.REPLICATE_API_TOKEN!, { prompt: scene.visual_prompt, durationSeconds: scene.duration_seconds });
            assetUrl = r.videoUrl; cost = r.cost; providerId = "replicate";
          }
          break;
        }
        default:
          // Tier 1: chart/diagram/animated_text/motion_graphic/icon_animation — rendered
          // locally by FFmpeg in the composition step, no external API call, ₹0.
          assetUrl = null; cost = 0; providerId = "local-render";
      }

      let assetKey: string | null = null;
      if (assetUrl) {
        assetKey = `videos/${videoId}/scenes/${scene.id}.${visualType.includes("video") ? "mp4" : "jpg"}`;
        await uploadFromUrl(assetUrl, assetKey, visualType.includes("video") ? "video/mp4" : "image/jpeg");
      }

      await query(
        `UPDATE storyboard_scenes SET visual_type = $1, asset_r2_key = $2, status = 'done' WHERE id = $3`,
        [visualType, assetKey, scene.id]
      );

      if (cost > 0) {
        await recordGenerationEvent({
          userId: video.user_id, videoId, sceneId: scene.id, providerId, modelName: visualType,
          inputUnits: 1, outputUnits: 1, actualCostInr: cost,
          generationTimeMs: Date.now() - t3, retryCount: 0, productionMode: video.production_mode,
        });
      }
    }

    await setStatus(videoId, "generating_voice");
    const t4 = Date.now();
    const voiceResult = await generateVoice(process.env.ELEVENLABS_API_KEY!, {
      text: scriptResult.script, voiceId: video.voice_id ?? "21m00Tcm4TlvDq8ikWAM",
    });
    const audioKey = `videos/${videoId}/voiceover.mp3`;
    await uploadBuffer(audioKey, voiceResult.audioArrayBuffer, "audio/mpeg");
    await recordGenerationEvent({
      userId: video.user_id, videoId, providerId: "elevenlabs", modelName: "eleven_multilingual_v2",
      inputUnits: scriptResult.script.length, outputUnits: 0, actualCostInr: voiceResult.cost,
      generationTimeMs: Date.now() - t4, retryCount: 0, productionMode: video.production_mode,
    });

    await setStatus(videoId, "composing");
    await renderQueue.add("compose", {
      videoId, audioR2Key: audioKey, durationTargetSec: video.duration_target_sec,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
    });
    // worker.ts picks this up, runs FFmpeg, updates the video row directly (same DB) when done.

    const t5 = Date.now();
    const packResult = await generateYouTubePack(process.env.OPENAI_API_KEY!, { script: scriptResult.script, topic: video.topic });
    await recordGenerationEvent({
      userId: video.user_id, videoId, providerId: "openai", modelName: "gpt-4o-mini",
      inputUnits: 0, outputUnits: 0, actualCostInr: packResult.cost,
      generationTimeMs: Date.now() - t5, retryCount: 0, productionMode: video.production_mode,
    });
    const p: any = packResult.pack;
    await query(
      `INSERT INTO youtube_pack (video_id, titles, description, chapters, tags, hashtags, pinned_comment, community_post, shorts_clips)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [videoId, JSON.stringify(p.titles), p.description, JSON.stringify(p.chapters),
       JSON.stringify(p.tags), JSON.stringify(p.hashtags), p.pinned_comment, p.community_post, JSON.stringify(p.shorts_clips)]
    );
  } catch (err) {
    console.error("Pipeline error", err);
    await setStatus(videoId, "failed");
    throw err;
  }
}

async function setStatus(videoId: string, status: string) {
  await query("UPDATE videos SET status = $1, updated_at = NOW() WHERE id = $2", [status, videoId]);
}
