// Low-level mail transport. Uses real SMTP when SMTP_HOST is configured,
// otherwise a dev transport that writes .eml previews to backend/var/mail so you
// can SEE every email the system sends without any external account.
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

let transporter = null;

function getTransport() {
  if (transporter) return transporter;
  if (env.email.smtpHost) {
    transporter = nodemailer.createTransport({
      host: env.email.smtpHost,
      port: env.email.smtpPort,
      secure: env.email.smtpSecure,
      auth: env.email.smtpUser ? { user: env.email.smtpUser, pass: env.email.smtpPass } : undefined,
    });
  } else {
    fs.mkdirSync(env.email.mailDir, { recursive: true });
    transporter = nodemailer.createTransport({ streamTransport: true, newline: "unix", buffer: true });
  }
  return transporter;
}

export function emailMode() {
  return env.email.smtpHost ? "smtp" : "preview";
}

export async function sendMail({ to, subject, html, text }) {
  const t = getTransport();
  const info = await t.sendMail({ from: env.email.from, to, subject, html, text });

  let previewPath = null;
  if (!env.email.smtpHost && info.message) {
    fs.mkdirSync(env.email.mailDir, { recursive: true });
    const safe = String(to).replace(/[^a-z0-9]/gi, "_");
    previewPath = path.join(env.email.mailDir, `${Date.now()}-${safe}.eml`);
    fs.writeFileSync(previewPath, info.message);
    console.log(`[mail:preview] "${subject}" -> ${to}  saved: ${previewPath}`);
  } else {
    console.log(`[mail:sent] "${subject}" -> ${to}  id: ${info.messageId}`);
  }
  return { messageId: info.messageId, previewPath };
}
