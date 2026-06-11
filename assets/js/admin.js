/* ZERØ — Admin dashboard (standalone). Talks to the live API with an admin token. */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const root = $("#adminRoot");
  const money = (cents) => "Rs " + Number(Math.round((cents || 0) / 100)).toLocaleString("en-LK");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TOKEN = "zero_admin_token";

  function apiBase() {
    if (typeof window.ZERO_API_BASE === "string") return window.ZERO_API_BASE;
    const meta = document.querySelector('meta[name="zero-api-base"]');
    if (meta && meta.content) return meta.content.trim();
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "") return "http://localhost:4000/api/v1";
    return "";
  }
  const BASE = apiBase();
  const token = () => localStorage.getItem(TOKEN);

  function toast(msg) {
    const wrap = $(".toast-wrap");
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span>${esc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 2600);
  }

  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((data.error && data.error.message) || "Request failed"), { status: res.status });
    return data;
  }

  if (!BASE) { root.innerHTML = `<div class="admin-login"><div class="checkout-card" style="padding:28px"><h2 class="h-md">Admin</h2><p class="muted">No API configured. Set <code>&lt;meta name="zero-api-base"&gt;</code> in admin.html or run the backend locally.</p></div></div>`; return; }
  if (!token()) renderLogin(); else renderShell("analytics");

  function renderLogin() {
    root.innerHTML = `
      <div class="admin-login">
        <a class="brand" style="font-size:1.8rem;display:block;margin-bottom:18px">ZER<b>Ø</b> · Admin</a>
        <form class="checkout-card" id="loginForm" style="padding:28px">
          <div class="field"><label>Email</label><input id="aEmail" type="email" required value="admin@zeroclothing.lk"></div>
          <div class="field"><label>Password</label><input id="aPass" type="password" required placeholder="••••••••"></div>
          <button class="btn btn--primary btn--block" type="submit"><span>Sign In</span></button>
        </form>
      </div>`;
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const d = await api("/admin/login", { method: "POST", body: { email: $("#aEmail").value.trim(), password: $("#aPass").value } });
        localStorage.setItem(TOKEN, d.token);
        renderShell("analytics");
      } catch (err) { toast(err.message || "Login failed"); }
    });
  }

  const TABS = [["analytics", "Analytics"], ["orders", "Orders"], ["payments", "Payments"], ["customers", "Customers"], ["products", "Products"], ["inventory", "Inventory"], ["tickets", "Support"]];

  function renderShell(active) {
    root.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-side">
          <a class="brand">ZER<b>Ø</b> Admin</a>
          ${TABS.map(t => `<a data-tab="${t[0]}" class="${t[0] === active ? "active" : ""}">${t[1]}</a>`).join("")}
          <a data-logout style="margin-top:20px;color:var(--gray-600)">Sign Out</a>
        </aside>
        <main class="admin-main" id="adminMain"><p class="muted">Loading…</p></main>
      </div>`;
    $$("[data-tab]").forEach(a => a.addEventListener("click", () => renderShell(a.getAttribute("data-tab"))));
    $("[data-logout]").addEventListener("click", () => { localStorage.removeItem(TOKEN); renderLogin(); });
    load(active);
  }
  function $$(s) { return [...document.querySelectorAll(s)]; }

  async function load(tab) {
    const main = $("#adminMain");
    try {
      if (tab === "analytics") return renderAnalytics(main);
      if (tab === "orders") return renderOrders(main);
      if (tab === "payments") return renderPayments(main);
      if (tab === "customers") return renderCustomers(main);
      if (tab === "products") return renderProducts(main);
      if (tab === "inventory") return renderInventory(main);
      if (tab === "tickets") return renderTickets(main);
    } catch (err) {
      if (err.status === 401) { localStorage.removeItem(TOKEN); renderLogin(); return; }
      main.innerHTML = `<p class="muted">Error: ${esc(err.message)}</p>`;
    }
  }

  async function renderAnalytics(main) {
    const a = await api("/admin/analytics");
    main.innerHTML = `<h1 class="admin-title">Analytics · last ${a.rangeDays} days</h1>
      <div class="admin-cards">
        <div class="admin-card"><div class="n silver-text">${money(a.revenueCents)}</div><div class="l">Revenue</div></div>
        <div class="admin-card"><div class="n">${a.orders}</div><div class="l">Orders</div></div>
        <div class="admin-card"><div class="n">${a.visitors}</div><div class="l">Visitors</div></div>
        <div class="admin-card"><div class="n">${a.conversionRate}%</div><div class="l">Conversion</div></div>
        <div class="admin-card"><div class="n">${money(a.aovCents)}</div><div class="l">Avg Order</div></div>
        <div class="admin-card"><div class="n">${a.cartAbandonment}%</div><div class="l">Cart Abandonment</div></div>
        <div class="admin-card"><div class="n">${a.returningCustomers}</div><div class="l">Returning Customers</div></div>
        <div class="admin-card"><div class="n">${a.totalCustomers}</div><div class="l">Total Customers</div></div>
      </div>
      <h2 class="h-md mb-m">Top Products</h2>
      <table><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>
        ${(a.topProducts || []).map(p => `<tr><td>${esc(p.name)}</td><td>${p.units}</td><td>${money(p.revenueCents)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">No sales yet</td></tr>`}
      </tbody></table>`;
  }

  const STATUSES = ["created", "awaiting_payment", "paid", "in_production", "printing", "quality_check", "ready_to_ship", "shipped", "delivered", "cancelled", "refunded", "on_hold"];

  async function renderOrders(main) {
    const orders = await api("/admin/orders");
    main.innerHTML = `<h1 class="admin-title">Orders (${orders.length})</h1>
      <table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>
      ${orders.map(o => `<tr>
        <td><b>${esc(o.orderNumber)}</b><br><small class="muted">${new Date(o.placedAt).toLocaleDateString()}</small></td>
        <td>${esc(o.customerName || o.email)}<br><small class="muted">${esc(o.email)}</small></td>
        <td>${money(o.totalCents)}</td>
        <td><span class="pill">${esc(o.payment ? o.payment.status : "—")}</span></td>
        <td><span class="pill">${esc((o.status || "").replace(/_/g, " "))}</span></td>
        <td class="row-actions">
          <select data-status="${esc(o.orderNumber)}">${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        </td></tr>`).join("")}
      </tbody></table>`;
    $$("[data-status]").forEach(sel => sel.addEventListener("change", async () => {
      try { await api(`/admin/orders/${sel.getAttribute("data-status")}/status`, { method: "POST", body: { status: sel.value } }); toast("Status updated → " + sel.value); }
      catch (e) { toast(e.message); }
    }));
  }

  async function renderPayments(main) {
    const payments = await api("/admin/payments");
    main.innerHTML = `<h1 class="admin-title">Payments (${payments.length})</h1>
      <table><thead><tr><th>Order</th><th>Method</th><th>Amount</th><th>Status</th><th>Receipt</th><th>Action</th></tr></thead><tbody>
      ${payments.map(p => `<tr>
        <td>${esc(p.orderNumber)}</td>
        <td>${esc(p.method || p.provider)}${p.cardLast4 ? `<br><small class="muted">${esc(p.cardBrand)} ****${esc(p.cardLast4)}</small>` : ""}</td>
        <td>${money(p.amountCents)}</td>
        <td><span class="pill">${esc(p.status)}</span></td>
        <td>${p.receiptUrl ? `<a class="link-underline" target="_blank" href="${BASE.replace(/\/api\/v1$/, "")}${esc(p.receiptUrl)}">View</a>` : "—"}</td>
        <td class="row-actions">
          ${p.status !== "paid" ? `<button class="btn btn--ghost btn--sm" data-verify="${esc(p.orderNumber)}"><span>Verify</span></button>` : ""}
          ${p.status === "paid" ? `<button class="btn btn--ghost btn--sm" data-refund="${esc(p.orderNumber)}"><span>Refund</span></button>` : ""}
        </td></tr>`).join("")}
      </tbody></table>`;
    $$("[data-verify]").forEach(b => b.addEventListener("click", async () => { try { await api(`/admin/payments/${b.getAttribute("data-verify")}/verify`, { method: "POST" }); toast("Payment verified"); renderPayments(main); } catch (e) { toast(e.message); } }));
    $$("[data-refund]").forEach(b => b.addEventListener("click", async () => { try { await api(`/admin/payments/${b.getAttribute("data-refund")}/refund`, { method: "POST" }); toast("Refund issued"); renderPayments(main); } catch (e) { toast(e.message); } }));
  }

  async function renderCustomers(main) {
    const customers = await api("/admin/customers");
    main.innerHTML = `<h1 class="admin-title">Customers (${customers.length})</h1>
      <table><thead><tr><th>Name</th><th>Email</th><th>Orders</th><th>Spent</th><th>Verified</th></tr></thead><tbody>
      ${customers.map(c => `<tr><td>${esc([c.firstName, c.lastName].filter(Boolean).join(" ") || "—")}</td><td>${esc(c.email)}</td><td>${c.orders}</td><td>${money(c.totalSpentCents)}</td><td>${c.emailVerified ? "✓" : "—"}</td></tr>`).join("")}
      </tbody></table>`;
  }

  async function renderProducts(main) {
    const products = await api("/admin/products");
    main.innerHTML = `<h1 class="admin-title">Products (${products.length})</h1>
      <table><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Variants</th></tr></thead><tbody>
      ${products.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.cat)}</td><td>${money(p.basePriceCents)}</td><td><span class="pill">${esc(p.status)}</span></td><td>${(p.variants || []).length}</td></tr>`).join("")}
      </tbody></table>
      <h2 class="h-md" style="margin:26px 0 14px">Add Product</h2>
      <form id="prodForm" class="checkout-card" style="max-width:520px;padding:22px">
        <div class="field"><label>Name</label><input id="pName" required></div>
        <div class="field--row"><div class="field"><label>Category</label><input id="pCat" placeholder="Oversized Tees"></div><div class="field"><label>Price (Rs)</label><input id="pPrice" type="number" required></div></div>
        <div class="field"><label>Sizes (comma)</label><input id="pSizes" value="S,M,L,XL"></div>
        <div class="field"><label>Stock per variant</label><input id="pStock" type="number" value="25"></div>
        <button class="btn btn--primary btn--block" type="submit"><span>Create Product</span></button>
      </form>`;
    $("#prodForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("/admin/products", { method: "POST", body: {
          name: $("#pName").value.trim(), category: $("#pCat").value.trim() || undefined,
          priceLkr: Number($("#pPrice").value), sizes: $("#pSizes").value.split(",").map(s => s.trim()).filter(Boolean),
          stock: Number($("#pStock").value)
        } });
        toast("Product created"); renderProducts(main);
      } catch (err) { toast(err.message); }
    });
  }

  async function renderInventory(main) {
    const low = await api("/admin/inventory/low-stock");
    main.innerHTML = `<h1 class="admin-title">Inventory · low stock (${low.length})</h1>
      <table><thead><tr><th>Product</th><th>SKU</th><th>Size / Color</th><th>Available</th><th>Set</th></tr></thead><tbody>
      ${low.length ? low.map(i => `<tr><td>${esc(i.product)}</td><td>${esc(i.sku)}</td><td>${esc(i.size || "")} ${esc(i.color || "")}</td><td>${i.available}</td>
        <td class="row-actions"><input type="number" value="${i.available}" data-qty="${esc(i.variantId)}" style="width:80px"><button class="btn btn--ghost btn--sm" data-set="${esc(i.variantId)}"><span>Save</span></button></td></tr>`).join("") : `<tr><td colspan="5" class="muted">All variants are well stocked.</td></tr>`}
      </tbody></table>`;
    $$("[data-set]").forEach(b => b.addEventListener("click", async () => {
      const id = b.getAttribute("data-set");
      const qty = Number($(`[data-qty="${id}"]`).value);
      try { await api(`/admin/inventory/${id}`, { method: "POST", body: { quantityOnHand: qty } }); toast("Stock updated"); renderInventory(main); } catch (e) { toast(e.message); }
    }));
  }

  async function renderTickets(main) {
    const tickets = await api("/admin/tickets");
    main.innerHTML = `<h1 class="admin-title">Support Tickets (${tickets.length})</h1>
      ${tickets.map(t => `<div class="checkout-card" style="padding:18px;margin-bottom:14px">
        <div class="row-actions" style="justify-content:space-between"><b>${esc(t.ticketNumber)} · ${esc(t.subject)}</b><span class="pill">${esc(t.status)}</span></div>
        <p class="muted" style="font-size:.8rem;margin:6px 0">${esc(t.email)}</p>
        ${(t.messages || []).map(m => `<p style="font-size:.85rem;border-left:2px solid var(--line);padding-left:10px;margin:6px 0"><small class="muted">${esc(m.author)}:</small> ${esc(m.body)}</p>`).join("")}
        <div class="row-actions" style="margin-top:10px"><input data-reply="${esc(t.id)}" placeholder="Reply…" style="flex:1"><button class="btn btn--primary btn--sm" data-send="${esc(t.id)}"><span>Send</span></button></div>
      </div>`).join("") || `<p class="muted">No tickets.</p>`}`;
    $$("[data-send]").forEach(b => b.addEventListener("click", async () => {
      const id = b.getAttribute("data-send");
      const body = $(`[data-reply="${id}"]`).value.trim();
      if (!body) return;
      try { await api(`/admin/tickets/${id}/reply`, { method: "POST", body: { body, status: "resolved" } }); toast("Reply sent"); renderTickets(main); } catch (e) { toast(e.message); }
    }));
  }
})();
