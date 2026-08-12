import { randomUUID } from "crypto";
import { query } from "../db/pool";

const TARGET_COST_PER_MIN_INR: Record<string, number> = {
  standard: 30,
  premium: 85,
  cinematic: 215,
};

export async function recordGenerationEvent(params: {
  userId: string;
  videoId: string;
  sceneId?: string | null;
  providerId: string;
  modelName: string;
  inputUnits: number;
  outputUnits: number;
  actualCostInr: number;
  generationTimeMs: number;
  retryCount: number;
  productionMode: "standard" | "premium" | "cinematic";
  qualityScore?: number;
}): Promise<number> {
  const minutesConsumed = params.actualCostInr / TARGET_COST_PER_MIN_INR[params.productionMode];

  await query(
    `INSERT INTO generation_events
     (id, user_id, video_id, scene_id, provider_id, model_name, input_units, output_units,
      actual_cost_inr, production_minutes_consumed, generation_time_ms, retry_count, quality_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [randomUUID(), params.userId, params.videoId, params.sceneId ?? null, params.providerId, params.modelName,
     params.inputUnits, params.outputUnits, params.actualCostInr, minutesConsumed, params.generationTimeMs,
     params.retryCount, params.qualityScore ?? null]
  );

  await query(`UPDATE videos SET production_minutes_consumed = production_minutes_consumed + $1 WHERE id = $2`,
    [minutesConsumed, params.videoId]);

  await query(
    `UPDATE subscriptions SET minutes_used = minutes_used + $1
     WHERE id = (SELECT id FROM subscriptions WHERE user_id = $2 AND status IN ('active','trial')
                 ORDER BY current_period_end DESC LIMIT 1)`,
    [minutesConsumed, params.userId]
  );

  return minutesConsumed;
}

export async function getRemainingMinutes(userId: string): Promise<number> {
  const rows = await query<{ minutes_total: number; minutes_used: number; rolled_over_minutes: number }>(
    `SELECT minutes_total, minutes_used, rolled_over_minutes FROM subscriptions
     WHERE user_id = $1 AND status IN ('active','trial') ORDER BY current_period_end DESC LIMIT 1`,
    [userId]
  );
  if (!rows[0]) return 0;
  return rows[0].minutes_total + (rows[0].rolled_over_minutes ?? 0) - rows[0].minutes_used;
}
