import { Router } from "express";
import { randomUUID } from "crypto";
import { query, queryOne } from "../db/pool";
import { hashPassword, verifyPassword, signToken } from "../middleware/auth";

export const authRoutes = Router();

authRoutes.post("/signup", async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const id = randomUUID();
  const passwordHash = await hashPassword(password);

  await query(
    `INSERT INTO users (id, email, password_hash, auth_provider, full_name, role) VALUES ($1, $2, $3, 'password', $4, 'user')`,
    [id, email, passwordHash, fullName ?? null]
  );

  // Seed a 30-day trial subscription (5 production minutes) so new users can try the product immediately
  const subId = randomUUID();
  const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await query(
    `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, minutes_total, minutes_used)
     VALUES ($1, $2, 'trial', 'trial', NOW(), $3, 5, 0)`,
    [subId, id, periodEnd]
  );

  const token = signToken(id, "user");
  res.json({ token, user: { id, email, fullName } });
});

authRoutes.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await queryOne<{ id: string; password_hash: string; role: "user" | "admin"; full_name: string }>(
    "SELECT * FROM users WHERE email = $1", [email]
  );
  if (!user?.password_hash) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user.id, user.role);
  res.json({ token, user: { id: user.id, email, fullName: user.full_name } });
});

// Google OAuth: frontend does the redirect+consent, sends us the id_token to verify
authRoutes.post("/google", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "idToken required" });

  const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!verifyRes.ok) return res.status(401).json({ error: "Invalid Google token" });
  const payload = await verifyRes.json() as { email: string; name?: string };

  let user = await queryOne<{ id: string; role: "user" | "admin" }>("SELECT id, role FROM users WHERE email = $1", [payload.email]);
  if (!user) {
    const id = randomUUID();
    await query(
      `INSERT INTO users (id, email, auth_provider, full_name, role) VALUES ($1, $2, 'google', $3, 'user')`,
      [id, payload.email, payload.name ?? null]
    );
    user = { id, role: "user" };
  }

  const token = signToken(user.id, user.role);
  res.json({ token, user: { id: user.id, email: payload.email } });
});
