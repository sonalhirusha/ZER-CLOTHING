// Transactional email via an outbox table (email_queue). A separate worker
// (jobs/emailWorker.js) renders templates and sends through the provider, with
// retries/backoff. Here we only ENQUEUE — controllers never send inline.
import { prisma } from "../lib/prisma.js";

// Known templates -> see docs/ECOMMERCE-ARCHITECTURE.md §7
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
  REFUND_ISSUED: "refund-issued",
  TICKET_UPDATE: "ticket-update",
  ABANDONED_CART: "abandoned-cart",
};

export async function enqueueEmail(to, template, payload = {}, scheduledAt = new Date()) {
  return prisma.emailQueue.create({
    data: { to, template, payload, scheduledAt },
  });
}
