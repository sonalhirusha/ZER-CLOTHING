/* ZERØ — Order tracking */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, toast } = window.ZERO;
  const LABELS = { order: "Order Number", phone: "Phone Number", email: "Email Address" };
  const PLACE = { order: "ZRO-AB123", phone: "077 123 4567", email: "you@email.lk" };

  const STEPS = [
    ["Order Received", "Your order has been confirmed and queued."],
    ["In Production", "Garments cut and prepped in our Colombo studio."],
    ["Printing", "Your custom artwork is being printed and cured."],
    ["Quality Check", "Hand-inspected for print and stitch quality."],
    ["Shipped", "Handed to courier — tracking sent via SMS."],
    ["Delivered", "Enjoy your ZERØ piece. Tag @zero.clothing!"]
  ];

  $$("[data-track]").forEach(b => b.addEventListener("click", () => {
    $$("[data-track]").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    const k = b.getAttribute("data-track");
    $("#trackLabel").textContent = LABELS[k]; $("#trackInput").placeholder = PLACE[k];
  }));

  function renderTimeline(orderId, current) {
    const dates = ["10 Jun", "10 Jun", "11 Jun", "11 Jun", "12 Jun", "14 Jun"];
    return `
      <div class="flex between center mb-m"><div><small class="muted" style="letter-spacing:.1em">ORDER</small><br><b style="font-size:1.1rem">${orderId}</b></div>
        <span class="status-pill ${current >= 4 ? "ship" : "prod"}">${STEPS[Math.min(current, 5)][0]}</span></div>
      <div class="timeline">${STEPS.map((s, i) => {
        const cls = i < current ? "done" : i === current ? "active" : "pending";
        const node = i < current ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5"><path d="M5 12l5 5L20 6"/></svg>' : "";
        return `<div class="tl-step ${cls}"><span class="node">${node}</span><b>${s[0]}</b><small>${s[1]}</small>${i <= current ? `<small>${dates[i]}</small>` : ""}</div>`;
      }).join("")}</div>`;
  }

  $("#trackBtn").addEventListener("click", () => {
    const v = $("#trackInput").value.trim();
    if (!v) { toast("Enter your order details"); return; }
    const last = window.ZERO.store.get("zero_last_order", null);
    const id = (last && last.order) || v.toUpperCase() || "ZRO-DEMO1";
    $("#trackResult").innerHTML = renderTimeline(id, 2);
  });

  // Auto-track from URL
  const orderParam = new URLSearchParams(location.search).get("order");
  if (orderParam) { $("#trackInput").value = orderParam; $("#trackResult").innerHTML = renderTimeline(orderParam, 2); }
});
