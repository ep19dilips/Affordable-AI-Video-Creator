"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getUser, logout } from "../../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!user) { router.push("/login"); return; }
    api.listVideos().then((d) => setVideos(d.videos)).finally(() => setLoading(false));
  }, [router]);

  const STATUS_LABELS: Record<string, string> = {
    draft: "Draft", researching: "Researching", scripting: "Writing script",
    storyboarding: "Storyboarding", generating_visuals: "Generating visuals",
    generating_voice: "Generating voice", composing: "Composing video",
    review: "Ready for review", completed: "Completed", failed: "Failed",
  };

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0 }}>Your channel</h2>
          <p style={{ color: "#9096a6", margin: "4px 0 0" }}>{getUser()?.email}</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/create" className="btn btn-primary">+ Create Video</Link>
          <button className="btn btn-secondary" onClick={() => { logout(); router.push("/"); }}>Log out</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#9096a6" }}>Loading...</p>
      ) : videos.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <p style={{ color: "#9096a6" }}>No videos yet. Turn your first idea into a video.</p>
          <Link href="/create" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
            Create Video
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {videos.map((v) => (
            <Link key={v.id} href={`/video/${v.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{v.topic}</div>
                <div style={{ color: "#9096a6", fontSize: 13, marginTop: 4 }}>
                  {Math.round(v.duration_target_sec / 60)} min · {v.production_mode} · {new Date(v.created_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{
                fontSize: 13, padding: "4px 12px", borderRadius: 20,
                background: v.status === "completed" ? "#134e2f" : v.status === "failed" ? "#4e1313" : "#232733",
                color: v.status === "completed" ? "#6ee7b7" : v.status === "failed" ? "#ff5a3c" : "#9096a6",
              }}>
                {STATUS_LABELS[v.status] ?? v.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
