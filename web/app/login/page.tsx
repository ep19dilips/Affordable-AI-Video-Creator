"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveSession } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.login(email, password);
      saveSession(data.token, data.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h2>Log in</h2>
      <form onSubmit={handleSubmit} className="card" style={{ marginTop: 20 }}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: "#ff5a3c", fontSize: 13, marginTop: 12 }}>{error}</p>}
        <button className="btn btn-primary" style={{ marginTop: 24, width: "100%" }} disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
