// Analytics: ingest client events + compute the admin metrics summary
// (visitors, orders, revenue, conversion, top products, returning customers,
// cart abandonment).
import { prisma } from "../../lib/prisma.js";
import { fromJSON, toJSON } from "../../lib/json.js";

function deviceFromUA(ua = "") {
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) return "mobile";
  if (/tablet/i.test(ua)) return "tablet";
  return "desktop";
}

export async function track(event, ctx = {}) {
  const name = String(event.name || "").slice(0, 80);
  if (!name) return { ok: false };
  await prisma.analyticsEvent.create({
    data: {
      name,
      anonymousId: event.anonymousId ? String(event.anonymousId).slice(0, 64) : null,
      userId: ctx.userId || null,
      props: toJSON(event.props || {}),
      url: event.url ? String(event.url).slice(0, 500) : null,
      referrer: event.referrer ? String(event.referrer).slice(0, 500) : null,
      device: ctx.userAgent ? deviceFromUA(ctx.userAgent) : null,
      country: event.country || null,
    },
  });
  return { ok: true };
}

export async function getSummary({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [pageViews, addToCarts, checkoutsStarted, orders, paidOrders, events] = await Promise.all([
    prisma.analyticsEvent.findMany({ where: { name: "page_view", createdAt: { gte: since } }, select: { anonymousId: true } }),
    prisma.analyticsEvent.count({ where: { name: "add_to_cart", createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { name: "begin_checkout", createdAt: { gte: since } } }),
    prisma.order.findMany({ where: { placedAt: { gte: since } }, select: { id: true, userId: true, totalCents: true, status: true } }),
    prisma.order.findMany({ where: { placedAt: { gte: since }, status: { notIn: ["cancelled", "refunded"] } }, select: { totalCents: true } }),
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),
  ]);

  const visitors = new Set(pageViews.map((p) => p.anonymousId).filter(Boolean)).size || pageViews.length;
  const revenueCents = paidOrders.reduce((s, o) => s + o.totalCents, 0);
  const orderCount = orders.length;
  const conversionRate = visitors > 0 ? +((orderCount / visitors) * 100).toFixed(2) : 0;
  const aovCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0;

  // Cart abandonment: started checkout but didn't convert.
  const cartAbandonment = checkoutsStarted > 0 ? +(((checkoutsStarted - orderCount) / checkoutsStarted) * 100).toFixed(2) : 0;

  // Returning customers: users with >1 order overall.
  const userOrders = await prisma.order.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { not: null } } });
  const returningCustomers = userOrders.filter((u) => u._count._all > 1).length;
  const totalCustomers = userOrders.length;

  // Top products from order item snapshots.
  const items = await prisma.orderItem.findMany({
    where: { order: { placedAt: { gte: since } } },
    select: { productSnapshot: true, quantity: true, lineTotalCents: true },
  });
  const productMap = {};
  for (const it of items) {
    const snap = fromJSON(it.productSnapshot, {});
    const key = snap.name || "Unknown";
    if (!productMap[key]) productMap[key] = { name: key, units: 0, revenueCents: 0 };
    productMap[key].units += it.quantity;
    productMap[key].revenueCents += it.lineTotalCents;
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.units - a.units).slice(0, 8);

  // Revenue by day (last `days`).
  const byDay = {};
  const paidWithDate = await prisma.order.findMany({
    where: { placedAt: { gte: since }, status: { notIn: ["cancelled", "refunded"] } },
    select: { placedAt: true, totalCents: true },
  });
  for (const o of paidWithDate) {
    const d = o.placedAt.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + o.totalCents;
  }
  const revenueByDay = Object.entries(byDay).map(([date, cents]) => ({ date, revenueCents: cents })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    rangeDays: days,
    visitors,
    pageViews: pageViews.length,
    orders: orderCount,
    revenueCents,
    aovCents,
    conversionRate,
    addToCarts,
    checkoutsStarted,
    cartAbandonment,
    returningCustomers,
    totalCustomers,
    totalEvents: events,
    topProducts,
    revenueByDay,
  };
}
