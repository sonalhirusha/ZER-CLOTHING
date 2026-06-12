// Centralised, validated environment configuration.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..", "..");

function bool(v, d = false) {
  if (v === undefined) return d;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  appUrl: process.env.APP_URL || "http://localhost:4000",
  // Where the storefront lives (used to build links inside emails).
  siteUrl: process.env.SITE_URL || "http://localhost:8080",
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Database — SQLite by default, fully portable to Postgres.
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
    adminSecret: process.env.JWT_ADMIN_SECRET || "dev-admin-secret-change-me",
    accessTtl: process.env.ACCESS_TOKEN_TTL || "30m",
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  },

  // Uploads (receipts, artwork). Stored on local disk by default; swap for S3 in prod.
  uploads: {
    dir: process.env.UPLOAD_DIR || path.join(backendRoot, "var", "uploads"),
    maxBytes: Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024),
  },

  // Email. If SMTP_HOST is set, real SMTP is used; otherwise a dev transport
  // writes .eml previews to backend/var/mail and logs them.
  email: {
    from: process.env.EMAIL_FROM || "ZERO CLOTHING <orders@zeroclothing.lk>",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure: bool(process.env.SMTP_SECURE, false),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    mailDir: process.env.MAIL_PREVIEW_DIR || path.join(backendRoot, "var", "mail"),
  },

  // Payments (PayHere — Sri Lanka). When unset, the built-in card validator +
  // manual bank-transfer flow are used (no external dependency).
  payments: {
    payhereMerchantId: process.env.PAYHERE_MERCHANT_ID || "",
    payhereMerchantSecret: process.env.PAYHERE_MERCHANT_SECRET || "",
    payhereMode: process.env.PAYHERE_MODE || "sandbox",
  },

  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL || "admin@zeroclothing.lk",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin123!",
  },

  paths: { backendRoot },

  isProd() {
    return this.nodeEnv === "production";
  },
};
