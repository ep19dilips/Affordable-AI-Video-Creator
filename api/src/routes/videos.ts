import { Router } from "express";
import { randomUUID } from "crypto";
import { query, queryOne } from "../db/pool";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { runVideoPipeline } from "../workflow/pipeline";
import { getRemainingMinutes } from "../costTracking/recordEvent";
import { downloadToFile } from "../render/storage";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const videoRoutes = Router();

const DURATION_MAP: Record<string, number> = { "2": 120, "3": 180, "5": 300, "7": 420, "10": 600 };

function estimateMinutes(durationSec: number, mode: string): number {
  const base = durationSec / 60;
  const multiplier = mode === "cinematic" ? 6 : mode === "premium" ? 2.5 : 1;
  return Math.round(base * 1.6 * multiplier);
}

videoRoutes.use(requireAuth);

videoRoutes.post("/estimate", async (req, res) => {
  const { durationMinutes, productionMode } = req.body;
  const durationSec = DURATION_MAP[String(durationMinutes)];
  if (!durationSec) return res.status(400).json({ error: "Invalid duration" });
  res.json({ estimatedMinutes: estimateMinutes(durationSec, productionMode ?? "standard") });
});

videoRoutes.post("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const body = req.body;
  const durationSec = DURATION_MAP[String(body.durationMinutes)];
  if (!durationSec) return res.status(400).json({ error: "Invalid duration; choose 2/3/5/7/10" });

  const productionMode = body.productionMode ?? "standard";
  const estimated = estimateMinutes(durationSec, productionMode);
  const remaining = await getRemainingMinutes(userId);
  if (remaining < estimated) {
    return res.status(402).json({ error: "Insufficient production balance", remaining, estimated });
  }

  const id = randomUUID();
  await query(
    `INSERT INTO videos (id, user_id, topic, language, duration_target_sec, content_style, visual_style, voice_id, production_mode, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')`,
    [id, userId, body.topic, body.language ?? "en", durationSec, body.contentStyle ?? "educational",
     body.visualStyle ?? "clean", body.voiceId ?? null, productionMode]
  );

  // Fire and forget — client polls GET /videos/:id for status. On Railway this runs
  // in the same long-lived process (unlike Workers' request-scoped waitUntil), so
  // there's no execution-time ceiling to worry about here.
  runVideoPipeline(id).catch((e) => console.error("pipeline failed", e));

  res.json({ videoId: id, status: "draft", estimatedMinutes: estimated });
});

videoRoutes.get("/", async (req: AuthedRequest, res) => {
  const videos = await query(
    "SELECT id, topic, status, duration_target_sec, production_mode, thumbnail_r2_key, created_at FROM videos WHERE user_id = $1 ORDER BY created_at DESC",
    [req.userId]
  );
  res.json({ videos });
});

videoRoutes.get("/:id", async (req: AuthedRequest, res) => {
  const video = await queryOne("SELECT * FROM videos WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  if (!video) return res.status(404).json({ error: "Not found" });

  const scenes = await query("SELECT * FROM storyboard_scenes WHERE video_id = $1 ORDER BY scene_number", [req.params.id]);
  const script = await queryOne("SELECT * FROM scripts WHERE video_id = $1 ORDER BY version DESC LIMIT 1", [req.params.id]);
  const pack = await queryOne("SELECT * FROM youtube_pack WHERE video_id = $1", [req.params.id]);

  res.json({ video, scenes, script, youtubePack: pack });
});

videoRoutes.post("/:id/approve", async (req: AuthedRequest, res) => {
  await query("UPDATE videos SET status = 'completed' WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ ok: true });
});

videoRoutes.get("/:id/download", async (req: AuthedRequest, res) => {
  const video = await queryOne<{ final_video_r2_key: string }>(
    "SELECT final_video_r2_key FROM videos WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]
  );
  if (!video?.final_video_r2_key) return res.status(404).json({ error: "Not ready" });

  const s3 = new S3Client({
    region: "auto", endpoint: process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: video.final_video_r2_key }));
  res.setHeader("Content-Type", "video/mp4");
  (obj.Body as any).pipe(res);
});
