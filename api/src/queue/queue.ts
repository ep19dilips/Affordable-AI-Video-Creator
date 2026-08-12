import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export interface RenderJobData {
  videoId: string;
  audioR2Key: string;
  durationTargetSec: number;
}

/**
 * A single Redis-backed queue instead of Cloudflare Queues' HTTP-pull consumer
 * workaround — this is the concrete simplification that comes from moving off
 * Workers: the API server enqueues, the worker process (same codebase, same
 * Postgres connection) dequeues and runs FFmpeg directly. Built-in retries,
 * backoff, and dead-letter handling come from BullMQ, not custom polling code.
 */
export const renderQueue = new Queue<RenderJobData>("render-jobs", { connection });
