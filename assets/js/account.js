/* ZERØ — Account dashboard.
   - Live mode (API connected): real signup/login/logout, profile, orders,
     wishlist, saved designs, addresses, notifications, password reset.
   - Static mode (no API): falls back to local demo data. */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, money, productCard, store, getWishlist, toast, initReveal, online, auth } = window.ZERO;
  const esc = window.ZERO.escapeText;
  const api = window.ZERO.api;
  const params = new URLSearchParams(location.search);

  if (params.get("verified") === "1") toast("Email verified — welcome to ZERØ");
  if (params.get("verified") === "0") toast("Verification link expired — request a new one");

  const hero = $(".page-hero h1");
  const setHero = (name) => { if (hero) hero.textContent = name ? `Hi, ${name}` : "Hi there"; };

  // -------- Static fallback (no backend connected) --------
  if (!online()) return renderStatic();

  // -------- Password reset deep-link (?reset=TOKEN) --------
  const resetToken = params.get("reset");
  if (resetToken) return renderReset(resetToken);

  // -------- Auth gate --------
  if (!auth.isLoggedIn()) return renderAuth();
  loadDashboard();

  // ====================================================================
  function renderAuth(mode = "login") {
    $("#acctNav") && ($("#acctNav").innerHTML = "");
    setHero("");
    const box = $("#acctContent");
    box.innerHTML = `
      <div class="acct-panel show" style="max-width:460px;margin:0 auto">
        <div class="auth-tabs" style="display:flex;gap:18px;margin-bottom:22px">
          <button class="link-underline ${mode === "login" ? "active" : ""}" data-auth-tab="login">Sign In</button>
          <button class="link-underline ${mode === "signup" ? "active" : ""}" data-auth-tab="signup">Create Account</button>
        </div>
        <form id="authForm" class="checkout-card" style="padding:26px">
          ${mode === "signup" ? `
            <div class="field--row">
              <div class="field"><label>First Name</label><input id="afFirst" required placeholder="First name"></div>
              <div class="field"><label>Last Name</label><input id="afLast" placeholder="Last name"></div>
            </div>
            <div class="field"><label>Phone</label><input id="afPhone" type="tel" placeholder="077 123 4567"></div>` : ""}
          <div class="field"><label>Email</label><input id="afEmail" type="email" required placeholder="you@email.lk"></div>
          <div class="field"><label>Password</label><input id="afPass" type="password" required minlength="8" placeholder="At least 8 characters"></div>
          <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--gray-400);margin-bottom:16px">
            <input type="checkbox" id="afRemember" checked> Remember me
          </label>
          <button class="btn btn--primary btn--block" type="submit"><span>${mode === "signup" ? "Create Account" : "Sign In"}</span></button>
          ${mode === "login" ? `<button type="button" class="link-underline" data-forgot style="display:block;margin:16px auto 0">Forgot password?</button>` : ""}
        </form>
      </div>`;

    $("#authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.classList.add("is-busy");
      try {
        const email = $("#afEmail").value.trim();
        const password = $("#afPass").value;
        const remember = $("#afRemember").checked;
        if (mode === "signup") {
          await auth.signup({ email, password, remember, firstName: $("#afFirst").value.trim(), lastName: $("#afLast").value.trim(), phone: $("#afPhone").value.trim() || undefined });
          toast("Account created — check your email to verify");
        } else {
          await auth.login({ email, password, remember });
          toast("Welcome back");
        }
        loadDashboard();
      } catch (err) {
        toast(err.message || "Something went wrong");
      } finally { btn.classList.remove("is-busy"); }
    });
  }

  function renderReset(token) {
    $("#acctNav") && ($("#acctNav").innerHTML = "");
    setHero("");
    $("#acctContent").innerHTML = `
      <div class="acct-panel show" style="max-width:440px;margin:0 auto">
        <h2 class="h-md mb-m">Choose a new password</h2>
        <form id="resetForm" class="checkout-card" style="padding:26px">
          <div class="field"><label>New Password</label><input id="rfPass" type="password" required minlength="8" placeholder="At least 8 characters"></div>
          <button class="btn btn--primary btn--block" type="submit"><span>Reset Password</span></button>
        </form>
      </div>`;
    $("#resetForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await auth.reset(token, $("#rfPass").value);
        toast("Password updated — please sign in");
        history.replaceState(null, "", "account.html");
        renderAuth("login");
      } catch (err) { toast(err.message || "Reset link invalid or expired"); }
    });
  }

  const NAV = [
    ["dashboard", "Dashboard"], ["orders", "Orders"], ["wishlist", "Wishlist"],
    ["designs", "Saved Designs"], ["addresses", "Addresses"], ["notifications", "Notifications"],
    ["settings", "Profile Settings"]
  ];

  let DATA = { user: null, overview: {}, orders: [], wishlist: [], designs: [], addresses: [], notifications: [] };

  async function loadDashboard() {
    try {
      const [user, overview, orders, wishlist, designs, addresses, notifications] = await Promise.all([
        auth.me(), api.get("/account/overview"), api.get("/orders"),
        api.get("/account/wishlist"), api.get("/designs"), api.get("/account/addresses"),
        api.get("/account/notifications")
      ]);
      DATA = { user, overview, orders, wishlist, designs, addresses, notifications };
      store.set("zero_user", user);
      setHero(user.firstName || "");
      $("#acctNav").innerHTML =
        NAV.map((n, i) => `<a href="#${n[0]}" data-tab="${n[0]}" class="${i === 0 ? "active" : ""}">${n[1]}${n[0] === "notifications" && overview.unreadNotifications ? ` <span class="badge">${overview.unreadNotifications}</span>` : ""}</a>`).join("") +
        `<a href="#logout" data-logout style="margin-top:10px;color:var(--gray-500)">Sign Out</a>`;
      show((location.hash || "#dashboard").slice(1));
    } catch (err) {
      auth.clearSession();
      renderAuth("login");
    }
  }

  const orderStep = { created: 0, awaiting_payment: 0, paid: 1, in_production: 1, printing: 2, quality_check: 3, ready_to_ship: 3, shipped: 4, delivered: 5, cancelled: 0, refunded: 1 };
  function orderRow(o) {
    const shipped = (orderStep[o.status] ?? 0) >= 4;
    const summary = (o.items || []).map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ") || "Order";
    return `<div class="order-row"><div class="ph" style="width:48px;height:58px"></div>
      <div><b>${esc(o.orderNumber)}</b><br><small class="muted">${esc(summary)} · ${money((o.totalCents || 0) / 100)}</small></div>
      <span class="status-pill ${shipped ? "ship" : "prod"}">${esc((o.status || "").replace(/_/g, " "))}</span>
      <a href="tracking.html?order=${encodeURIComponent(o.orderNumber)}" class="link-underline">Track</a></div>`;
  }

  function panels() {
    const o = DATA.overview;
    return {
      dashboard: `
        <h2 class="h-md mb-m">Dashboard</h2>
        <div class="grid cols-3 mb-m">
          <div class="stat-card"><div class="n silver-text">${o.orders || 0}</div><div class="l">Total Orders</div></div>
          <div class="stat-card"><div class="n silver-text">${o.wishlist || 0}</div><div class="l">Wishlist Items</div></div>
          <div class="stat-card"><div class="n silver-text">${(o.points || 0).toLocaleString("en-LK")}</div><div class="l">Reward Points · ${esc(o.tier || "Bronze")}</div></div>
        </div>
        ${DATA.orders.length ? DATA.orders.slice(0, 3).map(orderRow).join("") : `<p class="muted">No orders yet. <a href="shop.html" class="link-underline">Start shopping</a></p>`}`,
      orders: `<h2 class="h-md mb-m">Your Orders</h2>${DATA.orders.length ? DATA.orders.map(orderRow).join("") : `<p class="muted">You haven't placed any orders yet. <a href="shop.html" class="link-underline">Browse the shop</a></p>`}`,
      wishlist: `<h2 class="h-md mb-m">Wishlist</h2>${DATA.wishlist.length ? `<div class="grid cols-3 pgrid">${DATA.wishlist.map(productCard).join("")}</div>` : `<p class="muted">Your wishlist is empty. <a href="shop.html" class="link-underline">Discover pieces</a></p>`}`,
      designs: `<h2 class="h-md mb-m">Saved Designs</h2>${DATA.designs.length ? `<div class="grid cols-3">${DATA.designs.map(d => `<div class="checkout-card">${d.assets && d.assets[0] ? `<img src="${window.ZERO.API_BASE.replace(/\/api\/v1$/, "")}${d.assets[0].url}" style="aspect-ratio:1;width:100%;object-fit:cover;border-radius:6px;margin-bottom:14px">` : `<div class="ph" style="aspect-ratio:1;border-radius:6px;margin-bottom:14px" data-label="DESIGN"></div>`}<b>${esc((d.spec && d.spec.type) || d.garmentType)}</b><br><small class="muted">${money((d.totalCents || 0) / 100)}</small><button class="btn btn--ghost btn--block btn--sm" style="margin-top:12px" data-reorder="${d.id}"><span>Reorder</span></button></div>`).join("")}</div>` : `<p class="muted">No saved designs yet. <a href="customize.html" class="link-underline">Open the studio</a></p>`}`,
      addresses: `<h2 class="h-md mb-m">Saved Addresses</h2><div class="grid cols-2">${DATA.addresses.map(a => `<div class="checkout-card">${a.isDefaultShipping ? `<span class="status-pill ship" style="margin-bottom:12px;display:inline-block">Default</span>` : ""}<p><b>${esc(a.recipientName)}</b><br>${esc(a.line1)}${a.line2 ? "<br>" + esc(a.line2) : ""}<br>${esc(a.city)}, ${esc(a.district)}<br>${esc(a.province)} ${esc(a.postalCode)} · ${esc(a.phone)}</p><button class="link-underline" data-del-addr="${a.id}" style="margin-top:10px;color:var(--gray-500)">Remove</button></div>`).join("")}
        <form class="checkout-card" id="addrForm" style="border-style:dashed"><p class="eyebrow mb-m">Add Address</p>
          <div class="field"><label>Recipient Name</label><input id="naName" required></div>
          <div class="field"><label>Phone</label><input id="naPhone" required></div>
          <div class="field"><label>Address Line 1</label><input id="naLine1" required></div>
          <div class="field--row"><div class="field"><label>City</label><input id="naCity" required></div><div class="field"><label>District</label><input id="naDistrict" required></div></div>
          <div class="field--row"><div class="field"><label>Province</label><input id="naProvince" required></div><div class="field"><label>Postal Code</label><input id="naPostal" required></div></div>
          <button class="btn btn--primary btn--block btn--sm" type="submit"><span>Save Address</span></button>
        </form></div>`,
      notifications: `<h2 class="h-md mb-m">Notifications ${DATA.notifications.some(n => !n.readAt) ? `<button class="link-underline" data-read-all style="font-size:.7rem;margin-left:10px">Mark all read</button>` : ""}</h2>${DATA.notifications.length ? DATA.notifications.map(n => `<div class="order-row" style="opacity:${n.readAt ? .6 : 1}"><div><b>${esc(n.title)}</b><br><small class="muted">${esc(n.body || "")}</small></div>${n.link ? `<a href="${esc(n.link)}" class="link-underline">View</a>` : ""}</div>`).join("") : `<p class="muted">No notifications yet.</p>`}`,
      settings: `<h2 class="h-md mb-m">Profile Settings</h2><div class="checkout-card" style="max-width:560px">
        <div class="field--row"><div class="field"><label>First Name</label><input id="pfFirst" value="${esc(DATA.user.firstName || "")}"></div><div class="field"><label>Last Name</label><input id="pfLast" value="${esc(DATA.user.lastName || "")}"></div></div>
        <div class="field"><label>Email</label><input value="${esc(DATA.user.email)}" disabled></div>
        <div class="field"><label>Phone</label><input id="pfPhone" value="${esc(DATA.user.phone || "")}"></div>
        <button class="btn btn--primary" data-save-profile><span>Save Changes</span></button>
        <hr class="divider" style="margin:24px 0">
        <p class="eyebrow mb-m">Change Password</p>
        <div class="field"><label>Current Password</label><input id="cpCur" type="password"></div>
        <div class="field"><label>New Password</label><input id="cpNew" type="password" minlength="8"></div>
        <button class="btn btn--ghost" data-change-pass><span>Update Password</span></button>
        ${DATA.user.emailVerified ? "" : `<p class="muted" style="margin-top:18px;font-size:.82rem">Email not verified. <button class="link-underline" data-resend>Resend verification</button></p>`}
      </div>`
    };
  }

  function show(tab) {
    const P = panels();
    $("#acctContent").innerHTML = `<div class="acct-panel show">${P[tab] || P.dashboard}</div>`;
    $$("#acctNav a").forEach(a => a.classList.toggle("active", a.getAttribute("data-tab") === tab));
    window.ZERO.updateBadges(); initReveal(); window.ZERO.applyImages($("#acctContent"));
  }

  document.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { e.preventDefault(); show(tab.getAttribute("data-tab")); history.replaceState(null, "", "#" + tab.getAttribute("data-tab")); return; }
    if (e.target.closest("[data-auth-tab]")) { e.preventDefault(); renderAuth(e.target.closest("[data-auth-tab]").getAttribute("data-auth-tab")); return; }
    if (e.target.closest("[data-logout]")) { e.preventDefault(); await auth.logout(); toast("Signed out"); renderAuth("login"); return; }
    if (e.target.closest("[data-forgot]")) {
      e.preventDefault();
      const email = ($("#afEmail")?.value || "").trim();
      if (!email) return toast("Enter your email first");
      await auth.forgot(email).catch(() => {});
      toast("If that email exists, a reset link is on its way");
      return;
    }
    if (e.target.closest("[data-save-profile]")) {
      e.preventDefault();
      await api.patch("/account/profile", { firstName: $("#pfFirst").value.trim(), lastName: $("#pfLast").value.trim(), phone: $("#pfPhone").value.trim() }).catch((x) => toast(x.message));
      DATA.user.firstName = $("#pfFirst").value.trim(); setHero(DATA.user.firstName); toast("Profile updated");
      return;
    }
    if (e.target.closest("[data-change-pass]")) {
      e.preventDefault();
      try { await api.post("/account/change-password", { currentPassword: $("#cpCur").value, newPassword: $("#cpNew").value }); toast("Password updated — sign in again"); await auth.logout(); renderAuth("login"); }
      catch (x) { toast(x.message || "Could not update password"); }
      return;
    }
    if (e.target.closest("[data-resend]")) { e.preventDefault(); await window.ZERO.api.post("/auth/resend-verification", { email: DATA.user.email }).catch(() => {}); toast("Verification email sent"); return; }
    if (e.target.closest("[data-read-all]")) { e.preventDefault(); await api.post("/account/notifications/read-all").catch(() => {}); DATA.notifications.forEach(n => n.readAt = new Date().toISOString()); show("notifications"); return; }
    const del = e.target.closest("[data-del-addr]");
    if (del) { e.preventDefault(); await api.del("/account/addresses/" + del.getAttribute("data-del-addr")).catch(() => {}); DATA.addresses = await api.get("/account/addresses"); show("addresses"); toast("Address removed"); return; }
    const reorder = e.target.closest("[data-reorder]");
    if (reorder) { e.preventDefault(); try { await api.post("/designs/" + reorder.getAttribute("data-reorder") + "/reorder"); toast("Design duplicated to your saved designs"); DATA.designs = await api.get("/designs"); show("designs"); } catch (x) { toast(x.message); } return; }
  });

  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "addrForm") return;
    e.preventDefault();
    try {
      await api.post("/account/addresses", {
        recipientName: $("#naName").value.trim(), phone: $("#naPhone").value.trim(), line1: $("#naLine1").value.trim(),
        city: $("#naCity").value.trim(), district: $("#naDistrict").value.trim(), province: $("#naProvince").value.trim(),
        postalCode: $("#naPostal").value.trim(), country: "LK", isDefaultShipping: DATA.addresses.length === 0
      });
      DATA.addresses = await api.get("/account/addresses");
      show("addresses"); toast("Address saved");
    } catch (x) { toast(x.message || "Could not save address"); }
  });

  // ---------------- Static fallback (unchanged demo behaviour) ----------------
  function renderStatic() {
    const profile = store.get("zero_profile", { first: "", last: "", email: "", phone: "" });
    setHero(profile.first || "");
    const getOrders = () => window.ZERO.getOrders();
    const points = () => Math.floor(getOrders().reduce((s, o) => s + (o.total || 0), 0) / 100);
    $("#acctNav").innerHTML = [["dashboard", "Dashboard"], ["orders", "Orders"], ["wishlist", "Wishlist"], ["settings", "Profile Settings"]]
      .map((n, i) => `<a href="#${n[0]}" data-tab="${n[0]}" class="${i === 0 ? "active" : ""}">${n[1]}</a>`).join("");
    const orderRowL = (o) => `<div class="order-row"><div class="ph" style="width:48px;height:58px"></div><div><b>${esc(o.order)}</b><br><small class="muted">${money(o.total || 0)}</small></div><a href="tracking.html?order=${encodeURIComponent(o.order)}" class="link-underline">Track</a></div>`;
    const show2 = (tab) => {
      const orders = getOrders();
      const wl = getWishlist().map(window.ZERO.getProduct).filter(Boolean);
      const P = {
        dashboard: `<h2 class="h-md mb-m">Dashboard</h2><div class="grid cols-3 mb-m"><div class="stat-card"><div class="n silver-text">${orders.length}</div><div class="l">Orders</div></div><div class="stat-card"><div class="n silver-text">${wl.length}</div><div class="l">Wishlist</div></div><div class="stat-card"><div class="n silver-text">${points()}</div><div class="l">Points</div></div></div>${orders.length ? orders.slice(0, 3).map(orderRowL).join("") : `<p class="muted">No orders yet. <a href="shop.html" class="link-underline">Start shopping</a></p>`}`,
        orders: `<h2 class="h-md mb-m">Your Orders</h2>${orders.length ? orders.map(orderRowL).join("") : `<p class="muted">No orders yet.</p>`}`,
        wishlist: `<h2 class="h-md mb-m">Wishlist</h2>${wl.length ? `<div class="grid cols-3 pgrid">${wl.map(productCard).join("")}</div>` : `<p class="muted">Your wishlist is empty.</p>`}`,
        settings: `<h2 class="h-md mb-m">Profile Settings</h2><div class="checkout-card" style="max-width:560px"><div class="field--row"><div class="field"><label>First Name</label><input id="pfFirst" value="${esc(profile.first)}"></div><div class="field"><label>Last Name</label><input id="pfLast" value="${esc(profile.last)}"></div></div><div class="field"><label>Email</label><input id="pfEmail" value="${esc(profile.email)}"></div><div class="field"><label>Phone</label><input id="pfPhone" value="${esc(profile.phone)}"></div><button class="btn btn--primary" data-save-profile><span>Save Changes</span></button></div>`
      };
      $("#acctContent").innerHTML = `<div class="acct-panel show">${P[tab] || P.dashboard}</div>`;
      $$("#acctNav a").forEach(a => a.classList.toggle("active", a.getAttribute("data-tab") === tab));
      initReveal();
    };
    document.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-tab]");
      if (tab) { e.preventDefault(); show2(tab.getAttribute("data-tab")); history.replaceState(null, "", "#" + tab.getAttribute("data-tab")); }
      if (e.target.closest("[data-save-profile]")) {
        e.preventDefault();
        store.set("zero_profile", { first: $("#pfFirst").value.trim(), last: $("#pfLast").value.trim(), email: $("#pfEmail").value.trim(), phone: $("#pfPhone").value.trim() });
        setHero($("#pfFirst").value.trim()); toast("Profile updated");
      }
    });
    show2((location.hash || "#dashboard").slice(1));
  }
});
