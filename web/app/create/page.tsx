"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

const LANGUAGES = ["English", "Hindi"]; // Kannada/Tamil/Telugu/etc. gated behind Phase 2 feature flag
const DURATIONS = [2, 3, 5, 7, 10];
const STYLES = ["Educational", "Professional", "Conversational", "Storytelling", "News/Commentary", "Explainer"];
const VISUAL_STYLES = ["Clean", "Modern", "Corporate", "Minimal", "Dynamic", "Documentary"];

export default function CreateVideoPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("English");
  const [duration, setDuration] = useState(5);
  const [contentStyle, setContentStyle] = useState("Educational");
  const [visualStyle, setVisualStyle] = useState("Clean");
  const [productionMode, setProductionMode] = useState("standard");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshEstimate(nextDuration: number, nextMode: string) {
    try {
      const r = await api.estimateMinutes(nextDuration, nextMode);
      setEstimate(r.estimatedMinutes);
    } catch { /* non-fatal for UI */ }
  }

  async function handleCreate() {
    if (!topic.trim()) { setError("Enter a topic or idea first."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.createVideo({
        topic, language: language === "Hindi" ? "hi" : "en", durationMinutes: duration,
        contentStyle: contentStyle.toLowerCase(), visualStyle: visualStyle.toLowerCase(), productionMode,
      });
      router.push(`/video/${res.videoId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 640, paddingTop: 40, paddingBottom: 80 }}>
      <h2>Create a video</h2>
      <p style={{ color: "#9096a6" }}>Give us an idea. We create the YouTube video.</p>

      <div className="card" style={{ marginTop: 20 }}>
        <label>Topic / idea</label>
        <textarea rows={3} placeholder='e.g. "Explain ACH payments to someone who knows nothing about banking."'
          value={topic} onChange={(e) => setTopic(e.target.value)} />

        <label>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>

        <label>Duration</label>
        <select value={duration} onChange={(e) => { const d = Number(e.target.value); setDuration(d); refreshEstimate(d, productionMode); }}>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
        </select>

        <label>Content style</label>
        <select value={contentStyle} onChange={(e) => setContentStyle(e.target.value)}>
          {STYLES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <label>Visual style</label>
        <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)}>
          {VISUAL_STYLES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <label>Production mode</label>
        <select value={productionMode} onChange={(e) => { setProductionMode(e.target.value); refreshEstimate(duration, e.target.value); }}>
          <option value="standard">Standard (recommended)</option>
          <option value="premium">Premium</option>
          <option value="cinematic">Cinematic</option>
        </select>

        {estimate !== null && (
          <p style={{ color: "#9096a6", fontSize: 13, marginTop: 16 }}>
            Estimated production usage: <strong style={{ color: "#f2f3f7" }}>{estimate} minutes</strong>
          </p>
        )}
        {error && <p style={{ color: "#ff5a3c", fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button className="btn btn-primary" style={{ marginTop: 24, width: "100%" }} onClick={handleCreate} disabled={loading}>
          {loading ? "Starting production..." : "Create Video"}
        </button>
      </div>
    </main>
  );
}
