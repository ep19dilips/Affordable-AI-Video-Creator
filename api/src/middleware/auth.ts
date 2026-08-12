import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export interface AuthedRequest extends Request {
  userId?: string;
  role?: "user" | "admin";
}

export function signToken(userId: string, role: "user" | "admin"): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as { sub: string; role: "user" | "admin" };
    req.userId = payload.sub;
    req.role = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

/** Shared-secret auth for the render worker's internal callbacks (not a user JWT) */
export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== process.env.RENDER_WORKER_SERVICE_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
