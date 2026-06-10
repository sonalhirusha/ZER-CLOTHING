/* ZERØ — Shop: filtering & sorting */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, productCard, initReveal } = window.ZERO;

  const params = new URLSearchParams(location.search);
  const state = {
    cats: new Set(params.get("cat") ? [params.get("cat")] : []),
    sizes: new Set(),
    colors: new Set(),
    collections: new Set(params.get("collection") ? [params.get("collection")] : []),
    maxPrice: 20000,
    availability: new Set(),
    sort: "popular"
  };

  const SORTS = [
    ["popular", "Most Popular"], ["newest", "Newest"], ["best", "Best Selling"],
    ["low", "Price: Low to High"], ["high", "Price: High to Low"]
  ];

  function buildFilters() {
    const checkbox = (group, val, label) => `
      <label class="filter-opt"><input type="checkbox" data-filter="${group}" value="${val}"
        ${state[group]?.has?.(val) ? "checked" : ""}><span class="box"></span><span>${label}</span></label>`;
    $("#filters").innerHTML = `
      <div class="filter-group"><h4>Category</h4>${FILTER_CATS.map(c => checkbox("cats", c, c)).join("")}</div>
      <div class="filter-group"><h4>Size</h4><div class="flex wrap gap" style="gap:8px">
        ${FILTER_SIZES.map(s => `<label class="filter-opt" style="padding:0"><input type="checkbox" data-filter="sizes" value="${s}"><span class="box"></span><span>${s}</span></label>`).join("")}</div></div>
      <div class="filter-group"><h4>Colour</h4><div class="swatches">
        ${FILTER_COLORS.map(([hex, name]) => `<span class="swatch" data-swatch="${hex}" title="${name}" style="background:${hex}"></span>`).join("")}</div></div>
      <div class="filter-group"><h4>Price</h4>
        <input type="range" class="range" id="priceRange" min="2000" max="20000" step="500" value="20000">
        <div class="range-vals"><span>Rs 2,000</span><span id="priceMax">Rs 20,000</span></div></div>
      <div class="filter-group"><h4>Availability</h4>
        ${checkbox("availability", "instock", "In Stock")}${checkbox("availability", "sale", "On Sale")}</div>
      <div class="filter-group"><h4>Collection</h4>${FILTER_COLLECTIONS.map(c => checkbox("collections", c, c)).join("")}</div>
      <button class="btn btn--ghost btn--block btn--sm" data-clear-all style="margin-top:18px"><span>Clear All</span></button>`;
  }


  function applyFilters() {
    let list = PRODUCTS.filter(p => {
      if (state.cats.size && !state.cats.has(p.cat)) return false;
      if (state.collections.size && !state.collections.has(p.collection)) return false;
      if (state.sizes.size && !p.sizes.some(s => state.sizes.has(s))) return false;
      if (state.colors.size && !p.colors.some(c => state.colors.has(c))) return false;
      if (p.price > state.maxPrice) return false;
      if (state.availability.has("sale") && !p.was) return false;
      if (state.availability.has("instock") && p.sizes.length === (p.oos || []).length) return false;
      return true;
    });
    const s = state.sort;
    list.sort((a, b) =>
      s === "newest" ? b.date - a.date :
      s === "best" ? b.reviews - a.reviews :
      s === "low" ? a.price - b.price :
      s === "high" ? b.price - a.price :
      b.popularity - a.popularity);
    return list;
  }

  function render() {
    const list = applyFilters();
    $("#shopGrid").innerHTML = list.map(productCard).join("");
    $("#shopCount").textContent = `${list.length} product${list.length !== 1 ? "s" : ""}`;
    $("#shopEmpty").style.display = list.length ? "none" : "block";
    $("#shopGrid").style.display = list.length ? "grid" : "none";
    renderChips();
    buildCatScroller();
    initReveal();
  }

  function renderChips() {
    const chips = [];
    state.cats.forEach(v => chips.push(["cats", v]));
    state.collections.forEach(v => chips.push(["collections", v]));
    state.sizes.forEach(v => chips.push(["sizes", "Size " + v]));
    state.colors.forEach(v => chips.push(["colors", "Colour"]));
    state.availability.forEach(v => chips.push(["availability", v === "sale" ? "On Sale" : "In Stock"]));
    if (state.maxPrice < 20000) chips.push(["price", "Under " + window.ZERO.money(state.maxPrice)]);
    $("#activeChips").innerHTML = chips.length
      ? chips.map(([g, l]) => `<span class="chip active" data-chip="${g}" data-chipval="${l}">${l} ✕</span>`).join("")
        + `<span class="chip" data-clear-all>Clear all</span>`
      : "";
  }


  function fillSorts() {
    const opts = SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    $("#sortSelect").innerHTML = opts;
    if ($("#sortSelectMobile")) $("#sortSelectMobile").innerHTML = opts;
  }

  function buildCatScroller() {
    const sc = $("#catScroller"); if (!sc) return;
    const all = !state.cats.size;
    sc.innerHTML = `<span class="chip ${all ? "active" : ""}" data-catchip="__all">All</span>` +
      FILTER_CATS.map(c => `<span class="chip ${state.cats.has(c) ? "active" : ""}" data-catchip="${c}">${c}</span>`).join("");
  }

  function clearAll() {
    state.cats.clear(); state.sizes.clear(); state.colors.clear();
    state.collections.clear(); state.availability.clear(); state.maxPrice = 20000;
    buildFilters(); render();
  }

  // Events
  document.addEventListener("change", (e) => {
    const cb = e.target.closest("[data-filter]");
    if (cb) {
      const g = cb.getAttribute("data-filter");
      cb.checked ? state[g].add(cb.value) : state[g].delete(cb.value);
      render();
    }
    if (e.target.id === "priceRange") {
      state.maxPrice = +e.target.value;
      $("#priceMax").textContent = window.ZERO.money(state.maxPrice);
      render();
    }
    if (e.target.id === "sortSelect" || e.target.id === "sortSelectMobile") {
      state.sort = e.target.value;
      $("#sortSelect").value = state.sort;
      if ($("#sortSelectMobile")) $("#sortSelectMobile").value = state.sort;
      render();
    }
  });

  document.addEventListener("click", (e) => {
    const catChip = e.target.closest("[data-catchip]");
    if (catChip) {
      const v = catChip.getAttribute("data-catchip");
      if (v === "__all") { state.cats.clear(); }
      else if (state.cats.has(v)) { state.cats.delete(v); }
      else { state.cats.clear(); state.cats.add(v); } // single-tap category select
      buildFilters(); render();
    }
    const sw = e.target.closest("[data-swatch]");
    if (sw) { const c = sw.getAttribute("data-swatch"); sw.classList.toggle("sel");
      state.colors.has(c) ? state.colors.delete(c) : state.colors.add(c); render(); }
    if (e.target.closest("[data-clear-all]")) { clearAll(); }
    if (e.target.closest("[data-open-filters]")) {
      const f = $("#filters"); f.style.display = f.style.display === "block" ? "none" : "block";
    }
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const g = chip.getAttribute("data-chip");
      if (g === "price") state.maxPrice = 20000;
      else { state[g].clear(); }
      buildFilters(); render();
    }
  });

  fillSorts(); buildFilters(); render();
});
