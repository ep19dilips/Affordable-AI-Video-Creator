"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveSession } from "../../lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.signup(email, password, fullName);
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
      <h2>Create your account</h2>
      <p style={{ color: "#9096a6", fontSize: 14 }}>Includes a free trial with 5 production minutes.</p>
      <form onSubmit={handleSubmit} className="card" style={{ marginTop: 20 }}>
        <label>Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <p style={{ color: "#ff5a3c", fontSize: 13, marginTop: 12 }}>{error}</p>}
        <button className="btn btn-primary" style={{ marginTop: 24, width: "100%" }} disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  );
}
