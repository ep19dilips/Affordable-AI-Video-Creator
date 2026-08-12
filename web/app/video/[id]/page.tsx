"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";

const STAGES = [
  { key: "researching", label: "Research" },
  { key: "scripting", label: "Script" },
  { key: "storyboarding", label: "Storyboard" },
  { key: "generating_visuals", label: "Visuals" },
  { key: "generating_voice", label: "Voice" },
  { key: "composing", label: "Editing" },
  { key: "review", label: "Review" },
  { key: "completed", label: "YouTube Pack" },
];

export default function VideoDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let interval: any;
    async function poll() {
      try {
        const d = await api.getVideo(id);
        setData(d);
        if (["completed", "failed"].includes(d.video.status)) clearInterval(interval);
      } catch (e) { console.error(e); }
    }
    poll();
    interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (!data) return <main className="container" style={{ paddingTop: 40 }}>Loading...</main>;

  const { video, scenes, script, youtubePack } = data;
  const currentStageIndex = STAGES.findIndex((s) => s.key === video.status);

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 800 }}>
      <h2>{video.topic}</h2>
      <p style={{ color: "#9096a6" }}>
        {Math.round(video.duration_target_sec / 60)} min · {video.production_mode} ·{" "}
        {video.production_minutes_consumed?.toFixed(1)} minutes used
      </p>

      {video.status === "failed" ? (
        <div className="card" style={{ borderColor: "#ff5a3c" }}>
          <p style={{ color: "#ff5a3c" }}>Generation failed. We're sorry — this doesn't consume your full production balance for incomplete stages. Try again or contact support.</p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {STAGES.map((stage, i) => (
              <div key={stage.key} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", margin: "0 auto 8px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                  background: i < currentStageIndex ? "#134e2f" : i === currentStageIndex ? "#ff5a3c" : "#232733",
                  color: i <= currentStageIndex ? "#fff" : "#6b7280",
                }}>
                  {i < currentStageIndex ? "✓" : i + 1}
                </div>
                <div style={{ fontSize: 11, color: "#9096a6" }}>{stage.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {script && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h4>Script</h4>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, color: "#c9cdd6" }}>{script.content}</pre>
        </div>
      )}

      {scenes?.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h4>Storyboard ({scenes.length} scenes)</h4>
          {scenes.map((s: any) => (
            <div key={s.id} style={{ padding: "10px 0", borderBottom: "1px solid #232733" }}>
              <div style={{ fontSize: 13, color: "#9096a6" }}>Scene {s.scene_number} · {s.duration_seconds}s · {s.visual_type}</div>
              <div style={{ fontSize: 14 }}>{s.narration}</div>
            </div>
          ))}
        </div>
      )}

      {youtubePack && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h4>YouTube Pack</h4>
          <div style={{ fontSize: 13, color: "#9096a6" }}>Title options</div>
          <ul>{JSON.parse(youtubePack.titles).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
          <div style={{ fontSize: 13, color: "#9096a6", marginTop: 12 }}>Description</div>
          <p style={{ fontSize: 14 }}>{youtubePack.description}</p>
        </div>
      )}

      {video.status === "review" && (
        <button className="btn btn-primary" onClick={async () => { await api.approveVideo(id); location.reload(); }}>
          Approve & Complete
        </button>
      )}

      {video.status === "completed" && (
        <a className="btn btn-primary" href={`${process.env.NEXT_PUBLIC_API_URL}/videos/${id}/download`}>
          Download 1080p MP4
        </a>
      )}
    </main>
  );
}
