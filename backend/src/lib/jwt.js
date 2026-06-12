// Access-token signing/verification. Refresh tokens are random + stored hashed.
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role, adm: true },
    env.jwt.adminSecret,
    { expiresIn: "8h" }
  );
}

export function verifyAdminToken(token) {
  return jwt.verify(token, env.jwt.adminSecret);
}

// Opaque refresh token (random), returned to client; only its hash is stored.
// "remember" sessions last refreshTtlDays; non-remember sessions last 1 day.
export function generateRefreshToken(remember = false) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const hash = hashToken(raw);
  const days = remember ? env.jwt.refreshTtlDays : 1;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return { raw, hash, expiresAt };
}

export function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
