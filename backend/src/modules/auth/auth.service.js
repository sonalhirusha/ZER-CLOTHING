// Authentication business logic: signup, login, verify, reset.
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/hash.js";
import { signAccessToken, generateRefreshToken, hashToken } from "../../lib/jwt.js";
import { enqueueEmail, EMAIL_TEMPLATES } from "../../services/email.js";
import { ApiError } from "../../middleware/error.js";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    emailVerified: Boolean(u.emailVerifiedAt),
  };
}

async function issueTokens(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const { raw, hash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt, userAgent: meta.userAgent, ip: meta.ip },
  });
  return { accessToken, refreshToken: raw };
}

export async function signup({ email, password, firstName, lastName }, meta) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), firstName, lastName },
  });

  // email verification token (store hash only)
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await prisma.emailVerification.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  });
  await enqueueEmail(user.email, EMAIL_TEMPLATES.VERIFY_EMAIL, { token: rawToken, firstName });

  const tokens = await issueTokens(user, meta);
  return { user: publicUser(user), ...tokens };
}

export async function login({ email, password }, meta) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw ApiError.unauthorized("Invalid email or password");
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw ApiError.unauthorized("Invalid email or password");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const tokens = await issueTokens(user, meta);
  return { user: publicUser(user), ...tokens };
}

export async function verifyEmail({ token }) {
  const record = await prisma.emailVerification.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest("Invalid or expired verification link");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  await enqueueEmail(user.email, EMAIL_TEMPLATES.WELCOME, { firstName: user.firstName });
  return { verified: true };
}

export async function requestPasswordReset({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always succeed (no user enumeration).
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await enqueueEmail(user.email, EMAIL_TEMPLATES.PASSWORD_RESET, { token: rawToken });
  }
  return { ok: true };
}

export async function resetPassword({ token, password }) {
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest("Invalid or expired reset link");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // revoke all existing refresh tokens on password change
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  await enqueueEmail(user.email, EMAIL_TEMPLATES.SECURITY_ALERT, { event: "password_changed" });
  return { ok: true };
}

export async function refresh({ refreshToken }, meta) {
  if (!refreshToken) throw ApiError.unauthorized();
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) throw ApiError.unauthorized("Session expired");
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw ApiError.unauthorized();
  // rotate: revoke old, issue new
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  const tokens = await issueTokens(user, meta);
  return { user: publicUser(user), ...tokens };
}

export async function logout({ refreshToken }) {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return { ok: true };
}

export async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  return publicUser(user);
}
