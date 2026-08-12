/**
 * Two providers in one file for MVP simplicity:
 * 1. Pexels — free stock video/image (Visual Router Tier 2)
 * 2. Serper (Google Search API wrapper) — Research Agent
 */

export async function searchStockVideo(apiKey: string, query: string): Promise<{ videoUrl: string | null; cost: number }> {
  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) throw new Error(`Pexels video search failed: ${res.status}`);
  const data = await res.json() as any;
  const video = data.videos?.[0];
  const file = video?.video_files?.find((f: any) => f.quality === "hd") ?? video?.video_files?.[0];
  return { videoUrl: file?.link ?? null, cost: 0 };
}

export async function searchStockImage(apiKey: string, query: string): Promise<{ imageUrl: string | null; cost: number }> {
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) throw new Error(`Pexels image search failed: ${res.status}`);
  const data = await res.json() as any;
  return { imageUrl: data.photos?.[0]?.src?.large ?? null, cost: 0 };
}

const SEARCH_COST_PER_QUERY_INR = 0.5;

export async function webSearch(apiKey: string, query: string): Promise<{
  results: { title: string; url: string; snippet: string }[]; cost: number;
}> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query }),
  });
  if (!res.ok) throw new Error(`Serper search failed: ${res.status}`);
  const data = await res.json() as any;
  const results = (data.organic ?? []).slice(0, 5).map((r: any) => ({
    title: r.title, url: r.link, snippet: r.snippet ?? "",
  }));
  return { results, cost: SEARCH_COST_PER_QUERY_INR };
}
