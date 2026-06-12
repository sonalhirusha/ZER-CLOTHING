/* ZERØ — Product detail page */
document.addEventListener("DOMContentLoaded", async function () {
  const { $, $$, money, productCard, getProduct, addToCart, initReveal, toast } = window.ZERO;
  const PRODUCTS = await window.ZERO.loadProducts();
  const id = new URLSearchParams(location.search).get("id");
  const p = getProduct(id) || PRODUCTS[0];
  document.title = p.name + " — ZERØ CLOTHING";

  const colorName = (hex) => ({ "#0a0a0a": "Black", "#f5f5f5": "Bone", "#7d7d7d": "Ash", "#3a3a3a": "Charcoal" }[hex] || "Black");
  const sel = { size: null, color: p.colors[0], colorName: colorName(p.colors[0]), qty: 1 };
  const star = '<svg viewBox="0 0 24 24" fill="var(--silver)"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.3 3.2L7 14.2 2 9.4l7-.9z"/></svg>';

  $("#pdpCrumb").innerHTML = `<a href="store.html">Home</a><span>/</span><a href="shop.html">Shop</a><span>/</span><span>${p.name}</span>`;

  const views = ["FRONT", "BACK", "DETAIL", "ON BODY"];
  $("#pdp").innerHTML = `
    <div class="pdp-gallery">
      <div class="pdp-thumbs">${views.map((v, i) => `<div class="pdp-thumb ${i === 0 ? "active" : ""}" data-view="${i}"><div class="ph ph-fashion" data-label="${v}" data-img="${(i === 1 ? (p.img2 || p.img) : p.img) || ''}"></div></div>`).join("")}</div>
      <div class="pdp-main" id="pdpMain"><div class="pdp-badge">${p.badge ? `<span class="tag">${p.badge}</span>` : ""}</div><div class="ph ph-fashion ph--shimmer" data-label="${p.label} · FRONT" data-img="${p.img || ''}"></div></div>
    </div>
    <div class="pdp-info">
      <div class="card-cat">${p.cat}</div>
      <h1 class="pdp-title">${p.name}</h1>
      <div class="pdp-price">${money(p.price)} ${p.was ? `<span class="was">${money(p.was)}</span><span class="save">Save ${money(p.was - p.price)}</span>` : ""}</div>
      <div class="pdp-rate"><span class="stars">${star.repeat(5)}</span> ${p.rating} · ${p.reviews} reviews</div>
      <p class="muted" style="margin-bottom:24px">Heavyweight premium streetwear, cut for an elevated oversized silhouette. Printed to last and finished by hand in Colombo.</p>
      <div class="opt-block">
        <div class="opt-head"><span>Colour — <b id="colorLabel" style="color:#fff">${colorName(p.colors[0])}</b></span></div>
        <div class="color-row">${p.colors.map((c, i) => `<button class="swatch ${i === 0 ? "sel" : ""}" data-color="${c}" style="background:${c}" aria-label="${colorName(c)}"></button>`).join("")}</div>
      </div>
      <div class="opt-block">
        <div class="opt-head"><span>Size</span><a href="#sizeGuide" class="link-underline" data-size-guide>Size Guide</a></div>
        <div class="size-grid">${p.sizes.map(s => `<button class="size-btn ${(p.oos || []).includes(s) ? "oos" : ""}" data-size="${s}">${s}</button>`).join("")}</div>
      </div>
      <div class="opt-block">
        <div class="opt-head"><span>Quantity</span></div>
        <div class="qty" style="margin:0"><button data-pq="-1">−</button><span id="pqty">1</span><button data-pq="1">+</button></div>
      </div>
      <div class="pdp-actions">
        <button class="btn btn--primary btn--block" id="addBtn"><span>Add To Bag — ${money(p.price)}</span></button>
        <button class="icon-btn" data-fav="${p.id}" style="border:1px solid var(--line);width:54px;height:auto;border-radius:3px">${window.ZERO.ICON.heart}</button>
      </div>
      <div class="trust-row">
        <div><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"/></svg>Islandwide · Est. 2–4 days</div>
        <div><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>Secure payments</div>
        <div><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M4 12l5 5L20 6"/></svg>7-day returns</div>
      </div>
      <div class="accordion" id="pdpAcc"></div>
    </div>`;

  buildAccordion();
  bindPdp();
  renderRelated();
  renderReviews();
  buildSticky();
  initReveal();

  function buildAccordion() {
    const items = [
      ["Fabric & Details", "320 GSM premium combed cotton with a brushed interior. Pre-shrunk, garment-dyed and finished for a soft luxury hand-feel. Ribbed cuffs and double-stitched seams."],
      ["Care Instructions", "Machine wash cold inside-out. Do not bleach. Tumble dry low or hang dry. Iron reverse only — avoid printing the print. Wash with similar colours."],
      ["Shipping Information", "Free islandwide delivery over Rs 15,000. Speed Post 2–4 days, Express 1–2 days, Store pickup in Colombo 05. Custom orders ship within 48 hours."],
      ["Estimated Delivery", "Order today and receive in 2–4 working days with Speed Post, or 1–2 days with Express courier across all 25 districts."]
    ];
    $("#pdpAcc").innerHTML = items.map((it, i) => `
      <div class="acc-item ${i === 0 ? "open" : ""}"><button class="acc-head" data-acc>${it[0]}<span class="pm"></span></button>
      <div class="acc-body" style="${i === 0 ? "max-height:240px" : ""}"><div class="acc-body-inner">${it[1]}</div></div></div>`).join("");
  }


  function bindPdp() {
    const main = $("#pdpMain");
    main.addEventListener("click", () => main.classList.toggle("zoom"));
    main.addEventListener("mousemove", (e) => {
      if (!main.classList.contains("zoom")) return;
      const r = main.getBoundingClientRect();
      const ph = main.querySelector(".ph");
      ph.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });

    $$("[data-view]").forEach(t => t.addEventListener("click", () => {
      $$(".pdp-thumb").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      main.querySelector(".ph").setAttribute("data-label", p.label + " · " + views[+t.getAttribute("data-view")]);
    }));

    $$("[data-color]").forEach(b => b.addEventListener("click", () => {
      $$("[data-color]").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel"); sel.color = b.getAttribute("data-color");
      sel.colorName = colorName(sel.color); $("#colorLabel").textContent = sel.colorName;
    }));

    $$("[data-size]").forEach(b => b.addEventListener("click", () => {
      $$("[data-size]").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel"); sel.size = b.getAttribute("data-size");
    }));

    $("#pdp").addEventListener("click", (e) => {
      const pq = e.target.closest("[data-pq]");
      if (pq) { sel.qty = Math.max(1, sel.qty + +pq.getAttribute("data-pq")); $("#pqty").textContent = sel.qty; }
      const acc = e.target.closest("[data-acc]");
      if (acc) {
        const item = acc.closest(".acc-item"); const body = item.querySelector(".acc-body");
        const open = item.classList.toggle("open");
        body.style.maxHeight = open ? body.querySelector(".acc-body-inner").scrollHeight + 20 + "px" : "0";
      }
    });

    $("#addBtn").addEventListener("click", doAdd);
  }

  function doAdd() {
    if (!sel.size) { toast("Please select a size"); return; }
    addToCart({ id: p.id, name: p.name, price: p.price, label: p.label, size: sel.size, colorName: sel.colorName, qty: sel.qty });
  }

  function renderRelated() {
    const related = PRODUCTS.filter(x => x.id !== p.id && (x.collection === p.collection || x.cat === p.cat)).slice(0, 4);
    const fbt = PRODUCTS.filter(x => x.id !== p.id).sort((a, b) => b.popularity - a.popularity).slice(0, 4);
    $("#relatedGrid").innerHTML = (related.length ? related : PRODUCTS.slice(0, 4)).map(productCard).join("");
    $("#fbtGrid").innerHTML = fbt.map(productCard).join("");
  }

  function renderReviews() {
    $("#reviewSummary").innerHTML = `<span class="stars">${star.repeat(5)}</span> ${p.rating} out of 5 · ${p.reviews} reviews`;
    $("#pdpReviews").innerHTML = REVIEWS.slice(0, 3).map(r => `
      <div class="review-card"><span class="stars">${star.repeat(r.rating)}</span><p>"${r.text}"</p>
      ${r.photos ? `<div class="review-photos">${Array(r.photos).fill('<div class="ph" data-label="PHOTO"></div>').join("")}</div>` : ""}
      <div class="who"><div class="ava ph"></div><div><b>${r.name}</b><small>${r.city} · Verified Buyer</small></div></div></div>`).join("");
  }

  function buildSticky() {
    $("#stickyBuy").innerHTML = `<div style="flex:1"><b style="font-size:.9rem">${p.name}</b><div class="muted" style="font-size:.8rem">${money(p.price)}</div></div>
      <button class="btn btn--primary" id="stickyAdd"><span>Add To Bag</span></button>`;
    $("#stickyAdd").addEventListener("click", doAdd);
    const io = new IntersectionObserver(([e]) => $("#stickyBuy").classList.toggle("show", !e.isIntersecting), { threshold: 0 });
    io.observe($("#addBtn"));
  }
});
