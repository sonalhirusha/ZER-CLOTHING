// Admin operations: auth + management of orders, customers, products,
// inventory, shipping, payments, analytics and support.
import { prisma } from "../../lib/prisma.js";
import { verifyPassword } from "../../lib/hash.js";
import { signAdminToken } from "../../lib/jwt.js";
import { fromJSON, toJSON } from "../../lib/json.js";
import { ApiError } from "../../middleware/error.js";
import { shapeOrder, setOrderStatus } from "../orders/orders.service.js";
import { shapeProduct } from "../catalog/catalog.service.js";

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function adminLogin({ email, password }) {
  const admin = await prisma.adminUser.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!admin || admin.status !== "active") throw ApiError.unauthorized("Invalid credentials");
  const ok = await verifyPassword(admin.passwordHash, password);
  if (!ok) throw ApiError.unauthorized("Invalid credentials");
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  const token = signAdminToken(admin);
  return { token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}

// ---- Orders ----------------------------------------------------------------
export async function listOrders({ status, q } = {}) {
  const where = {};
  if (status) where.status = status;
  if (q) where.OR = [{ orderNumber: { contains: q } }, { email: { contains: q } }, { customerName: { contains: q } }];
  const orders = await prisma.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    take: 200,
    include: { items: true, payment: true, shipment: true, coupon: true, statusHistory: { orderBy: { createdAt: "asc" } } },
  });
  return orders.map(shapeOrder);
}

export async function getOrder(orderNumber) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, payment: true, shipment: { include: { events: true } }, statusHistory: { orderBy: { createdAt: "asc" } }, coupon: true },
  });
  if (!order) throw ApiError.notFound("Order not found");
  return shapeOrder(order);
}

export async function updateOrderStatus(orderNumber, status, adminId, note) {
  return setOrderStatus(orderNumber, status, { actor: `admin:${adminId}`, note });
}

// ---- Customers -------------------------------------------------------------
export async function listCustomers({ q } = {}) {
  const where = {};
  if (q) where.OR = [{ email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }];
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { orders: true } } },
  });
  // total spend per user
  const result = [];
  for (const u of users) {
    const agg = await prisma.order.aggregate({
      where: { userId: u.id, status: { notIn: ["cancelled", "refunded"] } },
      _sum: { totalCents: true },
    });
    result.push({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      emailVerified: Boolean(u.emailVerifiedAt),
      status: u.status,
      orders: u._count.orders,
      totalSpentCents: agg._sum.totalCents || 0,
      createdAt: u.createdAt,
    });
  }
  return result;
}

export async function getCustomer(id) {
  const u = await prisma.user.findUnique({
    where: { id },
    include: { orders: { orderBy: { placedAt: "desc" } }, addresses: true },
  });
  if (!u) throw ApiError.notFound("Customer not found");
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    status: u.status,
    emailVerified: Boolean(u.emailVerifiedAt),
    createdAt: u.createdAt,
    addresses: u.addresses,
    orders: u.orders.map((o) => ({ orderNumber: o.orderNumber, status: o.status, totalCents: o.totalCents, placedAt: o.placedAt })),
  };
}

// ---- Products + inventory --------------------------------------------------
const productInclude = { category: true, variants: { include: { inventory: true }, orderBy: { position: "asc" } } };

export async function listProducts() {
  const products = await prisma.product.findMany({ include: productInclude, orderBy: { createdAt: "desc" } });
  return products.map((p) => ({ ...shapeProduct(p), status: p.status, basePriceCents: p.basePriceCents }));
}

export async function createProduct(data) {
  const slug = data.slug || slugify(data.name);
  let category = null;
  if (data.category) {
    category = await prisma.category.upsert({
      where: { slug: slugify(data.category) },
      update: {},
      create: { slug: slugify(data.category), name: data.category },
    });
  }
  const product = await prisma.product.create({
    data: {
      slug,
      name: data.name,
      description: data.description || null,
      categoryId: category ? category.id : null,
      basePriceCents: Math.round(Number(data.priceLkr || 0) * 100) || Number(data.basePriceCents || 0),
      compareAtCents: data.wasLkr ? Math.round(Number(data.wasLkr) * 100) : null,
      status: data.status || "active",
      badge: data.badge || null,
      tags: toJSON(data.tags || []),
      collection: data.collection || null,
      popularity: Number(data.popularity || 0),
    },
  });

  // Build variants from sizes × colors.
  const sizes = data.sizes && data.sizes.length ? data.sizes : ["One Size"];
  const colors = data.colors && data.colors.length ? data.colors : [{ hex: "#0a0a0a", name: "Black" }];
  let pos = 0;
  for (const size of sizes) {
    for (const c of colors) {
      const hex = typeof c === "string" ? c : c.hex;
      const name = typeof c === "string" ? "Black" : c.name;
      const sku = `${slug}-${slugify(size)}-${slugify(name)}`;
      const variant = await prisma.productVariant.create({
        data: { productId: product.id, sku, size, colorHex: hex, colorName: name, position: pos++ },
      });
      await prisma.inventory.create({ data: { variantId: variant.id, quantityOnHand: Number(data.stock || 25) } });
    }
  }
  return getAdminProduct(product.id);
}

async function getAdminProduct(id) {
  const p = await prisma.product.findUnique({ where: { id }, include: productInclude });
  return { ...shapeProduct(p), status: p.status, basePriceCents: p.basePriceCents };
}

export async function updateProduct(slug, data) {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) throw ApiError.notFound("Product not found");
  const updated = await prisma.product.update({
    where: { slug },
    data: {
      name: data.name ?? undefined,
      description: data.description ?? undefined,
      basePriceCents: data.priceLkr != null ? Math.round(Number(data.priceLkr) * 100) : data.basePriceCents ?? undefined,
      compareAtCents: data.wasLkr != null ? Math.round(Number(data.wasLkr) * 100) : undefined,
      status: data.status ?? undefined,
      badge: data.badge ?? undefined,
      collection: data.collection ?? undefined,
      tags: data.tags ? toJSON(data.tags) : undefined,
      popularity: data.popularity != null ? Number(data.popularity) : undefined,
    },
  });
  return getAdminProduct(updated.id);
}

export async function updateInventory(variantId, quantityOnHand) {
  const inv = await prisma.inventory.findUnique({ where: { variantId } });
  if (!inv) throw ApiError.notFound("Variant inventory not found");
  await prisma.inventory.update({ where: { variantId }, data: { quantityOnHand: Math.max(0, Number(quantityOnHand)) } });
  return { ok: true, variantId, quantityOnHand: Math.max(0, Number(quantityOnHand)) };
}

export async function lowStock() {
  const invs = await prisma.inventory.findMany({
    include: { variant: { include: { product: true } } },
  });
  return invs
    .filter((i) => i.quantityOnHand - i.reserved <= i.reorderLevel)
    .map((i) => ({
      variantId: i.variantId,
      sku: i.variant.sku,
      product: i.variant.product.name,
      size: i.variant.size,
      color: i.variant.colorName,
      available: i.quantityOnHand - i.reserved,
      reorderLevel: i.reorderLevel,
    }));
}

// ---- Shipping --------------------------------------------------------------
export async function updateShipment(orderNumber, { status, courier, trackingNumber, location, description }, adminId) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { shipment: true } });
  if (!order) throw ApiError.notFound("Order not found");

  let shipment = order.shipment;
  if (!shipment) {
    shipment = await prisma.shipment.create({
      data: { orderId: order.id, method: order.shippingMethod, status: status || "label_created", courier: courier || null, trackingNumber: trackingNumber || null },
    });
  } else {
    shipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: status || shipment.status,
        courier: courier ?? shipment.courier,
        trackingNumber: trackingNumber ?? shipment.trackingNumber,
        shippedAt: status === "shipped" && !shipment.shippedAt ? new Date() : shipment.shippedAt,
        deliveredAt: status === "delivered" ? new Date() : shipment.deliveredAt,
      },
    });
  }
  if (status) {
    await prisma.shipmentEvent.create({ data: { shipmentId: shipment.id, status, description: description || null, location: location || null } });
  }
  // Keep order status in sync for the big milestones.
  if (status === "shipped") await setOrderStatus(orderNumber, "shipped", { actor: `admin:${adminId}` });
  if (status === "delivered") await setOrderStatus(orderNumber, "delivered", { actor: `admin:${adminId}` });

  return getOrder(orderNumber);
}

// ---- Payments --------------------------------------------------------------
export async function listPayments({ status } = {}) {
  const where = {};
  if (status) where.status = status;
  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { order: { select: { orderNumber: true, email: true, totalCents: true } } },
  });
  return payments.map((p) => ({
    orderNumber: p.order.orderNumber,
    email: p.order.email,
    provider: p.provider,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    cardBrand: p.cardBrand,
    cardLast4: p.cardLast4,
    receiptAssetId: p.receiptAssetId,
    receiptUrl: p.receiptAssetId ? `/uploads/${p.receiptAssetId}` : null,
    verifiedAt: p.verifiedAt,
    createdAt: p.createdAt,
  }));
}

// ---- Real-time admin notifications (derived feed — new orders, payments,
// failed payments, new customers). Polled by the admin dashboard.
export async function notifications({ since } = {}) {
  const cutoff = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [orders, payments, customers] = await Promise.all([
    prisma.order.findMany({ where: { placedAt: { gte: cutoff } }, orderBy: { placedAt: "desc" }, take: 40, select: { orderNumber: true, email: true, totalCents: true, placedAt: true, customerName: true } }),
    prisma.payment.findMany({ where: { updatedAt: { gte: cutoff } }, orderBy: { updatedAt: "desc" }, take: 40, include: { order: { select: { orderNumber: true } } } }),
    prisma.user.findMany({ where: { createdAt: { gte: cutoff } }, orderBy: { createdAt: "desc" }, take: 40, select: { email: true, firstName: true, lastName: true, createdAt: true } }),
  ]);

  const feed = [];
  for (const o of orders) feed.push({ type: "order", level: "info", title: "New order", body: `${o.orderNumber} · ${money(o.totalCents)} · ${o.customerName || o.email}`, link: o.orderNumber, at: o.placedAt });
  for (const p of payments) {
    if (p.status === "paid") feed.push({ type: "payment", level: "success", title: "Payment received", body: `${p.order.orderNumber} · ${money(p.amountCents)}`, link: p.order.orderNumber, at: p.updatedAt });
    if (p.status === "failed") feed.push({ type: "payment_failed", level: "danger", title: "Failed payment", body: `${p.order.orderNumber} · card declined`, link: p.order.orderNumber, at: p.updatedAt });
  }
  for (const c of customers) feed.push({ type: "customer", level: "info", title: "New customer", body: `${[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}`, at: c.createdAt });

  feed.sort((a, b) => new Date(b.at) - new Date(a.at));
  const unread = feed.length;
  return { unread, notifications: feed.slice(0, 50) };
}

function money(cents) { return "Rs " + Number(Math.round((cents || 0) / 100)).toLocaleString("en-LK"); }
