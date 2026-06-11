/* ZERØ — Account dashboard (driven by the customer's real local data;
   swaps to the live API automatically once ZERO.API_BASE is set). */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, money, productCard, store, getWishlist, toast, initReveal } = window.ZERO;
  const esc = window.ZERO.escapeText;

  const profile = store.get("zero_profile", { first: "", last: "", email: "", phone: "" });
  const fullName = `${profile.first || ""} ${profile.last || ""}`.trim();

  // Personalise the hero greeting.
  const hero = $(".page-hero h1");
  if (hero) hero.textContent = fullName ? `Hi, ${profile.first}` : "Hi there";

  function getOrders() { return window.ZERO.getOrders(); }
  function totalSpent() { return getOrders().reduce((s, o) => s + (o.total || 0), 0); }
  function points() { return Math.floor(totalSpent() / 100); }
  function tier() { const p = points(); return p >= 5000 ? "Platinum" : p >= 2500 ? "Gold" : p >= 1000 ? "Silver" : "Bronze"; }
  function orderStatus(o) { return (Date.now() - (o.placedAt || Date.now())) > 4 * 86400000 ? ["ship", "Delivered"] : ["prod", "In Production"]; }

  const NAV = [
    ["dashboard", "Dashboard", '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    ["orders", "Orders", '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'],
    ["wishlist", "Wishlist", '<path d="M12 21C7 17 4 14 4 9.5 4 6.5 6.5 5 9 6c1 .4 2 1.3 3 2.5C13 7.3 14 6.4 15 6c2.5-1 5 .5 5 3.5C20 14 17 17 12 21z"/>'],
    ["designs", "Saved Designs", '<path d="M12 19l7-7-3-3-7 7v3z"/><path d="M5 19h14"/>'],
    ["addresses", "Addresses", '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'],
    ["payments", "Payment Methods", '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>'],
    ["rewards", "Loyalty & Referrals", '<path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.3 3.2L7 14.2 2 9.4l7-.9z"/>'],
    ["settings", "Profile Settings", '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L16 2H8l-.8 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L3 9a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1L8 22h8l.8-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5L19 13a7 7 0 0 0 .1-1z"/>']
  ];

  $("#acctNav").innerHTML = NAV.map((n, i) => `<a href="#${n[0]}" data-tab="${n[0]}" class="${i === 0 ? "active" : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${n[2]}</svg>${n[1]}</a>`).join("");

  function orderRow(o) {
    const [cls, label] = orderStatus(o);
    const summary = (o.items || []).map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ") || "Order";
    return `<div class="order-row"><div class="ph" style="width:48px;height:58px"></div>
      <div><b>${esc(o.order)}</b><br><small class="muted">${esc(summary)} · ${money(o.total || 0)}</small></div>
      <span class="status-pill ${cls}">${label}</span>
      <a href="tracking.html?order=${encodeURIComponent(o.order)}" class="link-underline">Track</a></div>`;
  }

  function panels() {
    const wl = getWishlist().map(window.ZERO.getProduct).filter(Boolean);
    const designs = store.get("zero_designs", []);
    const orders = getOrders();
    const lastAddr = orders.find(o => o.address) ? orders.find(o => o.address).address : null;
    return {
      dashboard: `
        <h2 class="h-md mb-m">Dashboard</h2>
        <div class="grid cols-3 mb-m">
          <div class="stat-card"><div class="n silver-text">${orders.length}</div><div class="l">Total Orders</div></div>
          <div class="stat-card"><div class="n silver-text">${wl.length}</div><div class="l">Wishlist Items</div></div>
          <div class="stat-card"><div class="n silver-text">${points().toLocaleString("en-LK")}</div><div class="l">Reward Points</div></div>
        </div>
        ${orders.length ? orders.slice(0, 3).map(orderRow).join("") : `<p class="muted">No orders yet. <a href="shop.html" class="link-underline">Start shopping</a></p>`}`,
      orders: `<h2 class="h-md mb-m">Your Orders</h2>${orders.length ? orders.map(orderRow).join("") : `<p class="muted">You haven't placed any orders yet. <a href="shop.html" class="link-underline">Browse the shop</a></p>`}`,
      wishlist: `<h2 class="h-md mb-m">Wishlist</h2>${wl.length ? `<div class="grid cols-3 pgrid">${wl.map(productCard).join("")}</div>` : `<p class="muted">Your wishlist is empty. <a href="shop.html" class="link-underline">Discover pieces</a></p>`}`,
      designs: `<h2 class="h-md mb-m">Saved Designs</h2>${designs.length ? `<div class="grid cols-3">${designs.map(d => `<div class="checkout-card"><div class="ph" style="aspect-ratio:1;border-radius:6px;margin-bottom:14px" data-label="DESIGN"></div><b>${esc(d.type)}</b><br><small class="muted">${d.text ? '"' + esc(d.text) + '"' : "Image print"} · ${money(d.total)}</small><a href="customize.html" class="btn btn--ghost btn--block btn--sm" style="margin-top:12px"><span>Edit & Order</span></a></div>`).join("")}</div>` : `<p class="muted">No saved designs yet. <a href="customize.html" class="link-underline">Open the studio</a></p>`}`,
      addresses: `<h2 class="h-md mb-m">Saved Addresses</h2><div class="grid cols-2">${lastAddr ? `<div class="checkout-card"><span class="status-pill ship" style="margin-bottom:12px;display:inline-block">Most recent</span><p>${esc(lastAddr["First Name"] || "")} ${esc(lastAddr["Last Name"] || "")}<br>${esc(lastAddr["Address Line 1"] || "")}<br>${esc(lastAddr["City"] || "")}, ${esc(lastAddr["Province"] || "")}<br>${esc(lastAddr["Postal Code"] || "")} · Sri Lanka</p></div>` : `<div class="checkout-card"><p class="muted">No saved addresses yet — they'll appear here after your first order.</p></div>`}<div class="checkout-card flex center" style="justify-content:center;min-height:160px;border-style:dashed"><a href="checkout.html" class="link-underline">+ Add at checkout</a></div></div>`,
      payments: `<h2 class="h-md mb-m">Payment Methods</h2><div class="checkout-card"><p class="muted">For your security, ZERØ never stores raw card details. When the secure payment gateway is connected, your saved cards (as encrypted tokens) will appear here. Until then, you can pay by card, EZ Cash, bank transfer or cash on delivery at checkout.</p></div>`,
      rewards: `<h2 class="h-md mb-m">Loyalty & Referrals</h2><div class="grid cols-2 mb-m"><div class="stat-card"><div class="n silver-text">${points().toLocaleString("en-LK")}</div><div class="l">ZERØ Points · Rs ${points().toLocaleString("en-LK")} value</div></div><div class="stat-card"><div class="n silver-text">${tier()}</div><div class="l">Membership Tier</div></div></div><div class="checkout-card"><p class="eyebrow mb-m">Refer A Friend</p><p class="muted mb-m">Share your code — you both get Rs 1,000 off.</p><div class="coupon-row"><input id="refCode" value="ZERO-${(profile.first || "FRIEND").toUpperCase().slice(0, 8)}" readonly><button class="btn btn--primary btn--sm" data-copy><span>Copy</span></button></div></div>`,
      settings: `<h2 class="h-md mb-m">Profile Settings</h2><div class="checkout-card" style="max-width:560px"><div class="field--row"><div class="field"><label>First Name</label><input id="pfFirst" value="${esc(profile.first)}" placeholder="First name"></div><div class="field"><label>Last Name</label><input id="pfLast" value="${esc(profile.last)}" placeholder="Last name"></div></div><div class="field"><label>Email</label><input id="pfEmail" type="email" value="${esc(profile.email)}" placeholder="you@email.lk"></div><div class="field"><label>Phone</label><input id="pfPhone" type="tel" value="${esc(profile.phone)}" placeholder="077 123 4567"></div><button class="btn btn--primary" data-save-profile><span>Save Changes</span></button></div>`
    };
  }

  function show(tab) {
    const P = panels();
    $("#acctContent").innerHTML = `<div class="acct-panel show">${P[tab] || P.dashboard}</div>`;
    $$("#acctNav a").forEach(a => a.classList.toggle("active", a.getAttribute("data-tab") === tab));
    window.ZERO.updateBadges(); initReveal();
  }

  document.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { e.preventDefault(); show(tab.getAttribute("data-tab")); history.replaceState(null, "", "#" + tab.getAttribute("data-tab")); }
    if (e.target.closest("[data-copy]")) { const v = $("#refCode")?.value || ""; navigator.clipboard?.writeText(v); toast("Referral code copied"); }
    if (e.target.closest("[data-save-profile]")) {
      e.preventDefault();
      const next = { first: $("#pfFirst").value.trim(), last: $("#pfLast").value.trim(), email: $("#pfEmail").value.trim(), phone: $("#pfPhone").value.trim() };
      store.set("zero_profile", next);
      if (hero) hero.textContent = next.first ? `Hi, ${next.first}` : "Hi there";
      toast("Profile updated");
    }
  });

  show((location.hash || "#dashboard").slice(1));
});
