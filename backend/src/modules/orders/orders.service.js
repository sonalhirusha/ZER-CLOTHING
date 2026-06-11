// Order creation + retrieval. Pricing is ALWAYS recomputed server-side from the
// database — client-sent totals are ignored (prevents tampering).
import { prisma } from "../../lib/prisma.js";
import { generateOrderNumber } from "../../lib/ids.js";
import { enqueueEmail, EMAIL_TEMPLATES } from "../../services/email.js";
import { ApiError } from "../../middleware/error.js";

const FREE_SHIPPING_THRESHOLD_CENTS = 1_500_000; // Rs 15,000
const SHIPPING_RATES_CENTS = {
  speed_post: 35000,   // Rs 350
  standard: 50000,     // Rs 500
  express: 90000,      // Rs 900
  pickup: 0,
};

async function priceItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest("Cart is empty");
  }
  const priced = [];
  let subtotal = 0;
  for (const item of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: true, inventory: true },
    });
    if (!variant) throw ApiError.badRequest(`Unknown product variant: ${item.variantId}`);

    const qty = Math.max(1, Number(item.quantity) || 1);
    const available = variant.inventory
      ? variant.inventory.quantityOnHand - variant.inventory.reserved
      : 0;
    if (variant.inventory && available < qty) {
      throw ApiError.conflict(`Insufficient stock for ${variant.sku}`, { available });
    }

    const unit = variant.priceOverrideCents ?? variant.product.basePriceCents;
    const lineTotal = unit * qty;
    subtotal += lineTotal;
    priced.push({
      variantId: variant.id,
      customDesignId: item.customDesignId || null,
      unitPriceCents: unit,
      quantity: qty,
      lineTotalCents: lineTotal,
      productSnapshot: {
        name: variant.product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.colorName,
      },
    });
  }
  return { priced, subtotal };
}

async function resolveCoupon(code, subtotal) {
  if (!code) return { discount: 0, coupon: null, freeShip: false };
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  const now = new Date();
  const valid =
    coupon &&
    coupon.active &&
    subtotal >= coupon.minSubtotalCents &&
    (!coupon.startsAt || coupon.startsAt <= now) &&
    (!coupon.endsAt || coupon.endsAt >= now);
  if (!valid) throw ApiError.badRequest("Invalid or expired coupon");

  if (coupon.type === "percent") return { discount: Math.round(subtotal * (coupon.value / 100)), coupon, freeShip: false };
  if (coupon.type === "fixed") return { discount: Math.min(coupon.value, subtotal), coupon, freeShip: false };
  return { discount: 0, coupon, freeShip: true };
}

export async function quote({ items, couponCode, shippingMethod }) {
  const { subtotal } = await priceItems(items);
  const { discount, freeShip } = await resolveCoupon(couponCode, subtotal);
  const baseShip = SHIPPING_RATES_CENTS[shippingMethod] ?? SHIPPING_RATES_CENTS.standard;
  const shipping =
    freeShip || (subtotal >= FREE_SHIPPING_THRESHOLD_CENTS && shippingMethod !== "express")
      ? 0
      : baseShip;
  const tax = 0; // configure VAT here if/when applicable
  const total = Math.max(0, subtotal - discount) + shipping + tax;
  return { subtotalCents: subtotal, discountCents: discount, shippingCents: shipping, taxCents: tax, totalCents: total };
}

export async function createOrder(input, { userId, idempotencyKey }) {
  // Idempotency: same key returns the original order instead of creating a duplicate.
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey }, include: { items: true, payment: true } });
    if (existing) return existing;
  }

  const { priced, subtotal } = await priceItems(input.items);
  const { discount, coupon, freeShip } = await resolveCoupon(input.couponCode, subtotal);
  const baseShip = SHIPPING_RATES_CENTS[input.shippingMethod] ?? SHIPPING_RATES_CENTS.standard;
  const shipping =
    freeShip || (subtotal >= FREE_SHIPPING_THRESHOLD_CENTS && input.shippingMethod !== "express")
      ? 0
      : baseShip;
  const tax = 0;
  const total = Math.max(0, subtotal - discount) + shipping + tax;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: userId || null,
        email: input.email,
        status: input.paymentMethod === "cod" ? "paid" : "awaiting_payment",
        subtotalCents: subtotal,
        discountCents: discount,
        taxCents: tax,
        shippingCents: shipping,
        totalCents: total,
        couponId: coupon ? coupon.id : null,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress || input.shippingAddress,
        idempotencyKey: idempotencyKey || null,
        items: { create: priced },
        payment: {
          create: {
            provider: input.paymentMethod,
            amountCents: total,
            status: input.paymentMethod === "cod" ? "pending" : "pending",
          },
        },
        statusHistory: { create: { toStatus: input.paymentMethod === "cod" ? "paid" : "awaiting_payment", actor: "system" } },
      },
      include: { items: true, payment: true },
    });

    // Reserve stock for each variant.
    for (const line of priced) {
      await tx.inventory.updateMany({
        where: { variantId: line.variantId },
        data: { reserved: { increment: line.quantity } },
      });
    }
    return created;
  });

  await enqueueEmail(input.email, EMAIL_TEMPLATES.ORDER_CONFIRMATION, {
    orderNumber: order.orderNumber,
    totalCents: order.totalCents,
  });

  return order;
}

export async function listOrders(userId) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    include: { items: true, payment: true, shipment: true },
  });
}

export async function getOrder(orderNumber, userId) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, payment: true, shipment: { include: { events: true } }, statusHistory: true },
  });
  if (!order) throw ApiError.notFound("Order not found");
  if (order.userId && order.userId !== userId) throw ApiError.forbidden();
  return order;
}
