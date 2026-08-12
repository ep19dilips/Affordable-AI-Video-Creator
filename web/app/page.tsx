import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <div className="container" style={{ padding: "80px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 80 }}>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Idea2Video</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/pricing" style={{ color: "#9096a6" }}>Pricing</Link>
            <Link href="/login" style={{ color: "#9096a6" }}>Log in</Link>
            <Link href="/signup" className="btn btn-primary">Get started</Link>
          </div>
        </div>

        <div style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 52, lineHeight: 1.1, marginBottom: 20 }}>
            One idea.<br />One video.<br /><span style={{ color: "#ff5a3c" }}>Ready for YouTube.</span>
          </h1>
          <p style={{ fontSize: 18, color: "#9096a6", marginBottom: 32 }}>
            An affordable AI-powered YouTube production platform, built for Indian creators.
            Research, script, storyboard, visuals, voiceover, captions, thumbnail, and full
            YouTube metadata — from one idea, automatically.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/signup" className="btn btn-primary">Create your first video — free trial</Link>
            <Link href="/pricing" className="btn btn-secondary">See pricing</Link>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 12 }}>
            Starts at ₹4,999/year · No editing skills required
          </p>
        </div>

        <div style={{ marginTop: 100, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          <div className="card">
            <h3>India-first pricing</h3>
            <p style={{ color: "#9096a6", fontSize: 14 }}>
              Entry plans from ₹4,999/year — a fraction of comparable AI video-production platforms.
            </p>
          </div>
          <div className="card">
            <h3>Built for YouTube, not filmmaking</h3>
            <p style={{ color: "#9096a6", fontSize: 14 }}>
              Optimized end-to-end for retention, chapters, Shorts, and publish-ready metadata.
            </p>
          </div>
          <div className="card">
            <h3>Cost-smart visuals</h3>
            <p style={{ color: "#9096a6", fontSize: 14 }}>
              We only use expensive AI video generation when a scene actually needs it — charts,
              stock footage and AI images cover most scenes at a fraction of the cost.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
