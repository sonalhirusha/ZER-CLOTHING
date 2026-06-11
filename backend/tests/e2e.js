// End-to-end smoke test against a running API (http://localhost:4000).
// Exercises every critical flow and prints PASS/FAIL per step.
const BASE = process.env.BASE || "http://localhost:4000/api/v1";
let pass = 0, fail = 0;
const results = [];

function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

async function api(path, { method = "GET", body, token, adminToken, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (!raw) h["Content-Type"] = "application/json";
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (adminToken) h["Authorization"] = `Bearer ${adminToken}`;
  const res = await fetch(BASE + path, { method, headers: h, body: raw ? body : body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const uniq = Date.now();
const email = `tester+${uniq}@example.com`;
const password = "Sup3rSecret!";

(async () => {
  // 1. Catalog
  let r = await api("/products");
  rec("Catalog: products listed", r.status === 200 && Array.isArray(r.json) && r.json.length > 0, `${r.json.length} products`);
  const product = r.json[0];
  const variant = product.variants[0];

  // 2. Signup
  r = await api("/auth/signup", { method: "POST", body: { email, password, firstName: "Test", lastName: "User", remember: true } });
  rec("Auth: signup", r.status === 201 && r.json.accessToken, r.json?.user?.email);
  let token = r.json.accessToken;
  let refreshToken = r.json.refreshToken;

  // 3. Me
  r = await api("/auth/me", { token });
  rec("Auth: /me with access token", r.status === 200 && r.json.email === email);

  // 4. Login
  r = await api("/auth/login", { method: "POST", body: { email, password, remember: true } });
  rec("Auth: login", r.status === 200 && r.json.accessToken, "tokens issued");
  token = r.json.accessToken;

  // 5. Forgot password (enqueues reset email)
  r = await api("/auth/forgot-password", { method: "POST", body: { email } });
  rec("Auth: forgot-password accepted", r.status === 200 && r.json.ok);

  // 6. Wishlist add/list
  r = await api("/account/wishlist", { method: "POST", token, body: { productSlug: product.slug } });
  rec("Account: add to wishlist", r.status === 200 && r.json.ok);
  r = await api("/account/wishlist", { token });
  rec("Account: wishlist persisted", r.status === 200 && r.json.length === 1);

  // 7. Address create
  const address = { recipientName: "Test User", phone: "0778691065", line1: "12 Galle Rd", city: "Colombo", district: "Colombo", province: "Western", postalCode: "00300", country: "LK" };
  r = await api("/account/addresses", { method: "POST", token, body: { ...address, label: "Home", isDefaultShipping: true } });
  rec("Account: save address", r.status === 201 && r.json.id);

  // 8. Quote
  r = await api("/checkout/quote", { method: "POST", token, body: { items: [{ variantId: variant.variantId, quantity: 2 }], shippingMethod: "standard" } });
  rec("Checkout: quote computed", r.status === 200 && r.json.totalCents > 0, `total ${r.json.totalCents}`);

  // 9. Place order
  r = await api("/orders", { method: "POST", token, headers: { "Idempotency-Key": `e2e-${uniq}` }, body: {
    email, paymentMethod: "card", shippingMethod: "standard",
    items: [{ variantId: variant.variantId, quantity: 2 }],
    shippingAddress: address, customer: { name: "Test User", phone: "0778691065" },
  } });
  rec("Order: created", r.status === 201 && r.json.orderNumber, r.json.orderNumber);
  const orderNumber = r.json.orderNumber;

  // 9b. Idempotency: same key returns same order
  r = await api("/orders", { method: "POST", token, headers: { "Idempotency-Key": `e2e-${uniq}` }, body: {
    email, paymentMethod: "card", shippingMethod: "standard",
    items: [{ variantId: variant.variantId, quantity: 2 }], shippingAddress: address,
  } });
  rec("Order: idempotency prevents duplicate", r.status === 201 && r.json.orderNumber === orderNumber);

  // 10. Order appears in customer dashboard
  r = await api("/orders", { token });
  rec("Dashboard: order listed for customer", r.status === 200 && r.json.some((o) => o.orderNumber === orderNumber));

  // 11. Invalid card rejected (checked on the still-unpaid order, before charging)
  r = await api("/payments/card", { method: "POST", body: { orderNumber, card: { number: "1234567890123456", expiry: "12/30", cvv: "123", name: "X" } } });
  rec("Payment: invalid card rejected", r.status === 422, `status ${r.status}`);

  // 11b. Card payment (valid Visa test number)
  r = await api("/payments/card", { method: "POST", token, body: { orderNumber, card: { number: "4242424242424242", expiry: "12/30", cvv: "123", name: "Test User" } } });
  rec("Payment: card accepted + brand detected", r.status === 200 && r.json.status === "paid" && r.json.cardBrand === "Visa", `${r.json.cardBrand} ****${r.json.cardLast4}`);

  // 12. Tracking
  r = await api(`/orders/${orderNumber}/tracking`);
  rec("Tracking: public lookup works", r.status === 200 && r.json.orderNumber === orderNumber, `status ${r.json.status}`);

  // 12b. Frontend contract: order by productSlug + size + color (what checkout.js sends)
  r = await api("/orders", { method: "POST", token, body: {
    email, paymentMethod: "cod", shippingMethod: "standard",
    items: [{ productSlug: product.slug, size: variant.size, color: variant.colorName, quantity: 1 }], shippingAddress: address,
  } });
  rec("Order: frontend contract (productSlug+size+color)", r.status === 201 && r.json.orderNumber, r.json.orderNumber);

  // 12c. Custom-studio order (designSpec creates a CustomDesign + line item)
  r = await api("/orders", { method: "POST", token, body: {
    email, paymentMethod: "cod", shippingMethod: "pickup",
    items: [{ custom: true, name: "Custom Tee", priceLkr: 3900, quantity: 1, designSpec: { garmentType: "tee", placement: "front", text: "ZERO" } }], shippingAddress: address,
  } });
  rec("Order: custom design line item", r.status === 201 && r.json.items.some((i) => i.custom));

  // 13. Custom design + reorder
  r = await api("/designs", { method: "POST", token, body: { garmentType: "tee", garmentColor: "Black", totalCents: 390000, spec: { text: "ZERO", placement: "front", scale: 1.2 } } });
  rec("Design: saved", r.status === 201 && r.json.id);
  const designId = r.json.id;
  r = await api(`/designs/${designId}/reorder`, { method: "POST", token });
  rec("Design: reorder duplicates", r.status === 201 && r.json.id !== designId);

  // 14. Contact -> ticket
  r = await api("/contact", { method: "POST", body: { name: "Test", email, subject: "Hi", message: "Is acid wash restocking?" } });
  rec("Support: ticket created", r.status === 201 && r.json.ticketNumber);

  // 15. Analytics event
  r = await api("/analytics/track", { method: "POST", body: { name: "page_view", anonymousId: "anon-1", url: "/" } });
  rec("Analytics: event ingested", r.status === 200 && r.json.ok);

  // 15b. Password reset end-to-end: pull emailed token from the outbox, reset, re-login.
  const { PrismaClient: PC } = await import("@prisma/client");
  const db = new PC();
  const resetJob = await db.emailQueue.findFirst({ where: { template: "password-reset", to: email }, orderBy: { createdAt: "desc" } });
  const resetTok = resetJob ? JSON.parse(resetJob.payload).token : null;
  r = await api("/auth/reset-password", { method: "POST", body: { token: resetTok, password: "BrandNew123!" } });
  rec("Auth: reset-password with emailed token", r.status === 200 && r.json.ok);
  r = await api("/auth/login", { method: "POST", body: { email, password: "BrandNew123!" } });
  rec("Auth: login with new password after reset", r.status === 200 && !!r.json.accessToken);
  await db.$disconnect();

  // 16. Admin login
  r = await api("/admin/login", { method: "POST", body: { email: process.env.SEED_ADMIN_EMAIL || "admin@zeroclothing.lk", password: process.env.SEED_ADMIN_PASSWORD || "Admin123!" } });
  rec("Admin: login", r.status === 200 && r.json.token, r.json?.admin?.role);
  const adminToken = r.json.token;

  // 17. Admin sees the order
  r = await api("/admin/orders", { adminToken });
  rec("Admin: order received in dashboard", r.status === 200 && r.json.some((o) => o.orderNumber === orderNumber));

  // 18. Admin advances status -> shipped (generates tracking number + email)
  r = await api(`/admin/orders/${orderNumber}/status`, { method: "POST", adminToken, body: { status: "shipped" } });
  rec("Admin: mark shipped + tracking number", r.status === 200 && r.json.shipment && r.json.shipment.trackingNumber, r.json?.shipment?.trackingNumber);

  // 19. Admin analytics summary
  r = await api("/admin/analytics", { adminToken });
  rec("Admin: analytics summary", r.status === 200 && typeof r.json.revenueCents === "number", `revenue ${r.json.revenueCents}`);

  // 20. Admin inventory low-stock + customers
  r = await api("/admin/customers", { adminToken });
  rec("Admin: customers list", r.status === 200 && r.json.some((c) => c.email === email));

  // 21. Email outbox actually processed (wait for worker kick)
  await new Promise((res) => setTimeout(res, 1500));
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const sent = await prisma.emailQueue.count({ where: { status: "sent" } });
  const queued = await prisma.emailQueue.count();
  rec("Email: messages sent via outbox", sent > 0, `${sent}/${queued} sent`);
  await prisma.$disconnect();

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("E2E crashed:", e); process.exit(2); });
