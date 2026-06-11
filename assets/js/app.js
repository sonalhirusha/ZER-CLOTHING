/* ZERØ CLOTHING — Core app: state, nav, cart, wishlist, UI */
(function () {
  "use strict";

  /* ---------- Utilities ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const money = (n) => "Rs " + Number(n).toLocaleString("en-LK");
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };
  window.ZERO = { $, $$, money, store };

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
      <a href="index.html" class="brand">ZER<b>Ø</b></a>
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
            <a href="index.html" class="brand">ZER<b>Ø</b></a>
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
          <span>© ${new Date().getFullYear()} ZERØ CLOTHING · Colombo, Sri Lanka</span>
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
  window.ZERO.getProduct = (id) => PRODUCTS.find(p => p.id === id);

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
    foot.innerHTML = `
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

  /* ---------- Scroll reveal ---------- */
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
      if ($("#cartDrawer")?.classList.contains("open")) closeCart();
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
        if (p) addToCart({ id: p.id, name: p.name, price: p.price, label: p.label, size: p.sizes.find(s => !(p.oos||[]).includes(s)) });
      }
      const rm = t.closest("[data-remove]");
      if (rm) { cart = cart.filter(c => c.key !== rm.getAttribute("data-remove")); saveCart(); }
      const qtyBtn = t.closest("[data-qty]");
      if (qtyBtn) {
        const item = cart.find(c => c.key === qtyBtn.getAttribute("data-key"));
        if (item) { item.qty += parseInt(qtyBtn.getAttribute("data-qty")); if (item.qty < 1) cart = cart.filter(c => c !== item); saveCart(); }
      }
      if (t.closest("[data-news]")) { e.preventDefault(); toast("Welcome to ZERØ — check your inbox"); }
      if (t.closest("[data-search]")) { toast("Search coming soon"); }
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
    bindEvents(); renderCart(); updateBadges(); initReveal(); applyImages(document); initA11y();
  });
})();
