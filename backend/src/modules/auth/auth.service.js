// Authentication business logic: signup, login, verify, reset, sessions.
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/hash.js";
import { signAccessToken, generateRefreshToken, hashToken } from "../../lib/jwt.js";
import { enqueueEmail, EMAIL_TEMPLATES } from "../../services/email.js";
import { ApiError } from "../../middleware/error.js";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    marketingOptIn: u.marketingOptIn,
    emailVerified: Boolean(u.emailVerifiedAt),
    createdAt: u.createdAt,
  };
}

async function issueTokens(user, meta = {}, remember = false) {
  const accessToken = signAccessToken(user);
  const { raw, hash, expiresAt } = generateRefreshToken(remember);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt, remember, userAgent: meta.userAgent, ip: meta.ip },
  });
  return { accessToken, refreshToken: raw, expiresAt };
}

async function createVerification(user) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await prisma.emailVerification.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  });
  await enqueueEmail(user.email, EMAIL_TEMPLATES.VERIFY_EMAIL, { token: rawToken, firstName: user.firstName });
  return rawToken;
}

export async function signup({ email, password, firstName, lastName, phone, marketingOptIn, remember }, meta) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      marketingOptIn: Boolean(marketingOptIn),
    },
  });

  // Give every customer a loyalty account.
  await prisma.loyaltyAccount.create({ data: { userId: user.id } }).catch(() => {});

  await createVerification(user);

  const tokens = await issueTokens(user, meta, Boolean(remember));
  return { user: publicUser(user), ...tokens };
}

export async function login({ email, password, remember }, meta) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.passwordHash) throw ApiError.unauthorized("Invalid email or password");
  if (user.status !== "active") throw ApiError.forbidden("This account is not active");
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw ApiError.unauthorized("Invalid email or password");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const tokens = await issueTokens(user, meta, Boolean(remember));
  return { user: publicUser(user), ...tokens };
}

export async function resendVerification({ email }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (user && !user.emailVerifiedAt) await createVerification(user);
  return { ok: true };
}

async function consumeVerification(token) {
  const record = await prisma.emailVerification.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  await enqueueEmail(user.email, EMAIL_TEMPLATES.WELCOME, { firstName: user.firstName });
  return user;
}

export async function verifyEmail({ token }) {
  const user = await consumeVerification(token);
  if (!user) throw ApiError.badRequest("Invalid or expired verification link");
  return { verified: true };
}

// Used by the GET link in the verification email (returns boolean, no throw).
export async function verifyEmailByToken(token) {
  const user = await consumeVerification(token);
  return Boolean(user);
}

export async function requestPasswordReset({ email }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
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
  // rotate: revoke old, issue new (preserve remember flag)
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  const tokens = await issueTokens(user, meta, record.remember);
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
