/**
 * OpenAI LLM provider — implements script, storyboard, YouTube pack generation.
 * Swap OPENAI_API_KEY for ANTHROPIC_API_KEY + this file's anthropic.ts sibling
 * to use Claude instead; the ProviderRouter fallback chain can use both.
 */

interface ChatResult { text: string; inputTokens: number; outputTokens: number; }

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string, jsonMode = false): Promise<ChatResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // cost-efficient default; upgrade per production_mode in the router
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: jsonMode ? { type: "json_object" } : undefined,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  return {
    text: data.choices[0].message.content,
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
  };
}

// gpt-4o-mini approx pricing (INR, illustrative — keep real values in model_pricing table, not here)
const COST_PER_1K_INPUT_INR = 0.013;
const COST_PER_1K_OUTPUT_INR = 0.05;

function costFor(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1000) * COST_PER_1K_INPUT_INR + (outputTokens / 1000) * COST_PER_1K_OUTPUT_INR;
}

export async function generateScript(apiKey: string, params: {
  topic: string; targetAudience: string; keyConcepts: string[]; research: { factSummary: string; sourceTitle: string }[];
  durationSec: number; style: string; language: string;
}) {
  const wordTarget = Math.round((params.durationSec / 60) * 140); // ~140 wpm average narration pace
  const researchBlock = params.research.map((r) => `- ${r.factSummary} (source: ${r.sourceTitle})`).join("\n");

  const system = `You are an expert YouTube scriptwriter specializing in ${params.style} explainer videos for Indian audiences. Write natural, retention-optimized narration — never generic or robotic-sounding AI text. Structure: Hook, Introduction, Main sections with concrete examples, Transitions, Conclusion, Call-to-action.`;
  const user = `Topic: ${params.topic}
Target audience: ${params.targetAudience}
Key concepts to cover: ${params.keyConcepts.join(", ")}
Language: ${params.language}
Target length: approximately ${wordTarget} words (this video is ${params.durationSec / 60} minutes long)

Research to ground the script in facts (cite naturally, don't fabricate anything beyond this):
${researchBlock}

Write the full narration script now. Use clear section labels (HOOK:, INTRO:, MAIN:, CONCLUSION:, CTA:).`;

  const result = await callOpenAI(apiKey, system, user);
  return { script: result.text, cost: costFor(result.inputTokens, result.outputTokens) };
}

export async function generateStoryboard(apiKey: string, params: { script: string; durationSec: number }) {
  const system = `You are a YouTube video storyboard planner. Break narration into scenes of 5-12 seconds each. For each scene, decide the CHEAPEST visual treatment that still communicates the idea well — prefer chart/diagram/animated_text/stock footage over AI-generated video. Only use ai_video for scenes that explicitly require human action or motion that nothing else can convey. Respond with ONLY a JSON array, no prose.`;
  const user = `Script:
${params.script}

Return a JSON array where each item has exactly these fields:
scene_number (int), duration_seconds (int), narration (string, the portion of script for this scene),
visual_type (one of: ai_video, ai_image, stock_video, stock_image, chart, diagram, screenshot, animated_text, motion_graphic, map, icon_animation),
visual_prompt (string, description for generating/searching that visual),
on_screen_text (string or null), transition (string, e.g. "cut", "fade"), music_cue (string), sfx_cue (string or null).
Total duration_seconds across all scenes should sum to approximately ${params.durationSec}.`;

  const result = await callOpenAI(apiKey, system, user, true);
  let scenes;
  try {
    const parsed = JSON.parse(result.text);
    scenes = Array.isArray(parsed) ? parsed : parsed.scenes ?? Object.values(parsed)[0];
  } catch {
    throw new Error("Storyboard LLM did not return valid JSON");
  }
  return { scenes, cost: costFor(result.inputTokens, result.outputTokens) };
}

export async function generateYouTubePack(apiKey: string, params: { script: string; topic: string }) {
  const system = `You are a YouTube SEO and content strategist. Generate publish-ready metadata. Respond with ONLY JSON, no prose.`;
  const user = `Video topic: ${params.topic}
Script:
${params.script}

Return JSON with fields: titles (array of 5 strings), description (string), chapters (array of {time, label} — estimate reasonable timestamps), tags (array of ~15 strings), hashtags (array of ~5 strings), pinned_comment (string), community_post (string), shorts_clips (array of {start_sec, end_sec, reason} — identify 2-4 short-form-worthy moments).`;

  const result = await callOpenAI(apiKey, system, user, true);
  const pack = JSON.parse(result.text);
  return { pack, cost: costFor(result.inputTokens, result.outputTokens) };
}

export async function classifyVisualTier(apiKey: string, sceneNarration: string) {
  const system = `Classify the cheapest adequate visual tier for a YouTube scene. Tiers: 1=chart/diagram/animated_text (free, no motion needed, data or process), 2=stock footage (generic scene, no specific action), 3=AI-generated static image (conceptual/abstract), 4=AI-generated video (requires actual human motion/action), 5=cinematic AI video (only for hero/hook moments in premium content). Bias toward the lowest adequate tier. Respond with ONLY JSON: {"tier": number, "visual_type": string}`;
  const result = await callOpenAI(apiKey, system, sceneNarration, true);
  const parsed = JSON.parse(result.text);
  return { tier: parsed.tier, visualType: parsed.visual_type, cost: costFor(result.inputTokens, result.outputTokens) };
}
