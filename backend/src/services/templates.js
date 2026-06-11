// Branded, responsive HTML email templates. Each renderer returns
// { subject, html, text } from a payload object. Plain-text is auto-derived.
import { env } from "../config/env.js";

const BRAND = "ZERØ CLOTHING";
const money = (cents) => "Rs " + Number(Math.round((cents || 0) / 100)).toLocaleString("en-LK");
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function layout({ heading, intro, bodyHtml = "", ctaLabel, ctaUrl, footnote }) {
  const cta =
    ctaLabel && ctaUrl
      ? `<tr><td style="padding:8px 0 28px"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:13px;padding:14px 30px;border-radius:2px">${esc(ctaLabel)}</a></td></tr>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:Inter,Helvetica,Arial,sans-serif;color:#e8e8e8">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#101010;border:1px solid #242424;border-radius:14px;overflow:hidden">
        <tr><td style="padding:28px 36px;border-bottom:1px solid #1c1c1c">
          <span style="font-size:24px;font-weight:700;letter-spacing:.04em;color:#fff">ZER<span style="color:#c8c8cc">Ø</span></span>
          <span style="float:right;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#7d7d7d;padding-top:8px;display:inline-block">Designed By You</span>
        </td></tr>
        <tr><td style="padding:36px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:22px;font-weight:600;color:#fff;padding-bottom:14px">${esc(heading)}</td></tr>
            ${intro ? `<tr><td style="font-size:15px;line-height:1.7;color:#cfcfcf;padding-bottom:18px">${intro}</td></tr>` : ""}
            ${bodyHtml ? `<tr><td style="padding-bottom:10px">${bodyHtml}</td></tr>` : ""}
            ${cta}
            ${footnote ? `<tr><td style="font-size:12px;line-height:1.6;color:#7d7d7d;border-top:1px solid #1c1c1c;padding-top:18px">${footnote}</td></tr>` : ""}
          </table>
        </td></tr>
        <tr><td style="padding:22px 36px;border-top:1px solid #1c1c1c;font-size:12px;color:#555">
          ${BRAND} · Colombo, Sri Lanka · <a href="${esc(env.siteUrl)}" style="color:#7d7d7d">${esc(env.siteUrl)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function itemsTable(items = []) {
  if (!items.length) return "";
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #1c1c1c;color:#e8e8e8;font-size:14px">${esc(i.name)}${
          i.quantity > 1 ? ` ×${i.quantity}` : ""
        }</td><td align="right" style="padding:8px 0;border-bottom:1px solid #1c1c1c;color:#e8e8e8;font-size:14px">${money(
          i.lineTotalCents
        )}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px">${rows}</table>`;
}

const TEMPLATES = {
  "verify-email": (p) => {
    const url = `${env.appUrl}/api/v1/auth/verify-email?token=${encodeURIComponent(p.token)}`;
    return {
      subject: "Confirm your email — ZERØ CLOTHING",
      html: layout({
        heading: `Welcome${p.firstName ? `, ${esc(p.firstName)}` : ""}.`,
        intro: "You're one tap away from your ZERØ account. Confirm your email address to activate it and unlock order tracking, saved designs and faster checkout.",
        ctaLabel: "Verify Email",
        ctaUrl: url,
        footnote: `If the button doesn't work, paste this link into your browser:<br>${esc(url)}<br><br>This link expires in 24 hours. If you didn't create an account, ignore this email.`,
      }),
    };
  },
  welcome: (p) => ({
    subject: "Welcome to ZERØ — Designed By You",
    html: layout({
      heading: `You're in${p.firstName ? `, ${esc(p.firstName)}` : ""}.`,
      intro: "Your email is verified and your account is live. Explore acid wash drops, build a one-of-one piece in the studio, and enjoy free islandwide delivery over Rs 15,000.",
      ctaLabel: "Start Designing",
      ctaUrl: `${env.siteUrl}/customize.html`,
    }),
  }),
  "password-reset": (p) => {
    const url = `${env.siteUrl}/account.html?reset=${encodeURIComponent(p.token)}`;
    return {
      subject: "Reset your ZERØ password",
      html: layout({
        heading: "Password reset requested",
        intro: "We received a request to reset your password. Tap below to choose a new one. This link expires in 1 hour.",
        ctaLabel: "Reset Password",
        ctaUrl: url,
        footnote: `If the button doesn't work, paste this link:<br>${esc(url)}<br><br>If you didn't request this, you can safely ignore this email — your password won't change.`,
      }),
    };
  },
  "security-alert": (p) => ({
    subject: "Your ZERØ password was changed",
    html: layout({
      heading: "Password changed",
      intro: `This is a confirmation that your account password was just ${esc(
        (p.event || "changed").replace(/_/g, " ")
      )}. If this was you, no action is needed.`,
      footnote: "If you did NOT make this change, reset your password immediately and contact support.",
    }),
  }),
  "order-confirmation": (p) => ({
    subject: `Order confirmed — ${esc(p.orderNumber)}`,
    html: layout({
      heading: "Thank you for your order!",
      intro: `We've received order <b style="color:#fff">${esc(p.orderNumber)}</b> and it's now in our queue. You'll get another email the moment your payment is verified and production starts.`,
      bodyHtml:
        itemsTable(p.items) +
        `<table role="presentation" width="100%"><tr><td style="color:#7d7d7d;font-size:13px;padding:2px 0">Subtotal</td><td align="right" style="color:#cfcfcf;font-size:13px">${money(
          p.subtotalCents
        )}</td></tr>${
          p.discountCents
            ? `<tr><td style="color:#34d375;font-size:13px;padding:2px 0">Discount</td><td align="right" style="color:#34d375;font-size:13px">- ${money(
                p.discountCents
              )}</td></tr>`
            : ""
        }<tr><td style="color:#7d7d7d;font-size:13px;padding:2px 0">Shipping</td><td align="right" style="color:#cfcfcf;font-size:13px">${
          p.shippingCents ? money(p.shippingCents) : "FREE"
        }</td></tr><tr><td style="color:#fff;font-size:16px;font-weight:600;padding:10px 0 0">Total</td><td align="right" style="color:#fff;font-size:16px;font-weight:600;padding:10px 0 0">${money(
          p.totalCents
        )}</td></tr></table>`,
      ctaLabel: "Track Your Order",
      ctaUrl: `${env.siteUrl}/tracking.html?order=${encodeURIComponent(p.orderNumber)}`,
    }),
  }),
  "payment-confirmed": (p) => ({
    subject: `Payment received — ${esc(p.orderNumber)}`,
    html: layout({
      heading: "Payment confirmed",
      intro: `We've received your ${esc(p.method || "payment")} of <b style="color:#fff">${money(
        p.amountCents
      )}</b> for order <b style="color:#fff">${esc(p.orderNumber)}</b>. Your piece is moving into production.`,
      ctaLabel: "Track Your Order",
      ctaUrl: `${env.siteUrl}/tracking.html?order=${encodeURIComponent(p.orderNumber)}`,
    }),
  }),
  "production-started": (p) => ({
    subject: `In production — ${esc(p.orderNumber)}`,
    html: layout({
      heading: "Your order is in production",
      intro: `Order <b style="color:#fff">${esc(p.orderNumber)}</b> is being cut, printed and finished by hand in our Colombo studio. We'll let you know the moment it ships.`,
      ctaLabel: "Track Your Order",
      ctaUrl: `${env.siteUrl}/tracking.html?order=${encodeURIComponent(p.orderNumber)}`,
    }),
  }),
  "order-shipped": (p) => ({
    subject: `Shipped — ${esc(p.orderNumber)}`,
    html: layout({
      heading: "Your order is on its way",
      intro: `Great news — order <b style="color:#fff">${esc(p.orderNumber)}</b> has shipped${
        p.courier ? ` via ${esc(p.courier)}` : ""
      }.`,
      bodyHtml: p.trackingNumber
        ? `<div style="background:#161616;border:1px solid #242424;border-radius:8px;padding:16px;margin:4px 0 8px"><div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7d7d7d">Tracking Number</div><div style="font-size:18px;color:#fff;font-weight:600;margin-top:4px">${esc(
            p.trackingNumber
          )}</div></div>`
        : "",
      ctaLabel: "Track Your Order",
      ctaUrl: `${env.siteUrl}/tracking.html?order=${encodeURIComponent(p.orderNumber)}`,
    }),
  }),
  "order-delivered": (p) => ({
    subject: `Delivered — ${esc(p.orderNumber)}`,
    html: layout({
      heading: "Delivered. Enjoy your ZERØ piece.",
      intro: `Order <b style="color:#fff">${esc(p.orderNumber)}</b> has been delivered. Tag <b style="color:#fff">@zero_clth7</b> — we love seeing how you wear it.`,
      ctaLabel: "Leave a Review",
      ctaUrl: `${env.siteUrl}/account.html#orders`,
    }),
  }),
  "refund-issued": (p) => ({
    subject: `Refund issued — ${esc(p.orderNumber)}`,
    html: layout({
      heading: "Your refund is on the way",
      intro: `We've issued a refund of <b style="color:#fff">${money(p.amountCents)}</b> for order <b style="color:#fff">${esc(
        p.orderNumber
      )}</b>. Depending on your bank it may take 3–7 working days to appear.`,
    }),
  }),
  "review-request": (p) => ({
    subject: `How was your order? — ${esc(p.orderNumber)}`,
    html: layout({
      heading: "Tell us what you think",
      intro: `We hope you're loving your ZERØ piece from order <b style="color:#fff">${esc(
        p.orderNumber
      )}</b>. A quick review helps other customers and earns you loyalty points.`,
      bodyHtml: p.items && p.items.length
        ? `<table role="presentation" width="100%">${p.items
            .map((i) => `<tr><td style="padding:6px 0;color:#cfcfcf;font-size:14px;border-bottom:1px solid #1c1c1c">${esc(i.name)}</td></tr>`)
            .join("")}</table>`
        : "",
      ctaLabel: "Leave a Review",
      ctaUrl: `${env.siteUrl}/account.html#orders`,
      footnote: "Tag @zero_clth7 on Instagram for a chance to be featured.",
    }),
  }),
  "ticket-update": (p) => ({
    subject: `Support update — ${esc(p.ticketNumber || p.subject || "your ticket")}`,
    html: layout({
      heading: "We replied to your message",
      intro: `There's an update on your support ticket <b style="color:#fff">${esc(
        p.ticketNumber || ""
      )}</b>${p.subject ? ` (${esc(p.subject)})` : ""}.`,
      bodyHtml: p.message
        ? `<div style="background:#161616;border:1px solid #242424;border-radius:8px;padding:16px;color:#cfcfcf;font-size:14px;line-height:1.6">${esc(
            p.message
          )}</div>`
        : "",
      ctaLabel: "View Conversation",
      ctaUrl: `${env.siteUrl}/account.html`,
    }),
  }),
  "abandoned-cart": (p) => ({
    subject: "You left something behind — ZERØ",
    html: layout({
      heading: "Still thinking it over?",
      intro: "Your bag is waiting. Complete your order before these pieces sell out — free islandwide delivery over Rs 15,000.",
      ctaLabel: "Return to Checkout",
      ctaUrl: `${env.siteUrl}/checkout.html`,
    }),
  }),
};

export function renderTemplate(template, payload = {}) {
  const fn = TEMPLATES[template];
  if (!fn) {
    const html = layout({ heading: BRAND, intro: esc(JSON.stringify(payload)) });
    return { subject: `${BRAND} notification`, html, text: stripHtml(html) };
  }
  const out = fn(payload);
  return { subject: out.subject, html: out.html, text: out.text || stripHtml(out.html) };
}

export const KNOWN_TEMPLATES = Object.keys(TEMPLATES);
