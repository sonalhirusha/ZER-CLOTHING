// Transactional email via an outbox table (EmailQueue). Controllers only
// ENQUEUE here; the worker (jobs/emailWorker.js) renders + sends with retries.
// Enqueuing also kicks the worker so emails go out immediately in dev/prod.
import { prisma } from "../lib/prisma.js";
import { toJSON } from "../lib/json.js";
import { kick } from "../jobs/emailWorker.js";

export const EMAIL_TEMPLATES = {
  VERIFY_EMAIL: "verify-email",
  WELCOME: "welcome",
  PASSWORD_RESET: "password-reset",
  SECURITY_ALERT: "security-alert",
  ORDER_CONFIRMATION: "order-confirmation",
  PAYMENT_CONFIRMED: "payment-confirmed",
  PRODUCTION_STARTED: "production-started",
  ORDER_SHIPPED: "order-shipped",
  ORDER_DELIVERED: "order-delivered",
  REVIEW_REQUEST: "review-request",
  REFUND_ISSUED: "refund-issued",
  TICKET_UPDATE: "ticket-update",
  ABANDONED_CART: "abandoned-cart",
};

export async function enqueueEmail(to, template, payload = {}, scheduledAt = new Date()) {
  const row = await prisma.emailQueue.create({
    data: { to, template, payload: toJSON(payload) || "{}", scheduledAt },
  });
  kick();
  return row;
}
