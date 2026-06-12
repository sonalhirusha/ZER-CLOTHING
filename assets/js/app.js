/* ZERØ CLOTHING — Core app: state, nav, cart, wishlist, UI */
(function () {
  "use strict";

  /* ---------- Inject premium enhancement stylesheet (additive) ---------- */
  try {
    if (!document.querySelector("link[data-zx-enhance]")) {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = "assets/css/enhance.css"; l.setAttribute("data-zx-enhance", "1");
      (document.head || document.documentElement).appendChild(l);
    }
  } catch (e) { /* non-fatal */ }

  /* ---------- Utilities ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const money = (n) => "Rs " + Number(n).toLocaleString("en-LK");
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };
  window.ZERO = { $, $$, money, store };

  /* ---------- API client (graceful static fallback) ----------
     The API base is resolved in this order:
       1. window.ZERO_API_BASE (set inline before app.js)
       2. <meta name="zero-api-base" content="https://api.example.com/api/v1">
       3. localhost dev → http://localhost:4000/api/v1
       4. otherwise "" = pure static mode (works on GitHub Pages with demo data) */
  function detectApiBase() {
    if (typeof window.ZERO_API_BASE === "string") return window.ZERO_API_BASE;
    const meta = document.querySelector('meta[name="zero-api-base"]');
    if (meta && meta.content) return meta.content.trim();
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "") return "http://localhost:4000/api/v1";
    return "";
  }
  window.ZERO.API_BASE = detectApiBase();
  const online = () => !!window.ZERO.API_BASE;
  window.ZERO.online = online;

  /* ---------- Session / token storage ---------- */
  const TOKEN_KEY = "zero_access", REFRESH_KEY = "zero_refresh", USER_KEY = "zero_user";
  const getToken = () => store.get(TOKEN_KEY, null);
  const setSession = (d) => {
    if (d && d.accessToken) store.set(TOKEN_KEY, d.accessToken);
    if (d && d.refreshToken) store.set(REFRESH_KEY, d.refreshToken);
    if (d && d.user) store.set(USER_KEY, d.user);
  };
  const clearSession = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY); };

  async function apiRequest(path, { method = "GET", body, headers, timeout = 12000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const token = getToken();
    try {
      const res = await fetch(window.ZERO.API_BASE + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(headers || {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error((data.error && data.error.message) || "Request failed"), { status: res.status, data });
      return data;
    } finally { clearTimeout(timer); }
  }

  // Auto-refresh the access token once on a 401, then retry.
  async function authed(path, opts = {}) {
    try { return await apiRequest(path, opts); }
    catch (e) {
      if (e.status === 401 && store.get(REFRESH_KEY, null)) {
        try { await window.ZERO.auth.refresh(); return await apiRequest(path, opts); }
        catch { clearSession(); }
      }
      throw e;
    }
  }

  // Multipart upload (receipts, artwork). Browser sets the multipart boundary.
  async function upload(path, formData) {
    const token = getToken();
    const res = await fetch(window.ZERO.API_BASE + path, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((data.error && data.error.message) || "Upload failed"), { status: res.status, data });
    return data;
  }

  window.ZERO.api = {
    get: (p) => authed(p),
    post: (p, body, headers) => authed(p, { method: "POST", body, headers }),
    patch: (p, body) => authed(p, { method: "PATCH", body }),
    del: (p) => authed(p, { method: "DELETE" }),
    upload
  };

  window.ZERO.auth = {
    isLoggedIn: () => !!getToken(),
    user: () => store.get(USER_KEY, null),
    getToken, setSession, clearSession,
    async signup(payload) { const d = await apiRequest("/auth/signup", { method: "POST", body: payload }); setSession(d); return d; },
    async login(payload) { const d = await apiRequest("/auth/login", { method: "POST", body: payload }); setSession(d); return d; },
    async logout() {
      const rt = store.get(REFRESH_KEY, null);
      try { await apiRequest("/auth/logout", { method: "POST", body: { refreshToken: rt } }); } catch { }
      clearSession();
    },
    async refresh() {
      const rt = store.get(REFRESH_KEY, null);
      if (!rt) throw new Error("no refresh token");
      const d = await apiRequest("/auth/refresh", { method: "POST", body: { refreshToken: rt } });
      setSession(d); return d;
    },
    me: () => apiRequest("/auth/me"),
    forgot: (email) => apiRequest("/auth/forgot-password", { method: "POST", body: { email } }),
    reset: (token, password) => apiRequest("/auth/reset-password", { method: "POST", body: { token, password } })
  };

  /* ---------- Small helpers ---------- */
  const COLOR_NAMES = { "#0a0a0a": "Black", "#000000": "Black", "#f5f5f5": "Bone", "#ffffff": "White", "#7d7d7d": "Ash", "#3a3a3a": "Charcoal", "#1a2942": "Navy" };
  const colorLabel = (hex) => COLOR_NAMES[hex] || "Black";
  window.ZERO.colorLabel = colorLabel;
  const escapeText = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.ZERO.escapeText = escapeText;
  const FREE_SHIP = 15000;

  /* ---------- Catalog registry (API with static fallback) ---------- */
  const STATIC_PRODUCTS = (typeof PRODUCTS !== "undefined") ? PRODUCTS : [];
  window.ZERO._products = STATIC_PRODUCTS.slice();
  function mapApiProduct(r) {
    return {
      id: r.id || r.slug, name: r.name, cat: r.cat || r.category || "", collection: r.collection || "",
      price: r.price, was: r.was || 0, rating: r.rating || 0, reviews: r.reviews || 0,
      colors: r.colors || [], sizes: r.sizes || [], oos: r.oos || [], tags: r.tags || [],
      badge: r.badge || "", popularity: r.popularity || 0, date: r.date || 0,
      label: r.label || String(r.name || "").toUpperCase(),
      img: r.img || `assets/images/${r.slug || r.id}-front.jpg`,
      img2: r.img2 || `assets/images/${r.slug || r.id}-back.jpg`,
      variants: r.variants || []
    };
  }
  let _catalogPromise = null;
  // Display real photos by convention: assets/images/<id>-front.jpg / -back.jpg.
  // applyImages() probes each file and silently keeps the styled placeholder if
  // the image isn't uploaded yet — so this is safe for every product.
  function withImages(p) {
    const id = p.id || p.slug;
    if (id && !p.img) p.img = `assets/images/${id}-front.jpg`;
    if (id && !p.img2) p.img2 = `assets/images/${id}-back.jpg`;
    return p;
  }
  window.ZERO._products = window.ZERO._products.map(withImages);
  window.ZERO.loadProducts = function () {
    if (_catalogPromise) return _catalogPromise;
    _catalogPromise = (async () => {
      if (online()) {
        try {
          const rows = await window.ZERO.api.get("/products");
          const list = Array.isArray(rows) ? rows : (rows.products || rows.data || []);
          if (list.length) window.ZERO._products = list.map(mapApiProduct);
        } catch (_) { /* keep static fallback */ }
      }
      return window.ZERO._products;
    })();
    return _catalogPromise;
  };

  /* ---------- Local order history (used until the API is connected) ---------- */
  window.ZERO.getOrders = () => store.get("zero_orders", []);
  window.ZERO.saveOrder = (o) => {
    const all = store.get("zero_orders", []);
    all.unshift(o); store.set("zero_orders", all); store.set("zero_last_order", o);
  };

  let cart = store.get("zero_cart", []);
  let wishlist = store.get("zero_wishlist", []);

  /* ---------- Toast ---------- */
  function toast(msg) {
    let wrap = $(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span>${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 2600);
  }
  window.ZERO.toast = toast;

  /* ---------- SVG icons ---------- */
  const ICON = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 21C7 17 4 14 4 9.5 4 6.5 6.5 5 9 6c1 .4 2 1.3 3 2.5C13 7.3 14 6.4 15 6c2.5-1 5 .5 5 3.5C20 14 17 17 12 21z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  window.ZERO.ICON = ICON;


  /* ---------- Header markup ---------- */
  function headerHTML(active) {
    const link = (href, label, key) =>
      `<a href="${href}" class="${active === key ? "active" : ""}">${label}</a>`;
    return `
    <div class="announce"><div class="marquee"><div class="marquee__track">
      ${Array(2).fill('<span>FREE ISLANDWIDE DELIVERY OVER RS 15,000&nbsp;&nbsp;·&nbsp;&nbsp;DESIGNED BY YOU&nbsp;&nbsp;·&nbsp;&nbsp;NEW ACID WASH DROP LIVE&nbsp;&nbsp;·&nbsp;&nbsp;CUSTOM PRINTS FROM RS 3,900&nbsp;&nbsp;·&nbsp;&nbsp;</span>').join("")}
    </div></div></div>
    <header class="site-header" id="siteHeader"><div class="container"><nav class="nav">
      <a href="store.html" class="brand">ZER<b>Ø</b></a>
      <div class="nav-links">
        ${link("shop.html","Shop","shop")}
        ${link("acid-wash.html","Acid Wash","acid")}
        ${link("couples.html","Couples","couples")}
        ${link("customize.html","Customize","customize")}
        ${link("tracking.html","Track Order","tracking")}
        ${link("contact.html","Contact","contact")}
      </div>
      <div class="nav-actions">
        <button class="icon-btn" aria-label="Search" data-search>${ICON.search}</button>
        <a class="icon-btn" href="account.html" aria-label="Account">${ICON.user}</a>
        <a class="icon-btn" href="account.html#wishlist" aria-label="Wishlist">${ICON.heart}<span class="badge" data-wish-badge style="display:none">0</span></a>
        <button class="icon-btn" aria-label="Cart" data-cart-open aria-controls="cartDrawer" aria-expanded="false">${ICON.bag}<span class="badge" data-cart-badge style="display:none">0</span></button>
        <button class="burger" aria-label="Menu" data-burger aria-controls="mobileNav" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </nav></div></header>
    <div class="mobile-nav" id="mobileNav">
      <a href="shop.html">Shop ${ICON.arrow}</a>
      <a href="acid-wash.html">Acid Wash ${ICON.arrow}</a>
      <a href="couples.html">Couples ${ICON.arrow}</a>
      <a href="customize.html">Customize ${ICON.arrow}</a>
      <a href="tracking.html">Track Order ${ICON.arrow}</a>
      <a href="contact.html">Contact ${ICON.arrow}</a>
      <a href="account.html">Account ${ICON.arrow}</a>
      <div class="m-socials"><a href="https://www.instagram.com/zero_clth7/" target="_blank">Instagram</a><a href="#">TikTok</a><a href="#">Facebook</a><a href="https://wa.me/${ZERO_WHATSAPP}">WhatsApp</a></div>
    </div>`;
  }


  /* ---------- Footer markup ---------- */
  function footerHTML() {
    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-cta" data-reveal>
          <p class="eyebrow mb-m">Designed By You</p>
          <h2 class="silver-text">Wear Your Vision.</h2>
          <a href="customize.html" class="btn btn--primary btn--lg mt-m"><span>Start Designing</span></a>
        </div>
        <div class="footer-grid">
          <div class="footer-brand">
            <a href="store.html" class="brand">ZER<b>Ø</b></a>
            <p>Premium custom streetwear made in Sri Lanka. Acid wash, oversized fits & couple collections — built for self expression.</p>
            <div class="newsletter">
              <input type="email" placeholder="Email for 10% off first order" aria-label="Email">
              <button data-news>Join</button>
            </div>
          </div>
          <div><h4>Shop</h4><ul>
            <li><a href="shop.html">All Products</a></li>
            <li><a href="acid-wash.html">Acid Wash</a></li>
            <li><a href="couples.html">Couple Sets</a></li>
            <li><a href="customize.html">Customize</a></li>
            <li><a href="shop.html">Accessories</a></li>
          </ul></div>
          <div><h4>Help</h4><ul>
            <li><a href="contact.html">Contact</a></li>
            <li><a href="contact.html#faq">FAQ</a></li>
            <li><a href="contact.html#shipping">Shipping</a></li>
            <li><a href="contact.html#returns">Returns</a></li>
            <li><a href="tracking.html">Track Order</a></li>
          </ul></div>
          <div><h4>Connect</h4><ul>
            <li><a href="https://www.instagram.com/zero_clth7/" target="_blank">Instagram · @zero_clth7</a></li>
            <li><a href="#">TikTok</a></li>
            <li><a href="#">Facebook</a></li>
            <li><a href="https://wa.me/${ZERO_WHATSAPP}">WhatsApp · 077 869 1065</a></li>
          </ul></div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ZERØ CLOTHING · Colombo, Sri Lanka · <span class="footer-credit">Designed by <b>ZEROC7™</b></span></span>
          <div class="pay-icons"><span>VISA</span><span>MASTERCARD</span><span>EZ CASH</span><span>BANK</span><span>COD</span></div>
        </div>
      </div>
    </footer>
    <a class="wa-float" href="https://wa.me/${ZERO_WHATSAPP}" aria-label="WhatsApp"><svg viewBox="0 0 32 32"><path d="M16 3C9 3 3.5 8.5 3.5 15.5c0 2.4.7 4.6 1.8 6.5L3 29l7.2-2.2c1.8 1 3.8 1.5 5.8 1.5 7 0 12.5-5.5 12.5-12.5S23 3 16 3zm0 22.7c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.3 1.3 1.3-4.1-.3-.4c-1-1.6-1.6-3.4-1.6-5.4C5.8 9.8 10.4 5.2 16 5.2s10.2 4.6 10.2 10.3S21.6 25.7 16 25.7zm5.8-7.7c-.3-.2-1.9-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-1.9-.9-3.1-1.7-4.4-3.8-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.6s-.7-1.7-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.5 3.8 6 5.3 2.2.9 3 1 4.1.9.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg></a>`;
  }


  /* ---------- Cart drawer markup ---------- */
  function drawerHTML() {
    return `
    <div class="overlay" data-overlay></div>
    <aside class="drawer" id="cartDrawer" aria-label="Cart" aria-hidden="true">
      <div class="drawer-head"><h3>Your Bag</h3><button class="icon-btn" data-cart-close>${ICON.close}</button></div>
      <div class="drawer-body" data-cart-body></div>
      <div class="drawer-foot" data-cart-foot></div>
    </aside>`;
  }

  /* ---------- Product card generator ---------- */
  function productCard(p) {
    const stars = '★★★★★';
    const tags = (p.tags || []).map(t => `<span class="tag ${t==='Sale'||t==='Bestseller'?'':'tag--ghost'}">${t}</span>`).join("");
    const fav = wishlist.includes(p.id) ? "active" : "";
    const price = p.was ? `${money(p.price)} <span class="was">${money(p.was)}</span>` : money(p.price);
    return `
    <article class="product-card" data-reveal>
      <div class="media">
        <a href="product.html?id=${p.id}" aria-label="${p.name}">
          <div class="ph ph--main ph--shimmer" data-label="${p.label}" data-img="${p.img || ''}"></div>
          <div class="ph ph--alt ph-fashion" data-label="${p.label} · BACK" data-img="${p.img2 || p.img || ''}"></div>
        </a>
        <div class="tags">${tags}</div>
        <button class="card-fav ${fav}" data-fav="${p.id}" aria-label="Wishlist">${ICON.heart}</button>
        <button class="qv-btn" data-quickview="${p.id}" aria-label="Quick view"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <div class="card-add"><button class="btn btn--primary btn--block btn--sm" data-quickadd="${p.id}"><span>Quick Add — ${money(p.price)}</span></button></div>
      </div>
      <div class="card-body">
        <div class="card-cat">${p.cat}</div>
        <a href="product.html?id=${p.id}"><h3 class="card-title">${p.name}</h3></a>
        <div class="card-price">${price}</div>
        <div class="flex center gap" style="margin-top:8px"><span class="stars" aria-label="${p.rating} stars">${stars.split('').map(()=>'<svg viewBox=\"0 0 24 24\"><path d=\"M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.3 3.2L7 14.2 2 9.4l7-.9z\"/></svg>').join('')}</span><small class="muted" style="font-size:.72rem">${p.rating} (${p.reviews})</small></div>
      </div>
    </article>`;
  }
  window.ZERO.productCard = productCard;
  window.ZERO.getProduct = (id) => window.ZERO._products.find(p => p.id === id);

  /* ---------- Auto real-image loader ---------- */
  // Any element <div class="ph" data-img="path/to.jpg"> becomes a real photo.
  // Falls back to the styled placeholder when data-img is empty/missing.
  function applyImages(root) {
    (root || document).querySelectorAll(".ph[data-img]").forEach(el => {
      const src = el.getAttribute("data-img");
      if (!src || el.classList.contains("ph--img")) return;
      const probe = new Image();
      probe.onload = () => { el.style.backgroundImage = `url("${src}")`; el.classList.add("ph--img", "ph--reveal"); };
      probe.onerror = () => {}; // keep placeholder if the file isn't there yet
      probe.src = src;
    });
  }
  window.ZERO.applyImages = applyImages;


  /* ---------- Cart logic ---------- */
  function saveCart() { store.set("zero_cart", cart); renderCart(); updateBadges(); }
  function addToCart(item) {
    const key = item.key || (item.id + (item.size||"") + (item.color||""));
    const found = cart.find(c => c.key === key);
    if (found) found.qty += item.qty || 1;
    else cart.push({ ...item, key, qty: item.qty || 1 });
    saveCart(); toast("Added to bag"); openCart();
  }
  window.ZERO.addToCart = addToCart;
  function cartCount() { return cart.reduce((s, c) => s + c.qty, 0); }
  function cartTotal() { return cart.reduce((s, c) => s + c.price * c.qty, 0); }
  window.ZERO.cartTotal = cartTotal;
  window.ZERO.getCart = () => cart;

  function renderCart() {
    const body = $("[data-cart-body]"), foot = $("[data-cart-foot]");
    if (!body) return;
    if (!cart.length) {
      body.innerHTML = `<div class="cart-empty"><p>Your bag is empty.</p><a href="shop.html" class="link-underline" style="margin-top:14px;display:inline-block">Start Shopping</a></div>`;
      foot.innerHTML = ""; return;
    }
    body.innerHTML = cart.map(c => `
      <div class="cart-item">
        <div class="thumb ph" data-label="${c.label||'ZERØ'}"></div>
        <div>
          <h4>${c.name}</h4>
          <div class="meta">${[c.size, c.colorName, c.note].filter(Boolean).join(" · ") || "One Size"}</div>
          <div class="qty"><button data-qty="-1" data-key="${c.key}">−</button><span>${c.qty}</span><button data-qty="1" data-key="${c.key}">+</button></div>
        </div>
        <div style="text-align:right">
          <div class="price">${money(c.price * c.qty)}</div>
          <button class="remove" data-remove="${c.key}">Remove</button>
        </div>
      </div>`).join("");
    const free = cartTotal() >= 15000;
    const sub = cartTotal();
    const remaining = Math.max(0, FREE_SHIP - sub);
    const pct = Math.min(100, Math.round((sub / FREE_SHIP) * 100));
    const progress = `
      <div class="ship-progress ${remaining === 0 ? "is-unlocked" : ""}">
        <div class="ship-progress__label">${remaining > 0
          ? `Add <b>${money(remaining)}</b> more for <b>FREE</b> shipping`
          : `<b>Free islandwide shipping unlocked</b>`}</div>
        <div class="ship-progress__bar"><span style="width:${pct}%"></span></div>
      </div>`;
    foot.innerHTML = progress + `
      <div class="cart-line"><span>Subtotal</span><b>${money(cartTotal())}</b></div>
      <div class="cart-line"><span>Shipping</span><b>${free ? "FREE" : "Calculated at checkout"}</b></div>
      <a href="checkout.html" class="btn btn--primary btn--block"><span>Checkout · ${money(cartTotal())}</span></a>
      <a href="shop.html" class="link-underline" style="display:block;text-align:center;margin-top:16px">Continue Shopping</a>`;
  }

  function updateBadges() {
    const cb = $("[data-cart-badge]"), wb = $("[data-wish-badge]");
    if (cb) { const n = cartCount(); cb.textContent = n; cb.style.display = n ? "grid" : "none"; }
    if (wb) { wb.textContent = wishlist.length; wb.style.display = wishlist.length ? "grid" : "none"; }
  }
  window.ZERO.updateBadges = updateBadges;


  /* ---------- Wishlist ---------- */
  function toggleWish(id) {
    const i = wishlist.indexOf(id);
    if (i > -1) { wishlist.splice(i, 1); toast("Removed from wishlist"); }
    else { wishlist.push(id); toast("Saved to wishlist"); }
    store.set("zero_wishlist", wishlist); updateBadges();
    $$(`[data-fav="${id}"]`).forEach(b => b.classList.toggle("active", wishlist.includes(id)));
  }
  window.ZERO.toggleWish = toggleWish;
  window.ZERO.getWishlist = () => wishlist;

  /* ---------- Drawer open/close ---------- */
  let lastFocused = null;
  function openCart() {
    lastFocused = document.activeElement;
    $(".overlay")?.classList.add("open");
    $("#cartDrawer")?.classList.add("open");
    $("#cartDrawer")?.setAttribute("aria-hidden", "false");
    $("[data-cart-open]")?.setAttribute("aria-expanded", "true");
    document.body.classList.add("no-scroll");
    setTimeout(() => $("[data-cart-close]")?.focus(), 60);
  }
  function closeCart() {
    $(".overlay")?.classList.remove("open");
    $("#cartDrawer")?.classList.remove("open");
    $("#cartDrawer")?.setAttribute("aria-hidden", "true");
    $("[data-cart-open]")?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("no-scroll");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  window.ZERO.openCart = openCart;

  /* ---------- Mobile nav open/close ---------- */
  function setMobileNav(open) {
    const burger = $("[data-burger]"), nav = $("#mobileNav");
    if (!nav) return;
    burger?.classList.toggle("open", open);
    nav.classList.toggle("open", open);
    document.body.classList.toggle("no-scroll", open);
    burger?.setAttribute("aria-expanded", String(open));
    if (open) setTimeout(() => nav.querySelector("a")?.focus?.(), 60);
    else burger?.focus?.();
  }
  window.ZERO.setMobileNav = setMobileNav;

  /* ---------- Search overlay (real, debounced, with empty state) ---------- */
  function ensureSearchUI() {
    if ($("#searchOverlay")) return;
    const el = document.createElement("div");
    el.id = "searchOverlay";
    el.className = "search-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Search products");
    el.innerHTML = `
      <div class="search-panel">
        <div class="search-bar">
          ${ICON.search}
          <input id="searchInput" type="search" placeholder="Search hoodies, tees, acid wash…" autocomplete="off" aria-label="Search products">
          <button class="icon-btn" data-search-close aria-label="Close search">${ICON.close}</button>
        </div>
        <div class="search-results" id="searchResults" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(el);
  }
  function openSearch() {
    ensureSearchUI();
    window.ZERO.loadProducts();
    $("#searchOverlay").classList.add("open");
    document.body.classList.add("no-scroll");
    setTimeout(() => $("#searchInput")?.focus(), 60);
    renderSearch("");
  }
  function closeSearch() {
    $("#searchOverlay")?.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }
  function searchCard(p) {
    return `<a class="search-card" href="product.html?id=${p.id}">
      <div class="ph ph-fashion" data-label="${p.label}" data-img="${p.img || ''}"></div>
      <div class="search-card__meta"><b>${escapeText(p.name)}</b><small class="muted">${escapeText(p.cat)}</small>
      <span class="search-price">${money(p.price)}</span></div></a>`;
  }
  function renderSearch(q) {
    const box = $("#searchResults"); if (!box) return;
    const list = window.ZERO._products || [];
    const term = (q || "").trim().toLowerCase();
    if (!term) {
      const popular = [...list].sort((a, b) => b.popularity - a.popularity).slice(0, 4);
      box.innerHTML = `<p class="search-hint">Popular right now</p><div class="search-grid">${popular.map(searchCard).join("")}</div>`;
      applyImages(box); return;
    }
    const hits = list.filter(p => (`${p.name} ${p.cat} ${p.collection} ${(p.tags || []).join(" ")}`).toLowerCase().includes(term));
    if (!hits.length) {
      const suggest = ["Acid Wash", "Oversized Tee", "Hoodie", "Couple Set"];
      box.innerHTML = `<div class="search-empty"><b>No matches for “${escapeText(q)}”.</b>
        <p class="muted">Try one of these instead:</p>
        <div class="chip-row">${suggest.map(s => `<span class="chip" data-search-suggest="${s}">${s}</span>`).join("")}</div></div>`;
      return;
    }
    box.innerHTML = `<p class="search-hint">${hits.length} result${hits.length !== 1 ? "s" : ""}</p><div class="search-grid">${hits.slice(0, 8).map(searchCard).join("")}</div>`;
    applyImages(box);
  }
  window.ZERO.openSearch = openSearch;

  /* ---------- Quick-view modal (conversion booster) ---------- */
  let qvState = { product: null, size: null, color: null };
  function ensureQuickViewUI() {
    if ($("#qvOverlay")) return;
    const el = document.createElement("div");
    el.id = "qvOverlay";
    el.className = "qv-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Quick view");
    el.innerHTML = `<div class="qv-modal" role="document">
      <button class="qv-close" data-qv-close aria-label="Close">${ICON.close}</button>
      <div class="qv-media" data-qv-media></div>
      <div class="qv-body" data-qv-body></div>
    </div>`;
    document.body.appendChild(el);
  }
  function renderQuickView() {
    const p = qvState.product; if (!p) return;
    const media = $("[data-qv-media]"), body = $("[data-qv-body]");
    media.innerHTML = `<div class="ph ph-fashion ph--shimmer" data-label="${escapeText(p.label)}" data-img="${p.img || ''}"></div>`;
    const priceHTML = p.was ? `${money(p.price)} <span class="was">${money(p.was)}</span>` : money(p.price);
    const sizes = (p.sizes || []).map(s => `<button class="qv-size ${(p.oos||[]).includes(s) ? 'oos' : ''} ${qvState.size === s ? 'active' : ''}" data-qv-size="${s}">${s}</button>`).join("");
    const colors = (p.colors || []).map(c => `<span class="qv-swatch ${qvState.color === c ? 'active' : ''}" data-qv-color="${c}" style="background:${c}" title="${colorLabel(c)}"></span>`).join("");
    body.innerHTML = `
      <span class="qv-cat">${escapeText(p.cat || '')}</span>
      <h3>${escapeText(p.name)}</h3>
      <div class="qv-price">${priceHTML}</div>
      <p class="muted" style="font-size:.9rem">${escapeText(p.description || 'Heavyweight premium streetwear, finished by hand in Colombo. Designed by you.')}</p>
      ${sizes ? `<div><div class="eyebrow" style="margin-bottom:8px">Size</div><div class="qv-opts" data-qv-sizes>${sizes}</div></div>` : ''}
      ${colors ? `<div><div class="eyebrow" style="margin-bottom:8px">Colour — <span data-qv-colorname>${colorLabel(qvState.color)}</span></div><div class="qv-opts">${colors}</div></div>` : ''}
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn--primary btn--block" data-qv-add><span>Add to Bag — ${money(p.price)}</span></button>
      </div>
      <a class="qv-view-full link-underline" href="product.html?id=${p.id}">View full details</a>`;
    applyImages(media);
  }
  function openQuickView(id) {
    const p = window.ZERO.getProduct(id); if (!p) { location.href = `product.html?id=${id}`; return; }
    qvState = { product: p, size: (p.sizes || []).find(s => !(p.oos || []).includes(s)) || null, color: (p.colors || [])[0] || null };
    ensureQuickViewUI();
    renderQuickView();
    $("#qvOverlay").classList.add("open");
    document.body.classList.add("no-scroll");
    setTimeout(() => $("[data-qv-close]")?.focus(), 60);
  }
  function closeQuickView() { $("#qvOverlay")?.classList.remove("open"); document.body.classList.remove("no-scroll"); }
  window.ZERO.openQuickView = openQuickView;

  /* ---------- Parallax + scroll progress (cinematic depth) ---------- */
  function initScrollFx() {
    if (!$(".zx-progress")) {
      const bar = document.createElement("div"); bar.className = "zx-progress"; document.body.appendChild(bar);
    }
    const bar = $(".zx-progress");
    const parallax = $$("[data-parallax], .hero__bg .ph");
    const onScroll = () => {
      const st = window.scrollY || document.documentElement.scrollTop;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (h > 0 ? (st / h) * 100 : 0) + "%";
      parallax.forEach(el => { el.style.transform = `translate3d(0, ${st * 0.18}px, 0) scale(1.12)`; });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Skeleton loaders (perceived performance) ---------- */
  function injectSkeletons() {
    const skelCard = `<div class="zx-skel-card"><div class="zx-skel zx-skel-img"></div><div class="zx-skel zx-skel-line"></div><div class="zx-skel zx-skel-line sm"></div></div>`;
    ["#featuredGrid", "#shopGrid", "#relatedGrid", "#fbtGrid"].forEach(sel => {
      const grid = $(sel);
      if (grid && !grid.children.length) grid.innerHTML = Array(sel === "#shopGrid" ? 6 : 4).fill(skelCard).join("");
    });
  }

  /* ---------- Back to top ---------- */
  function initToTop() {
    if ($(".to-top")) return;
    const btn = document.createElement("button");
    btn.className = "to-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    document.body.appendChild(btn);
    const onScroll = () => btn.classList.toggle("show", window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in");
        if (e.target.hasAttribute("data-stagger")) [...e.target.children].forEach((ch, i) => ch.style.transitionDelay = (i * 0.07) + "s");
        io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$("[data-reveal],[data-stagger]").forEach(el => io.observe(el));
    applyImages(document);
  }
  window.ZERO.initReveal = initReveal;

  /* ---------- Loader ---------- */
  function initLoader() {
    const l = $("#loader"); if (!l) return;
    window.addEventListener("load", () => setTimeout(() => l.classList.add("done"), 700));
    setTimeout(() => l.classList.add("done"), 2600);
  }

  /* ---------- Accessibility: skip link + keyboard support ---------- */
  function initA11y() {
    const main = document.querySelector("main");
    if (main) {
      if (!main.id) main.id = "main";
      main.setAttribute("tabindex", "-1");
      if (!document.querySelector(".skip-link")) {
        const skip = document.createElement("a");
        skip.className = "skip-link";
        skip.href = "#" + main.id;
        skip.textContent = "Skip to content";
        document.body.insertBefore(skip, document.body.firstChild);
      }
    }
    // Close overlays with the Escape key (keyboard navigation)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if ($("#searchOverlay")?.classList.contains("open")) closeSearch();
      else if ($("#qvOverlay")?.classList.contains("open")) closeQuickView();
      else if ($("#cartDrawer")?.classList.contains("open")) closeCart();
      else if ($("#mobileNav")?.classList.contains("open")) setMobileNav(false);
    });
  }


  /* ---------- Global event delegation ---------- */
  function bindEvents() {
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-cart-open]")) { openCart(); }
      if (t.closest("[data-cart-close]") || t.closest("[data-overlay]")) { closeCart(); }
      const burger = t.closest("[data-burger]");
      if (burger) { setMobileNav(!$("#mobileNav")?.classList.contains("open")); }
      const fav = t.closest("[data-fav]");
      if (fav) { e.preventDefault(); toggleWish(fav.getAttribute("data-fav")); }
      const qa = t.closest("[data-quickadd]");
      if (qa) {
        e.preventDefault();
        const p = window.ZERO.getProduct(qa.getAttribute("data-quickadd"));
        if (p) addToCart({ id: p.id, name: p.name, price: p.price, label: p.label, size: p.sizes.find(s => !(p.oos||[]).includes(s)), colorName: colorLabel((p.colors||[])[0]) });
      }
      const rm = t.closest("[data-remove]");
      if (rm) { cart = cart.filter(c => c.key !== rm.getAttribute("data-remove")); saveCart(); }
      const qtyBtn = t.closest("[data-qty]");
      if (qtyBtn) {
        const item = cart.find(c => c.key === qtyBtn.getAttribute("data-key"));
        if (item) { item.qty += parseInt(qtyBtn.getAttribute("data-qty")); if (item.qty < 1) cart = cart.filter(c => c !== item); saveCart(); }
      }
      const news = t.closest("[data-news]");
      if (news) {
        e.preventDefault();
        const input = news.closest(".newsletter")?.querySelector("input");
        const email = (input?.value || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("Enter a valid email"); input?.focus(); return; }
        news.disabled = true;
        const done = () => { toast("Welcome to ZERØ — your 10% code is on its way"); if (input) input.value = ""; news.disabled = false; };
        if (online()) window.ZERO.api.post("/newsletter", { email }).then(done).catch(done);
        else done();
      }
      if (t.closest("[data-search]")) { openSearch(); }
      if (t.closest("[data-search-close]") || t.closest("#searchOverlay") === t) { closeSearch(); }
      const suggest = t.closest("[data-search-suggest]");
      if (suggest) {
        const term = suggest.getAttribute("data-search-suggest");
        const input = $("#searchInput");
        if (input) { input.value = term; renderSearch(term); input.focus(); }
      }

      // Quick-view interactions
      const qv = t.closest("[data-quickview]");
      if (qv) { e.preventDefault(); openQuickView(qv.getAttribute("data-quickview")); }
      if (t.closest("[data-qv-close]") || (t.id === "qvOverlay")) { closeQuickView(); }
      const qvSize = t.closest("[data-qv-size]");
      if (qvSize) { qvState.size = qvSize.getAttribute("data-qv-size"); $$("[data-qv-size]").forEach(b => b.classList.toggle("active", b === qvSize)); }
      const qvColor = t.closest("[data-qv-color]");
      if (qvColor) {
        qvState.color = qvColor.getAttribute("data-qv-color");
        $$("[data-qv-color]").forEach(b => b.classList.toggle("active", b === qvColor));
        const cn = $("[data-qv-colorname]"); if (cn) cn.textContent = colorLabel(qvState.color);
      }
      if (t.closest("[data-qv-add]")) {
        const p = qvState.product;
        if (p) { addToCart({ id: p.id, name: p.name, price: p.price, label: p.label, size: qvState.size, colorName: colorLabel(qvState.color) }); closeQuickView(); }
      }
    });

    // Debounced live search
    let searchTimer = null;
    document.addEventListener("input", (e) => {
      if (e.target.id !== "searchInput") return;
      clearTimeout(searchTimer);
      const val = e.target.value;
      searchTimer = setTimeout(() => renderSearch(val), 180);
    });
    const header = $("#siteHeader");
    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 30);
      window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    }
    cart = store.get("zero_cart", []); window.ZERO.cart = cart;
  }

  /* ---------- Mount shared chrome ---------- */
  window.ZERO.mount = function (active) {
    const h = $("#site-header-mount"); if (h) h.innerHTML = headerHTML(active);
    const f = $("#site-footer-mount"); if (f) f.innerHTML = footerHTML();
    const d = $("#drawer-mount"); if (d) d.innerHTML = drawerHTML();
  };

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initLoader();
    if (window.ZERO_PAGE !== undefined) window.ZERO.mount(window.ZERO_PAGE);
    injectSkeletons();
    bindEvents(); renderCart(); updateBadges(); initReveal(); applyImages(document); initA11y(); initToTop();
    initScrollFx();
  });
})();
