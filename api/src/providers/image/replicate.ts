/**
 * Replicate provider — used for Tier 3 (AI image, SDXL) and Tier 4 (basic AI video).
 * Replicate's async prediction API: create a prediction, poll until succeeded.
 * Cheapest reliable way to access open-weight image/video models without
 * managing GPU infra yourself — important for the ₹25-35/min Standard economics target.
 */

const REPLICATE_API = "https://api.replicate.com/v1";

// Illustrative INR costs — keep authoritative values in the model_pricing table
const SDXL_COST_PER_IMAGE_INR = 2.5;
const VIDEO_MODEL_COST_PER_SEC_INR = 25;

async function pollPrediction(apiToken: string, predictionId: string, timeoutMs = 120_000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const data = await res.json() as Promise<any>;
    if (data.status === "succeeded") return data;
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`Replicate prediction ${data.status}: ${data.error ?? "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Replicate prediction timed out");
}

export async function generateImage(apiToken: string, params: {
  prompt: string; aspectRatio: "16:9" | "9:16" | "1:1";
}): Promise<{ imageUrl: string; cost: number }> {
  const dims = params.aspectRatio === "16:9" ? { width: 1344, height: 768 }
    : params.aspectRatio === "9:16" ? { width: 768, height: 1344 }
    : { width: 1024, height: 1024 };

  const createRes = await fetch(`${REPLICATE_API}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Prefer: "wait", // Replicate will hold the connection until done, for models that support it
    },
    body: JSON.stringify({
      // Stability AI SDXL on Replicate — swap version hash as needed
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08",
      input: { prompt: params.prompt, width: dims.width, height: dims.height, num_outputs: 1 },
    }),
  });
  if (!createRes.ok) throw new Error(`Replicate create prediction failed: ${await createRes.text()}`);
  let prediction = await createRes.json() as Promise<any>;
  if (prediction.status !== "succeeded") {
    prediction = await pollPrediction(apiToken, prediction.id);
  }
  const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  return { imageUrl, cost: SDXL_COST_PER_IMAGE_INR };
}

export async function generateVideo(apiToken: string, params: {
  prompt: string; durationSeconds: number;
}): Promise<{ videoUrl: string; cost: number }> {
  const createRes = await fetch(`${REPLICATE_API}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Placeholder for a cost-efficient open video model on Replicate
      // (e.g. a Stable Video Diffusion / AnimateDiff variant) — pick based on
      // current pricing/quality when you wire this up for real.
      version: "REPLACE_WITH_CHOSEN_VIDEO_MODEL_VERSION_HASH",
      input: { prompt: params.prompt, num_frames: params.durationSeconds * 24 },
    }),
  });
  if (!createRes.ok) throw new Error(`Replicate video prediction failed: ${await createRes.text()}`);
  const created = await createRes.json() as Promise<any>;
  const prediction = await pollPrediction(apiToken, created.id, 300_000);
  const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  return { videoUrl, cost: VIDEO_MODEL_COST_PER_SEC_INR * params.durationSeconds };
}
