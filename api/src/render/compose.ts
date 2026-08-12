import ffmpeg from "fluent-ffmpeg";
import { writeFileSync } from "fs";

interface Scene {
  id: string;
  duration_seconds: number;
  on_screen_text?: string | null;
  transition?: string;
}

/**
 * MVP composition strategy: build an FFmpeg concat-demuxer input list from
 * per-scene images/video clips (each trimmed/looped to its scene duration),
 * overlay on-screen text via drawtext, concatenate, then mux the voiceover
 * track underneath. Captions are burned in as a separate pass reading the
 * word-timestamp data (kept out of this MVP file for brevity — see
 * burnCaptions.ts for the follow-up implementation).
 *
 * For richer scene transitions, text animation, and chart/diagram rendering,
 * swap this for a Remotion composition (React-based, much easier to iterate
 * on visually) — this file intentionally keeps the FFmpeg path as the
 * fastest path to a working MVP.
 */
export async function composeVideo(params: {
  scenes: Scene[];
  assetPaths: string[];
  audioPath: string;
  outputPath: string;
}): Promise<void> {
  const { scenes, assetPaths, audioPath, outputPath } = params;

  // 1. Build per-scene clips (image -> looped video of scene duration, or trim video assets)
  const sceneClipPaths: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const asset = assetPaths[i];
    const clipPath = `/tmp/clip_${scene.id}.mp4`;

    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg();

      if (asset === "__generated_slide__") {
        // Solid background + centered text for Tier 1 scenes without a media asset
        command = command
          .input(`color=c=0x11141b:s=1920x1080:d=${scene.duration_seconds}`)
          .inputFormat("lavfi");
      } else if (asset.endsWith(".mp4")) {
        command = command.input(asset).duration(scene.duration_seconds).inputOptions(["-stream_loop -1"]);
      } else {
        command = command.input(asset).loop(scene.duration_seconds);
      }

      if (scene.on_screen_text) {
        const escaped = scene.on_screen_text.replace(/:/g, "\\:").replace(/'/g, "\\'");
        command = command.videoFilters(
          `drawtext=text='${escaped}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h-200:box=1:boxcolor=black@0.5:boxborderw=10`
        );
      }

      command
        .outputOptions(["-pix_fmt yuv420p", "-r 30"])
        .size("1920x1080")
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(clipPath);
    });

    sceneClipPaths.push(clipPath);
  }

  // 2. Concat all scene clips
  const concatListPath = "/tmp/concat_list.txt";
  writeFileSync(concatListPath, sceneClipPaths.map((p) => `file '${p}'`).join("\n"));
  const concatenatedPath = "/tmp/concatenated.mp4";

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(concatenatedPath);
  });

  // 3. Mux voiceover audio under the concatenated video, trim to shorter of the two
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatenatedPath)
      .input(audioPath)
      .outputOptions(["-c:v copy", "-c:a aac", "-shortest"])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}
