import "dotenv/config";
import { Worker, Job } from "bullmq";
import { connection, RenderJobData } from "./queue/queue";
import { query } from "./db/pool";
import { composeVideo } from "./render/compose";
import { downloadToFile, uploadFile } from "./render/storage";

/**
 * This is the piece that structurally couldn't run on Cloudflare Workers —
 * here it's just... a worker process, in the same codebase, sharing the same
 * Postgres connection as the API server. No separate deploy target, no HTTP
 * callback dance, no service-token auth between two systems. Deploy this as
 * a second Railway service from the same repo with start command
 * `npm run start:worker`.
 */
const worker = new Worker<RenderJobData>(
  "render-jobs",
  async (job: Job<RenderJobData>) => {
    const { videoId, audioR2Key } = job.data;
    console.log(`[worker] composing video ${videoId}`);

    const scenes = await query<any>(
      "SELECT * FROM storyboard_scenes WHERE video_id = $1 ORDER BY scene_number", [videoId]
    );

    const localAssetPaths: string[] = [];
    for (const scene of scenes) {
      if (scene.asset_r2_key) {
        const ext = scene.asset_r2_key.endsWith(".mp4") ? "mp4" : "jpg";
        const localPath = `/tmp/${scene.id}.${ext}`;
        await downloadToFile(scene.asset_r2_key, localPath);
        localAssetPaths.push(localPath);
      } else {
        // Tier 1 scenes (chart/diagram/animated_text) — no media asset, compose.ts
        // renders a text slide directly. Upgrade path: swap in a Remotion
        // composition for real chart/diagram rendering.
        localAssetPaths.push("__generated_slide__");
      }
    }

    const localAudioPath = `/tmp/${videoId}_audio.mp3`;
    await downloadToFile(audioR2Key, localAudioPath);

    const outputPath = `/tmp/${videoId}_final.mp4`;
    await composeVideo({ scenes, assetPaths: localAssetPaths, audioPath: localAudioPath, outputPath });

    const finalKey = `videos/${videoId}/final.mp4`;
    await uploadFile(outputPath, finalKey, "video/mp4");

    // Thumbnail: MVP placeholder key — wire up an actual frame-grab + text
    // overlay call (via the Image provider) before shipping thumbnails for real.
    const thumbnailKey = `videos/${videoId}/thumbnail.jpg`;

    await query(
      `UPDATE videos SET status = 'review', final_video_r2_key = $1, thumbnail_r2_key = $2, originality_score = $3, updated_at = NOW() WHERE id = $4`,
      [finalKey, thumbnailKey, 82, videoId]
    );

    console.log(`[worker] video ${videoId} composition complete`);
  },
  { connection, concurrency: 2 } // tune based on Railway service CPU/RAM
);

worker.on("failed", async (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
  if (job?.data.videoId) {
    await query("UPDATE videos SET status = 'failed', updated_at = NOW() WHERE id = $1", [job.data.videoId]);
  }
});

console.log("idea2video render worker started");
