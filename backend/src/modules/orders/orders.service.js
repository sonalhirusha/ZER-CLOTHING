// Order creation, retrieval, tracking and status transitions.
// Pricing for catalog items is ALWAYS recomputed server-side from the database
// (client totals are ignored). Custom-studio items carry a server-clamped price.
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { generateOrderNumber, generateTrackingNumber } from "../../lib/ids.js";
import { toJSON, fromJSON } from "../../lib/json.js";
import { enqueueEmail, EMAIL_TEMPLATES } from "../../services/email.js";
import { ApiError } from "../../middleware/error.js";

const FREE_SHIPPING_THRESHOLD_CENTS = 1_500_000; // Rs 15,000
const SHIPPING_RATES_CENTS = {
  speed_post: 45000, // Rs 450
  standard: 35000, // Rs 350
  express: 85000, // Rs 850
  pickup: 0,
};
const CUSTOM_MIN_CENTS = 100_000; // Rs 1,000 floor for a custom piece
const CUSTOM_MAX_CENTS = 5_000_000; // Rs 50,000 ceiling (anti-tamper)

// Allowed order status flow + which statuses trigger which customer email.
export const ORDER_STATUSES = [
  "created", "awaiting_payment", "paid", "in_production", "printing",
  "quality_check", "ready_to_ship", "shipped", "delivered", "cancelled", "refunded", "on_hold",
];

// Public-facing tracking step index (used by the frontend timeline).
export const STATUS_STEP = {
  created: 0, awaiting_payment: 0, paid: 1, in_production: 1, printing: 2,
  quality_check: 3, ready_to_ship: 3, shipped: 4, delivered: 5, cancelled: 0, refunded: 1, on_hold: 1,
};

export async function notify(userId, type, title, body, link) {
  if (!userId) return null;
  return prisma.notification.create({ data: { userId, type, title, body: body || null, link: link || null } });
}

// ----------------------------------------------------------------------------
// Pricing
// ----------------------------------------------------------------------------

function isCustomItem(item) {
  return Boolean(
    item.custom === true ||
      item.customDesignId ||
      item.designSpec ||
      (item.productSlug && String(item.productSlug).startsWith("custom")) ||
      (!item.variantId && !item.productSlug && item.name)
  );
}

async function resolveVariant(item) {
  if (item.variantId) {
    const v = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: true, inventory: true },
    });
    if (v) return v;
  }
  if (item.productSlug) {
    const product = await prisma.product.findUnique({
      where: { slug: item.productSlug },
      include: { variants: { include: { inventory: true } } },
    });
    if (!product) return null;
    const variants = product.variants;
    let match = variants.find(
      (v) =>
        (!item.size || v.size === item.size) &&
        (!item.color || v.colorName === item.color || v.colorHex === item.color)
    );
    if (!match) match = variants.find((v) => !item.size || v.size === item.size) || variants[0];
    if (!match) return null;
    return { ...match, product };
  }
  return null;
}

async function priceItems(items, { userId } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw ApiError.badRequest("Cart is empty");

  const priced = [];
  let subtotal = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.min(50, Number(item.quantity) || 1));

    if (isCustomItem(item)) {
      // Custom studio piece — clamp the client price into a safe range.
      let unit = Number(item.unitPriceCents);
      if (!Number.isFinite(unit) || unit <= 0) unit = Math.round(Number(item.priceLkr || 0) * 100);
      unit = Math.max(CUSTOM_MIN_CENTS, Math.min(CUSTOM_MAX_CENTS, Math.round(unit)));

      let customDesignId = item.customDesignId || null;
      if (!customDesignId && item.designSpec) {
        const design = await prisma.customDesign.create({
          data: {
            userId: userId || null,
            garmentType: item.designSpec.garmentType || item.designSpec.type || "tee",
            garmentColor: item.designSpec.garment || null,
            status: "ordered",
            totalCents: unit,
            spec: toJSON(item.designSpec) || "{}",
          },
        });
        customDesignId = design.id;
      }

      const lineTotal = unit * qty;
      subtotal += lineTotal;
      priced.push({
        variantId: null,
        customDesignId,
        unitPriceCents: unit,
        quantity: qty,
        lineTotalCents: lineTotal,
        productSnapshot: { name: item.name || "Custom ZERØ Piece", sku: "CUSTOM", size: item.size || null, color: item.color || null, custom: true },
      });
      continue;
    }

    const variant = await resolveVariant(item);
    if (!variant) throw ApiError.badRequest(`Unknown product: ${item.productSlug || item.variantId}`);

    const available = variant.inventory ? variant.inventory.quantityOnHand - variant.inventory.reserved : 9999;
    if (variant.inventory && available < qty) {
      throw ApiError.conflict(`Insufficient stock for ${variant.sku}`, { available, sku: variant.sku });
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
        slug: variant.product.slug,
      },
    });
  }

  return { priced, subtotal };
}

async function resolveCoupon(code, subtotal) {
  if (!code) return { discount: 0, coupon: null, freeShip: false };
  const coupon = await prisma.coupon.findUnique({ where: { code: String(code).toUpperCase() } });
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

function computeShipping(subtotal, shippingMethod, freeShip) {
  const baseShip = SHIPPING_RATES_CENTS[shippingMethod] ?? SHIPPING_RATES_CENTS.standard;
  if (freeShip) return 0;
  if (subtotal >= FREE_SHIPPING_THRESHOLD_CENTS && shippingMethod !== "express") return 0;
  return baseShip;
}

// ----------------------------------------------------------------------------
// Quote
// ----------------------------------------------------------------------------

export async function quote({ items, couponCode, shippingMethod }, ctx = {}) {
  const { subtotal } = await priceItems(items, ctx);
  const { discount, freeShip } = await resolveCoupon(couponCode, subtotal);
  const shipping = computeShipping(subtotal, shippingMethod, freeShip);
  const tax = 0;
  const total = Math.max(0, subtotal - discount) + shipping + tax;
  return { subtotalCents: subtotal, discountCents: discount, shippingCents: shipping, taxCents: tax, totalCents: total };
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------

function signatureOf(input) {
  const basis = JSON.stringify({
    email: input.email,
    items: (input.items || []).map((i) => [i.variantId || i.productSlug || i.name, i.size, i.color, i.quantity]),
    pay: input.paymentMethod,
  });
  return crypto.createHash("sha256").update(basis).digest("hex");
}

export async function createOrder(input, { userId, idempotencyKey } = {}) {
  // 1) Idempotency-Key header → return the original order.
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return shapeOrder(await fullOrder(existing.id));
  }

  // 2) Content-signature dedupe → block accidental double submits (last 3 min).
  const sig = signatureOf(input);
  const recent = await prisma.order.findFirst({
    where: { email: input.email, notes: { contains: sig }, placedAt: { gte: new Date(Date.now() - 3 * 60 * 1000) } },
    orderBy: { placedAt: "desc" },
  });
  if (recent) return shapeOrder(await fullOrder(recent.id));

  const { priced, subtotal } = await priceItems(input.items, { userId });
  const { discount, coupon, freeShip } = await resolveCoupon(input.couponCode, subtotal);
  const shipping = computeShipping(subtotal, input.shippingMethod, freeShip);
  const tax = 0;
  const total = Math.max(0, subtotal - discount) + shipping + tax;

  // Cash-on-delivery needs no upfront payment, so it goes straight to production.
  const isCod = input.paymentMethod === "cod";
  const initialStatus = isCod ? "in_production" : "awaiting_payment";
  const customer = input.customer || {};

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: userId || null,
        email: input.email,
        status: initialStatus,
        subtotalCents: subtotal,
        discountCents: discount,
        taxCents: tax,
        shippingCents: shipping,
        totalCents: total,
        shippingMethod: input.shippingMethod,
        couponId: coupon ? coupon.id : null,
        shippingAddress: toJSON(input.shippingAddress),
        billingAddress: toJSON(input.billingAddress || input.shippingAddress),
        customerName: customer.name || `${input.shippingAddress?.recipientName || ""}`.trim() || null,
        customerPhone: customer.phone || input.shippingAddress?.phone || null,
        notes: `sig:${sig}`,
        idempotencyKey: idempotencyKey || null,
        items: {
          create: priced.map((p) => ({
            variantId: p.variantId,
            customDesignId: p.customDesignId,
            unitPriceCents: p.unitPriceCents,
            quantity: p.quantity,
            lineTotalCents: p.lineTotalCents,
            productSnapshot: toJSON(p.productSnapshot),
          })),
        },
        payment: {
          create: {
            provider: input.paymentMethod,
            amountCents: total,
            status: "pending",
          },
        },
        statusHistory: { create: { toStatus: initialStatus, actor: "system", note: "Order placed" } },
      },
    });

    // Reserve stock for variant-backed lines.
    for (const line of priced) {
      if (line.variantId) {
        await tx.inventory.updateMany({
          where: { variantId: line.variantId },
          data: { reserved: { increment: line.quantity } },
        });
      }
    }

    // Record coupon redemption.
    if (coupon) {
      await tx.couponRedemption.create({
        data: { couponId: coupon.id, userId: userId || null, orderId: created.id, amountCents: discount },
      });
    }
    return created;
  });

  await enqueueEmail(input.email, EMAIL_TEMPLATES.ORDER_CONFIRMATION, {
    orderNumber: order.orderNumber,
    items: priced.map((p) => ({ name: p.productSnapshot.name, quantity: p.quantity, lineTotalCents: p.lineTotalCents })),
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: total,
  });

  await notify(userId, "order", "Order placed", `Order ${order.orderNumber} received. We'll confirm payment shortly.`, `/tracking.html?order=${order.orderNumber}`);

  return shapeOrder(await fullOrder(order.id));
}

// ----------------------------------------------------------------------------
// Status transitions (used by admin + payment confirmation)
// ----------------------------------------------------------------------------

const STATUS_EMAIL = {
  paid: EMAIL_TEMPLATES.PAYMENT_CONFIRMED,
  in_production: EMAIL_TEMPLATES.PRODUCTION_STARTED,
  shipped: EMAIL_TEMPLATES.ORDER_SHIPPED,
  delivered: EMAIL_TEMPLATES.ORDER_DELIVERED,
  refunded: EMAIL_TEMPLATES.REFUND_ISSUED,
};

export async function setOrderStatus(orderNumber, toStatus, { actor = "system", note } = {}) {
  if (!ORDER_STATUSES.includes(toStatus)) throw ApiError.badRequest("Invalid status");
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { shipment: true } });
  if (!order) throw ApiError.notFound("Order not found");
  if (order.status === toStatus) return shapeOrder(await fullOrder(order.id));

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: toStatus } });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus, actor, note: note || null },
    });

    // When shipped, ensure a shipment + tracking number exist.
    if (toStatus === "shipped") {
      const existing = await tx.shipment.findUnique({ where: { orderId: order.id } });
      if (!existing) {
        await tx.shipment.create({
          data: {
            orderId: order.id,
            method: order.shippingMethod,
            trackingNumber: generateTrackingNumber(),
            status: "shipped",
            shippedAt: new Date(),
            courier: order.shippingMethod === "express" ? "Pronto Express" : "SL Post",
            events: { create: { status: "shipped", description: "Handed to courier" } },
          },
        });
      } else {
        await tx.shipment.update({
          where: { orderId: order.id },
          data: { status: "shipped", shippedAt: new Date(), trackingNumber: existing.trackingNumber || generateTrackingNumber() },
        });
      }
    }
    if (toStatus === "delivered") {
      await tx.shipment.updateMany({ where: { orderId: order.id }, data: { status: "delivered", deliveredAt: new Date() } });
    }
  });

  const refreshed = await fullOrder(order.id);

  // Customer email + in-app notification on meaningful transitions.
  const template = STATUS_EMAIL[toStatus];
  if (template) {
    const payload = { orderNumber: order.orderNumber, amountCents: order.totalCents };
    if (toStatus === "shipped" && refreshed.shipment) {
      payload.trackingNumber = refreshed.shipment.trackingNumber;
      payload.courier = refreshed.shipment.courier;
    }
    await enqueueEmail(order.email, template, payload);
  }
  await notify(order.userId, "order", `Order ${toStatus.replace(/_/g, " ")}`, `Order ${order.orderNumber} is now ${toStatus.replace(/_/g, " ")}.`, `/tracking.html?order=${order.orderNumber}`);

  return shapeOrder(refreshed);
}

// ----------------------------------------------------------------------------
// Read / shape
// ----------------------------------------------------------------------------

function fullOrder(id) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payment: true,
      shipment: { include: { events: { orderBy: { createdAt: "asc" } } } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      coupon: true,
    },
  });
}

export function shapeOrder(o) {
  if (!o) return null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    email: o.email,
    status: o.status,
    step: STATUS_STEP[o.status] ?? 0,
    currency: o.currency,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    taxCents: o.taxCents,
    shippingCents: o.shippingCents,
    totalCents: o.totalCents,
    shippingMethod: o.shippingMethod,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    shippingAddress: fromJSON(o.shippingAddress, {}),
    billingAddress: fromJSON(o.billingAddress, {}),
    placedAt: o.placedAt,
    coupon: o.coupon ? o.coupon.code : null,
    items: (o.items || []).map((it) => ({
      ...fromJSON(it.productSnapshot, {}),
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      lineTotalCents: it.lineTotalCents,
      customDesignId: it.customDesignId,
    })),
    payment: o.payment
      ? {
          provider: o.payment.provider,
          method: o.payment.method,
          status: o.payment.status,
          amountCents: o.payment.amountCents,
          cardBrand: o.payment.cardBrand,
          cardLast4: o.payment.cardLast4,
          verifiedAt: o.payment.verifiedAt,
        }
      : null,
    shipment: o.shipment
      ? {
          method: o.shipment.method,
          courier: o.shipment.courier,
          trackingNumber: o.shipment.trackingNumber,
          status: o.shipment.status,
          shippedAt: o.shipment.shippedAt,
          deliveredAt: o.shipment.deliveredAt,
          events: o.shipment.events || [],
        }
      : null,
    statusHistory: (o.statusHistory || []).map((h) => ({ status: h.toStatus, note: h.note, at: h.createdAt })),
  };
}

export async function listOrders(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    include: { items: true, payment: true, shipment: true, statusHistory: { orderBy: { createdAt: "asc" } }, coupon: true },
  });
  return orders.map(shapeOrder);
}

export async function getOrder(orderNumber, userId) {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) throw ApiError.notFound("Order not found");
  if (order.userId && userId && order.userId !== userId) throw ApiError.forbidden();
  return shapeOrder(await fullOrder(order.id));
}

// Public tracking by order number (guest-safe; only non-sensitive fields).
export async function getTracking(orderNumber) {
  const order = await prisma.order.findUnique({
    where: { orderNumber: String(orderNumber).toUpperCase() },
    include: { items: true, shipment: { include: { events: { orderBy: { createdAt: "asc" } } } }, statusHistory: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw ApiError.notFound("Order not found");
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    step: STATUS_STEP[order.status] ?? 0,
    totalCents: order.totalCents,
    placedAt: order.placedAt,
    shippingMethod: order.shippingMethod,
    items: (order.items || []).map((it) => {
      const snap = fromJSON(it.productSnapshot, {});
      return { name: snap.name, quantity: it.quantity };
    }),
    shipment: order.shipment
      ? { trackingNumber: order.shipment.trackingNumber, courier: order.shipment.courier, status: order.shipment.status, events: order.shipment.events || [] }
      : null,
    statusHistory: (order.statusHistory || []).map((h) => ({ status: h.toStatus, note: h.note, at: h.createdAt })),
  };
}
