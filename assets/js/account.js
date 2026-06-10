/* ZERØ — Account dashboard */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, money, productCard, store, getWishlist, toast, initReveal } = window.ZERO;

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

  function panels() {
    const wl = getWishlist().map(window.ZERO.getProduct).filter(Boolean);
    const designs = store.get("zero_designs", []);
    const last = store.get("zero_last_order", null);
    return {
      dashboard: `
        <h2 class="h-md mb-m">Dashboard</h2>
        <div class="grid cols-3 mb-m">
          <div class="stat-card"><div class="n silver-text">${last ? 1 : 12}</div><div class="l">Total Orders</div></div>
          <div class="stat-card"><div class="n silver-text">${wl.length}</div><div class="l">Wishlist Items</div></div>
          <div class="stat-card"><div class="n silver-text">2,450</div><div class="l">Reward Points</div></div>
        </div>
        ${last ? `<div class="order-row"><div class="ph" style="width:48px;height:58px"></div><div><b>${last.order}</b><br><small class="muted">Placed recently · ${money(last.total)}</small></div><span class="status-pill prod">In Production</span><a href="tracking.html?order=${last.order}" class="link-underline">Track</a></div>` : `<p class="muted">No recent orders yet. <a href="shop.html" class="link-underline">Start shopping</a></p>`}`,
      orders: `<h2 class="h-md mb-m">Your Orders</h2>
        ${["ZRO-9F2K1","ZRO-7H4L8","ZRO-2M9P3"].map((o, i) => `<div class="order-row"><div class="ph" style="width:48px;height:58px"></div><div><b>${o}</b><br><small class="muted">${["Acid Wash Hoodie","Oversized Tee ×2","Couple Set"][i]} · ${money([8900,8400,15900][i])}</small></div><span class="status-pill ${i===0?"prod":"ship"}">${i===0?"In Production":"Delivered"}</span><a href="tracking.html" class="link-underline">Track</a></div>`).join("")}`,
      wishlist: `<h2 class="h-md mb-m">Wishlist</h2>${wl.length ? `<div class="grid cols-3 pgrid">${wl.map(productCard).join("")}</div>` : `<p class="muted">Your wishlist is empty. <a href="shop.html" class="link-underline">Discover pieces</a></p>`}`,
      designs: `<h2 class="h-md mb-m">Saved Designs</h2>${designs.length ? `<div class="grid cols-3">${designs.map(d => `<div class="checkout-card"><div class="ph" style="aspect-ratio:1;border-radius:6px;margin-bottom:14px" data-label="DESIGN"></div><b>${d.type}</b><br><small class="muted">${d.text ? '"'+d.text+'"' : "Image print"} · ${money(d.total)}</small><a href="customize.html" class="btn btn--ghost btn--block btn--sm" style="margin-top:12px"><span>Edit & Order</span></a></div>`).join("")}</div>` : `<p class="muted">No saved designs yet. <a href="customize.html" class="link-underline">Open the studio</a></p>`}`,
      addresses: `<h2 class="h-md mb-m">Saved Addresses</h2><div class="grid cols-2"><div class="checkout-card"><span class="status-pill ship" style="margin-bottom:12px;display:inline-block">Default</span><p>Nimal Perera<br>No. 24, Galle Road<br>Colombo 03, Western<br>00300 · Sri Lanka</p></div><div class="checkout-card flex center" style="justify-content:center;min-height:160px;border-style:dashed"><button class="link-underline">+ Add New Address</button></div></div>`,
      payments: `<h2 class="h-md mb-m">Payment Methods</h2><div class="grid cols-2"><div class="checkout-card flex between center"><div><b>Visa ···· 4291</b><br><small class="muted">Expires 09/28</small></div><span class="pay-icons"><span>VISA</span></span></div><div class="checkout-card flex center" style="justify-content:center;min-height:120px;border-style:dashed"><button class="link-underline">+ Add Card</button></div></div>`,
      rewards: `<h2 class="h-md mb-m">Loyalty & Referrals</h2><div class="grid cols-2 mb-m"><div class="stat-card"><div class="n silver-text">2,450</div><div class="l">ZERØ Points · Rs 2,450 value</div></div><div class="stat-card"><div class="n silver-text">Gold</div><div class="l">Membership Tier</div></div></div><div class="checkout-card"><p class="eyebrow mb-m">Refer A Friend</p><p class="muted mb-m">Share your code — you both get Rs 1,000 off.</p><div class="coupon-row"><input value="ZERO-NIMAL24" readonly><button class="btn btn--primary btn--sm" data-copy><span>Copy</span></button></div></div>`,
      settings: `<h2 class="h-md mb-m">Profile Settings</h2><div class="checkout-card" style="max-width:560px"><div class="field--row"><div class="field"><label>First Name</label><input value="Nimal"></div><div class="field"><label>Last Name</label><input value="Perera"></div></div><div class="field"><label>Email</label><input value="nimal@email.lk"></div><div class="field"><label>Phone</label><input value="077 123 4567"></div><button class="btn btn--primary" data-save-profile><span>Save Changes</span></button></div>`
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
    if (e.target.closest("[data-copy]")) { navigator.clipboard?.writeText("ZERO-NIMAL24"); toast("Referral code copied"); }
    if (e.target.closest("[data-save-profile]")) { e.preventDefault(); toast("Profile updated"); }
  });

  show((location.hash || "#dashboard").slice(1));
});
