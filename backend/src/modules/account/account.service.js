// Customer account: profile, password, addresses, wishlist, notifications,
// dashboard overview. All operations are scoped to the authenticated user.
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/hash.js";
import { ApiError } from "../../middleware/error.js";
import { publicUser } from "../auth/auth.service.js";
import { shapeProduct } from "../catalog/catalog.service.js";

// ---- Profile ---------------------------------------------------------------
export async function updateProfile(userId, data) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName ?? undefined,
      lastName: data.lastName ?? undefined,
      phone: data.phone ?? undefined,
      marketingOptIn: data.marketingOptIn ?? undefined,
    },
  });
  return publicUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.passwordHash) {
    const ok = await verifyPassword(user.passwordHash, currentPassword || "");
    if (!ok) throw ApiError.badRequest("Current password is incorrect");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return { ok: true };
}

// ---- Addresses -------------------------------------------------------------
export async function listAddresses(userId) {
  return prisma.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function createAddress(userId, data) {
  if (data.isDefaultShipping) await prisma.address.updateMany({ where: { userId }, data: { isDefaultShipping: false } });
  if (data.isDefaultBilling) await prisma.address.updateMany({ where: { userId }, data: { isDefaultBilling: false } });
  return prisma.address.create({ data: { ...data, userId } });
}

export async function updateAddress(userId, id, data) {
  const addr = await prisma.address.findUnique({ where: { id } });
  if (!addr || addr.userId !== userId) throw ApiError.notFound("Address not found");
  if (data.isDefaultShipping) await prisma.address.updateMany({ where: { userId }, data: { isDefaultShipping: false } });
  if (data.isDefaultBilling) await prisma.address.updateMany({ where: { userId }, data: { isDefaultBilling: false } });
  return prisma.address.update({ where: { id }, data });
}

export async function deleteAddress(userId, id) {
  const addr = await prisma.address.findUnique({ where: { id } });
  if (!addr || addr.userId !== userId) throw ApiError.notFound("Address not found");
  await prisma.address.delete({ where: { id } });
  return { ok: true };
}

// ---- Wishlist --------------------------------------------------------------
export async function listWishlist(userId) {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: { include: { category: true, variants: { include: { inventory: true } } } } },
  });
  return items.map((i) => shapeProduct(i.product));
}

export async function addWishlist(userId, productSlug) {
  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product) throw ApiError.notFound("Product not found");
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    update: {},
    create: { userId, productId: product.id },
  });
  return { ok: true };
}

export async function removeWishlist(userId, productSlug) {
  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product) return { ok: true };
  await prisma.wishlistItem.deleteMany({ where: { userId, productId: product.id } });
  return { ok: true };
}

// ---- Notifications ---------------------------------------------------------
export async function listNotifications(userId) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function markNotificationRead(userId, id) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) throw ApiError.notFound("Notification not found");
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  return { ok: true };
}

export async function markAllNotificationsRead(userId) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}

// ---- Dashboard overview ----------------------------------------------------
export async function overview(userId) {
  const [orders, wishlistCount, designsCount, loyalty, unread] = await Promise.all([
    prisma.order.findMany({ where: { userId }, select: { totalCents: true, status: true } }),
    prisma.wishlistItem.count({ where: { userId } }),
    prisma.customDesign.count({ where: { userId } }),
    prisma.loyaltyAccount.findUnique({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const totalSpent = orders.filter((o) => !["cancelled", "refunded"].includes(o.status)).reduce((s, o) => s + o.totalCents, 0);
  const points = loyalty ? loyalty.points : Math.floor(totalSpent / 100);
  const tier = points >= 500000 ? "Platinum" : points >= 250000 ? "Gold" : points >= 100000 ? "Silver" : "Bronze";
  return {
    orders: orders.length,
    totalSpentCents: totalSpent,
    wishlist: wishlistCount,
    designs: designsCount,
    points,
    tier,
    unreadNotifications: unread,
  };
}
