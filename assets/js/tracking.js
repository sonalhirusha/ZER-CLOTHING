/* ZERØ — Order tracking */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, toast, money } = window.ZERO;
  const esc = window.ZERO.escapeText;
  const LABELS = { order: "Order Number", phone: "Phone Number", email: "Email Address" };
  const PLACE = { order: "ZRO-AB123", phone: "077 123 4567", email: "you@email.lk" };

  const STEPS = [
    ["Order Received", "Your order has been confirmed and queued."],
    ["In Production", "Garments cut and prepped in our Colombo studio."],
    ["Printing", "Your custom artwork is being printed and cured."],
    ["Quality Check", "Hand-inspected for print and stitch quality."],
    ["Shipped", "Handed to courier — tracking sent via SMS."],
    ["Delivered", "Enjoy your ZERØ piece. Tag @zero_clth7!"]
  ];

  $$("[data-track]").forEach(b => b.addEventListener("click", () => {
    $$("[data-track]").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    const k = b.getAttribute("data-track");
    $("#trackLabel").textContent = LABELS[k]; $("#trackInput").placeholder = PLACE[k];
  }));

  // Derive a believable progress step from how long ago the order was placed.
  // (Replaced by real shipment events once the backend API is connected.)
  function stepFromElapsed(ms) {
    const min = ms / 60000;
    const thresholds = [0, 1, 4, 9, 30, 1440]; // minutes to reach each step
    let step = 0;
    thresholds.forEach((t, i) => { if (min >= t) step = i; });
    return step;
  }

  const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-LK", { day: "numeric", month: "short" });

  function renderTimeline(order, current) {
    const placed = order.placedAt || Date.now();
    const dayMs = 86400000;
    const offsets = [0, 0, 1, 1, 2, 4];
    const itemsLine = (order.items || []).map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ");
    return `
      <div class="flex between center mb-m">
        <div><small class="muted" style="letter-spacing:.1em">ORDER</small><br><b style="font-size:1.1rem">${esc(order.order)}</b></div>
        <span class="status-pill ${current >= 4 ? "ship" : "prod"}">${STEPS[Math.min(current, 5)][0]}</span>
      </div>
      ${itemsLine ? `<p class="muted" style="font-size:.84rem;margin-bottom:18px">${esc(itemsLine)}${order.total ? ` · ${money(order.total)}` : ""}</p>` : ""}
      <div class="timeline">${STEPS.map((s, i) => {
        const cls = i < current ? "done" : i === current ? "active" : "pending";
        const node = i < current ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5"><path d="M5 12l5 5L20 6"/></svg>' : "";
        const date = i <= current ? `<small>${fmtDate(placed + offsets[i] * dayMs)}</small>` : "";
        return `<div class="tl-step ${cls}"><span class="node">${node}</span><b>${s[0]}</b><small>${s[1]}</small>${date}</div>`;
      }).join("")}</div>`;
  }

  function notFound(v) {
    $("#trackResult").innerHTML = `
      <div class="track-empty">
        <b>No order found for “${esc(v)}”.</b>
        <p class="muted">Double-check your order number, or contact us and we'll locate it for you.</p>
        <a href="contact.html" class="btn btn--ghost btn--sm"><span>Contact Support</span></a>
      </div>`;
  }

  function normalizeApiOrder(o) {
    return {
      order: o.orderNumber || o.order,
      total: typeof o.totalCents === "number" ? o.totalCents / 100 : o.total,
      items: (o.items || []).map(it => ({ name: (it.productSnapshot && it.productSnapshot.name) || it.name, qty: it.quantity || it.qty || 1 })),
      placedAt: o.placedAt ? new Date(o.placedAt).getTime() : Date.now()
    };
  }
  const API_STATUS_STEP = { created: 0, awaiting_payment: 0, paid: 1, in_production: 1, printing: 2, quality_check: 3, ready_to_ship: 3, shipped: 4, delivered: 5 };

  function localLookup(v) {
    const orders = window.ZERO.getOrders();
    const up = v.toUpperCase(), clean = v.replace(/\s/g, "");
    const found =
      orders.find(o => (o.order || "").toUpperCase() === up) ||
      orders.find(o => ((o.customer && o.customer.phone) || "").replace(/\s/g, "") === clean) ||
      orders.find(o => ((o.customer && o.customer.email) || "").toLowerCase() === v.toLowerCase());
    if (!found) { notFound(v); return; }
    $("#trackResult").innerHTML = renderTimeline(found, stepFromElapsed(Date.now() - (found.placedAt || Date.now())));
  }

  function lookup(value) {
    const v = (value || "").trim();
    if (!v) { toast("Enter your order details"); return; }
    if (window.ZERO.online()) {
      window.ZERO.api.get("/orders/" + encodeURIComponent(v.toUpperCase()) + "/tracking")
        .then(o => $("#trackResult").innerHTML = renderTimeline(normalizeApiOrder(o), API_STATUS_STEP[o.status] ?? 1))
        .catch(() => localLookup(v));
    } else {
      localLookup(v);
    }
  }

  $("#trackBtn").addEventListener("click", () => lookup($("#trackInput").value));
  $("#trackInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); lookup($("#trackInput").value); } });

  const orderParam = new URLSearchParams(location.search).get("order");
  if (orderParam) { $("#trackInput").value = orderParam; lookup(orderParam); }
});
