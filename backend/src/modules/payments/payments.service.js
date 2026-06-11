// Payments: built-in card flow (validate + record, no PAN stored), bank-transfer
// receipt upload + verification, COD, and a PayHere webhook hook. Card brands
// (Visa/Mastercard/Amex/Discover) are detected; only brand + last4 are stored.
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { validateCard } from "../../lib/payments.js";
import { toJSON } from "../../lib/json.js";
import { ApiError } from "../../middleware/error.js";
import { setOrderStatus, notify } from "../orders/orders.service.js";
import { enqueueEmail, EMAIL_TEMPLATES } from "../../services/email.js";
import { env } from "../../config/env.js";

async function loadOrderWithPayment(orderNumber) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { payment: true } });
  if (!order) throw ApiError.notFound("Order not found");
  return order;
}

function publicPayment(p, orderNumber) {
  return {
    orderNumber,
    provider: p.provider,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    cardBrand: p.cardBrand,
    cardLast4: p.cardLast4,
    verifiedAt: p.verifiedAt,
  };
}

// ----------------------------------------------------------------------------
// Card payment (built-in validator). Plug a real gateway here for settlement.
// ----------------------------------------------------------------------------
export async function payByCard(orderNumber, card, { userId } = {}) {
  const order = await loadOrderWithPayment(orderNumber);
  if (!order.payment) throw ApiError.badRequest("No payment record for this order");

  // Prevent duplicate charges.
  if (order.payment.status === "paid") return { ...publicPayment(order.payment, orderNumber), duplicate: true };

  const result = validateCard(card);
  if (!result.ok) {
    // Record the failed attempt so it surfaces as an admin alert (PAN never stored).
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: "failed",
        events: { create: { type: "card.failed", rawPayload: toJSON({ errors: result.errors, brand: result.brand }), signatureOk: false } },
      },
    }).catch(() => {});
    throw ApiError.unprocessable("Card validation failed", result.errors);
  }

  // If PayHere is configured this is where you'd tokenize + charge. Without
  // credentials we record an authorized+captured payment from the validated card.
  const providerRef = "CARD-" + crypto.randomBytes(8).toString("hex").toUpperCase();

  const payment = await prisma.payment.update({
    where: { id: order.payment.id },
    data: {
      provider: "card",
      method: `${result.brand} ****${result.last4}`,
      status: "paid",
      cardBrand: result.brand,
      cardLast4: result.last4,
      providerRef,
      verifiedAt: new Date(),
      idempotencyKey: order.payment.idempotencyKey || `pay_${order.id}`,
      events: { create: { type: "card.captured", rawPayload: toJSON({ brand: result.brand, last4: result.last4, providerRef }), signatureOk: true, providerRef } },
    },
  });

  // Advance the order to paid (sends payment-confirmed email + notification).
  await setOrderStatus(orderNumber, "paid", { actor: "system", note: `Card payment ${providerRef}` });

  return publicPayment(payment, orderNumber);
}

// ----------------------------------------------------------------------------
// Bank transfer receipt upload (customer) → awaits admin verification.
// ----------------------------------------------------------------------------
export async function attachReceipt(orderNumber, file, { userId } = {}) {
  if (!file) throw ApiError.badRequest("Receipt file is required");
  const order = await loadOrderWithPayment(orderNumber);
  if (!order.payment) throw ApiError.badRequest("No payment record for this order");

  const payment = await prisma.payment.update({
    where: { id: order.payment.id },
    data: {
      provider: "bank_transfer",
      method: "Bank Transfer",
      receiptAssetId: file.key,
      status: order.payment.status === "paid" ? "paid" : "pending",
      events: { create: { type: "receipt.uploaded", rawPayload: toJSON({ key: file.key, url: file.url, size: file.size }), providerRef: file.key } },
    },
  });

  await notify(order.userId, "payment", "Receipt received", `We received your bank transfer receipt for ${order.orderNumber} and will verify it shortly.`, `/tracking.html?order=${order.orderNumber}`);

  return { ...publicPayment(payment, orderNumber), receiptUrl: file.url };
}

// ----------------------------------------------------------------------------
// Admin: verify a bank transfer (marks paid + moves to production).
// ----------------------------------------------------------------------------
export async function verifyPayment(orderNumber, adminId) {
  const order = await loadOrderWithPayment(orderNumber);
  if (!order.payment) throw ApiError.badRequest("No payment record");
  if (order.payment.status === "paid") return publicPayment(order.payment, orderNumber);

  const payment = await prisma.payment.update({
    where: { id: order.payment.id },
    data: { status: "paid", verifiedBy: `admin:${adminId}`, verifiedAt: new Date() },
  });
  await setOrderStatus(orderNumber, "paid", { actor: `admin:${adminId}`, note: "Payment verified" });
  return publicPayment(payment, orderNumber);
}

export async function refundPayment(orderNumber, adminId) {
  const order = await loadOrderWithPayment(orderNumber);
  if (!order.payment) throw ApiError.badRequest("No payment record");
  const payment = await prisma.payment.update({
    where: { id: order.payment.id },
    data: { status: "refunded", verifiedBy: `admin:${adminId}` },
  });
  await setOrderStatus(orderNumber, "refunded", { actor: `admin:${adminId}`, note: "Refund issued" });
  // Release reserved/sold stock back.
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  for (const it of items) {
    if (it.variantId) {
      await prisma.inventory.updateMany({ where: { variantId: it.variantId }, data: { quantityOnHand: { increment: it.quantity } } });
    }
  }
  return publicPayment(payment, orderNumber);
}

export async function getPayment(orderNumber) {
  const order = await loadOrderWithPayment(orderNumber);
  if (!order.payment) throw ApiError.notFound("No payment record");
  return publicPayment(order.payment, orderNumber);
}

// ----------------------------------------------------------------------------
// PayHere webhook (Sri Lanka gateway). Verifies signature when configured.
// ----------------------------------------------------------------------------
export async function handlePayhereNotify(body) {
  const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = body || {};
  if (env.payments.payhereMerchantSecret) {
    const secretHash = crypto.createHash("md5").update(env.payments.payhereMerchantSecret).digest("hex").toUpperCase();
    const local = crypto
      .createHash("md5")
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`)
      .digest("hex")
      .toUpperCase();
    if (local !== String(md5sig || "").toUpperCase()) throw ApiError.badRequest("Invalid signature");
  }
  // status_code 2 = success in PayHere.
  if (String(status_code) === "2" && order_id) {
    const order = await prisma.order.findUnique({ where: { orderNumber: order_id }, include: { payment: true } });
    if (order && order.payment && order.payment.status !== "paid") {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { provider: "payhere", status: "paid", providerRef: order_id, verifiedAt: new Date(), events: { create: { type: "payhere.notify", rawPayload: toJSON(body), signatureOk: true, providerRef: order_id } } },
      });
      await setOrderStatus(order_id, "paid", { actor: "system", note: "PayHere confirmed" });
    }
  }
  return { ok: true };
}
