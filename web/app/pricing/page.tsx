import Link from "next/link";

const PLANS = [
  { name: "Starter", price: "4,999", minutes: 30, popular: false },
  { name: "Creator", price: "9,999", minutes: 100, popular: true },
  { name: "Pro", price: "19,999", minutes: 300, popular: false },
  { name: "Studio", price: "39,999", minutes: 600, popular: false },
  { name: "Agency", price: "99,999", minutes: 1500, popular: false },
];

export default function PricingPage() {
  return (
    <main className="container" style={{ paddingTop: 60, paddingBottom: 80 }}>
      <h1>Simple, India-first pricing</h1>
      <p style={{ color: "#9096a6" }}>Annual plans. No AI credits or token math — just production minutes.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 32 }}>
        {PLANS.map((p) => (
          <div key={p.name} className="card" style={{ position: "relative", borderColor: p.popular ? "#ff5a3c" : undefined }}>
            {p.popular && <div style={{ position: "absolute", top: -10, right: 16, background: "#ff5a3c", fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>MOST POPULAR</div>}
            <h3>{p.name}</h3>
            <div style={{ fontSize: 28, fontWeight: 700 }}>₹{p.price}<span style={{ fontSize: 14, color: "#9096a6" }}>/year</span></div>
            <p style={{ color: "#9096a6", fontSize: 14 }}>{p.minutes} production minutes</p>
            <Link href="/signup" className="btn btn-primary" style={{ width: "100%", textAlign: "center", marginTop: 16 }}>Choose {p.name}</Link>
          </div>
        ))}
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, marginTop: 32 }}>
        Try it first with a ₹499 trial (5 production minutes) — creditable toward any annual plan.
        50% of unused production minutes roll over on renewal.
      </p>
    </main>
  );
}
