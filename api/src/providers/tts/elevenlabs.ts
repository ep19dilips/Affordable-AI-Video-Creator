/**
 * ElevenLabs TTS provider — strong Indian-English + Hindi voice support.
 * Returns audio + (approximate) word-level timing for scene sync.
 * Swap for Google Cloud TTS as a cheaper fallback for non-premium production modes.
 */

const COST_PER_1K_CHARS_INR = 15; // illustrative, keep authoritative value in model_pricing

export async function generateVoice(apiKey: string, params: {
  text: string; voiceId: string; speed?: number;
}): Promise<{ audioArrayBuffer: ArrayBuffer; cost: number }> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: "eleven_multilingual_v2", // supports Hindi + other Indian languages
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: params.speed ?? 1.0 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
  const audioArrayBuffer = await res.arrayBuffer();
  const cost = (params.text.length / 1000) * COST_PER_1K_CHARS_INR;
  return { audioArrayBuffer, cost };
}

/**
 * ElevenLabs doesn't return word timestamps on the base TTS endpoint.
 * For MVP, estimate timestamps from character count / average speaking rate.
 * Upgrade path: use their /with-timestamps endpoint for real alignment.
 */
export function estimateWordTimestamps(text: string, totalDurationMs: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const msPerWord = totalDurationMs / words.length;
  return words.map((word, i) => ({
    word,
    startMs: Math.round(i * msPerWord),
    endMs: Math.round((i + 1) * msPerWord),
  }));
}
