// Human-readable, collision-resistant identifiers.
import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function randomCode(length) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// e.g. ZRO-20260611-7F3K9Q
export function generateOrderNumber(date = new Date()) {
  return `ZRO-${ymd(date)}-${randomCode(6)}`;
}

// e.g. ZTRK-20260611-8H2D4P  (courier tracking number)
export function generateTrackingNumber(date = new Date()) {
  return `ZTRK${ymd(date)}${randomCode(7)}`;
}

// e.g. TKT-9F3K2Q
export function generateTicketNumber() {
  return `TKT-${randomCode(6)}`;
}
