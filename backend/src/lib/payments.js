// Card helpers — used for the built-in (gateway-less) card flow and for
// front-of-house validation. We NEVER store the full PAN: only brand + last4.
// For real settlement, plug a gateway (PayHere/Stripe) into payments.service.

export function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

// Luhn checksum — validates the card number is well-formed.
export function luhnValid(number) {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function detectBrand(number) {
  const d = digitsOnly(number);
  if (/^4\d{12}(\d{3})?(\d{3})?$/.test(d) || /^4/.test(d)) return "Visa";
  if (/^(5[1-5]\d{14}|2(2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(d) || /^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^6(?:011|5)/.test(d)) return "Discover";
  return "Card";
}

export function last4(number) {
  const d = digitsOnly(number);
  return d.slice(-4);
}

// Validate an expiry (MM/YY or MM/YYYY) is in the future.
export function expiryValid(expiry) {
  const m = String(expiry || "").match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return false;
  let month = Number(m[1]);
  let year = Number(m[2]);
  if (month < 1 || month > 12) return false;
  if (year < 100) year += 2000;
  const exp = new Date(year, month, 1); // first day of month AFTER expiry month
  return exp > new Date();
}

export function cvvValid(cvv, brand = "Card") {
  const d = digitsOnly(cvv);
  return brand === "Amex" ? d.length === 4 : d.length === 3;
}

// Full validation result for an incoming card.
export function validateCard({ number, expiry, cvv, name }) {
  const errors = [];
  if (!luhnValid(number)) errors.push("Card number is invalid");
  const brand = detectBrand(number);
  if (!expiryValid(expiry)) errors.push("Card expiry is invalid or in the past");
  if (!cvvValid(cvv, brand)) errors.push("CVV is invalid");
  if (!String(name || "").trim()) errors.push("Cardholder name is required");
  return { ok: errors.length === 0, errors, brand, last4: last4(number) };
}
