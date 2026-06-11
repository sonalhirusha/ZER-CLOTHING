/* ZERØ — Live Design Studio */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, money, addToCart, store, toast } = window.ZERO;

  const GARMENT_COLORS = [["#0a0a0a","Black"],["#f5f5f5","Bone"],["#7d7d7d","Ash"],["#3a3a3a","Charcoal"],["#1a2942","Navy"]];
  const TEXT_COLORS = ["#ffffff","#000000","#c8c8cc","#ff3b30","#ffce4d","#34d375"];
  const FONTS = [["'Space Grotesk',sans-serif","Grotesk"],["'Anton',sans-serif","Anton"],["'Bebas Neue',sans-serif","Bebas"],["'Playfair Display',serif","Editorial"]];

  const D = {
    type: CUSTOM_TYPES[0], garment: "#0a0a0a", zone: "front",
    img: null, text: "", font: FONTS[0][0], textSize: 42, textColor: "#ffffff",
    imgScale: 60, textPos: { x: 50, y: 50 }, imgPos: { x: 50, y: 50 },
    prints: { front: false, back: false, sleeve: false }
  };

  // Build type cards
  $("#typeGrid").innerHTML = CUSTOM_TYPES.map((t, i) => `
    <div class="type-card ${i === 0 ? "sel" : ""}" data-type="${t.id}">
      <div class="ph" data-label="${t.label}"></div><b>${t.name}</b><small>${money(t.base)}</small>
    </div>`).join("");

  $("#garmentColors").innerHTML = GARMENT_COLORS.map((c, i) =>
    `<button class="swatch ${i === 0 ? "sel" : ""}" data-garment="${c[0]}" style="background:${c[0]}" title="${c[1]}"></button>`).join("");
  $("#textColors").innerHTML = TEXT_COLORS.map((c, i) =>
    `<button class="swatch ${i === 0 ? "sel" : ""}" data-tc="${c}" style="background:${c}"></button>`).join("");
  $("#fontRow").innerHTML = FONTS.map((f, i) =>
    `<div class="font-pick ${i === 0 ? "sel" : ""}" data-font="${f[0]}" style="font-family:${f[0]}">${f[1]}</div>`).join("");

  updateShirt(); updatePrice(); renderDesign();

  function updateShirt() {
    const sh = $("#mockShirt");
    sh.style.background = D.garment;
    sh.style.borderRadius = "18px / 8px";
    sh.setAttribute("data-label", D.type.label + " · " + D.zone.toUpperCase());
    sh.style.boxShadow = "inset 0 -40px 80px rgba(0,0,0,.4), inset 0 20px 60px rgba(255,255,255,.04)";
  }


  function renderDesign() {
    const zone = $("#printZone");
    let html = "";
    if (D.img) html += `<img class="design-img" src="${D.img}" alt="design" style="left:${D.imgPos.x}%;top:${D.imgPos.y}%;width:${D.imgScale}%;max-width:none;max-height:none">`;
    if (D.text) html += `<div class="design-text" style="left:${D.textPos.x}%;top:${D.textPos.y}%;font-family:${D.font};font-size:${D.textSize}px;color:${D.textColor}">${escapeHtml(D.text)}</div>`;
    if (D.img || D.text) html += `<span class="drag-hint">Drag to reposition</span>`;
    zone.innerHTML = html;
    D.prints[D.zone] = !!(D.img || D.text);
    $("#imgSizeField").style.display = D.img ? "block" : "none";
  }

  /* ---- Drag to position anywhere within the print zone ---- */
  (function enableDrag() {
    const zone = $("#printZone");
    let mode = null, target = null;
    zone.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(".design-text, .design-img");
      if (!el) return;
      mode = el.classList.contains("design-text") ? "text" : "img";
      target = el; el.setPointerCapture(e.pointerId); e.preventDefault();
    });
    zone.addEventListener("pointermove", (e) => {
      if (!mode) return;
      const r = zone.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width) * 100;
      let y = ((e.clientY - r.top) / r.height) * 100;
      x = Math.max(4, Math.min(96, x)); y = Math.max(4, Math.min(96, y));
      const pos = mode === "text" ? D.textPos : D.imgPos;
      pos.x = x; pos.y = y; target.style.left = x + "%"; target.style.top = y + "%";
    });
    const end = () => { mode = null; target = null; };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);
  })();

  function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function updatePrice() {
    let total = D.type.base;
    const lines = [`Base ${D.type.name} — ${money(D.type.base)}`];
    let printCount = 0;
    Object.keys(D.prints).forEach(z => { if (D.prints[z]) { printCount++; } });
    if (D.img) { total += PRINT_PRICES.upload; lines.push(`Custom image print — ${money(PRINT_PRICES.upload)}`); }
    if (D.text) { total += PRINT_PRICES.text; lines.push(`Custom text — ${money(PRINT_PRICES.text)}`); }
    if (D.prints.back) { total += PRINT_PRICES.back; lines.push(`Back print — ${money(PRINT_PRICES.back)}`); }
    if (D.prints.sleeve) { total += PRINT_PRICES.sleeve; lines.push(`Sleeve print — ${money(PRINT_PRICES.sleeve)}`); }
    D.total = total;
    $("#studioPrice").textContent = money(total);
    $("#summaryType").textContent = D.type.name;
    $("#priceBreakdown").innerHTML = lines.join("<br>");
    $("#studioAdd").querySelector("span").textContent = "Add To Bag — " + money(total);
  }

  // Events
  $("#typeGrid").addEventListener("click", (e) => {
    const c = e.target.closest("[data-type]"); if (!c) return;
    $$(".type-card").forEach(x => x.classList.remove("sel")); c.classList.add("sel");
    D.type = CUSTOM_TYPES.find(t => t.id === c.getAttribute("data-type"));
    updateShirt(); updatePrice();
  });

  $("#garmentColors").addEventListener("click", (e) => {
    const b = e.target.closest("[data-garment]"); if (!b) return;
    $$("#garmentColors .swatch").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    D.garment = b.getAttribute("data-garment"); updateShirt();
  });

  $("#zoneTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-zone]"); if (!b) return;
    $$(".zone-tab").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    D.zone = b.getAttribute("data-zone"); updateShirt();
  });

  $("#textColors").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tc]"); if (!b) return;
    $$("#textColors .swatch").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    D.textColor = b.getAttribute("data-tc"); renderDesign();
  });

  $("#fontRow").addEventListener("click", (e) => {
    const b = e.target.closest("[data-font]"); if (!b) return;
    $$(".font-pick").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    D.font = b.getAttribute("data-font"); renderDesign();
  });


  $("#textInput").addEventListener("input", (e) => { D.text = e.target.value; renderDesign(); updatePrice(); });
  $("#textSize").addEventListener("input", (e) => { D.textSize = +e.target.value; $("#sizeVal").textContent = e.target.value; renderDesign(); });
  $("#imgSize").addEventListener("input", (e) => { D.imgScale = +e.target.value; $("#imgSizeVal").textContent = e.target.value + "%"; renderDesign(); });

  // Upload (file + drag/drop)
  const dz = $("#dropzone"), fi = $("#fileInput");
  dz.addEventListener("click", () => fi.click());
  fi.addEventListener("change", () => { if (fi.files[0]) loadImg(fi.files[0]); });
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) loadImg(f); });

  function loadImg(file) {
    if (file.size > 10 * 1024 * 1024) { toast("File too large (max 10MB)"); return; }
    const r = new FileReader();
    r.onload = () => { D.img = r.result; renderDesign(); updatePrice(); toast("Design uploaded"); };
    r.readAsDataURL(file);
  }

  // Add to bag
  $("#studioAdd").addEventListener("click", () => {
    const zones = Object.keys(D.prints).filter(z => D.prints[z]);
    if (!D.img && !D.text) { toast("Add a design or text first"); return; }
    addToCart({
      id: "custom-" + Date.now(), name: "Custom " + D.type.name, price: D.total,
      label: D.type.label, note: (D.text ? `"${D.text}"` : "Image print") + " · " + (zones.join("/") || "front"),
      colorName: (GARMENT_COLORS.find(c => c[0] === D.garment) || [])[1]
    });
  });

  // Save design
  $("#saveDesign").addEventListener("click", () => {
    const design = {
      type: D.type.name, garmentType: D.type.id, garment: D.garment,
      text: D.text, font: D.font, textColor: D.textColor, zone: D.zone,
      total: D.total, when: Date.now()
    };
    const saved = store.get("zero_designs", []);
    saved.unshift(design);
    store.set("zero_designs", saved);
    // When the backend is connected, also persist server-side (artwork upload is
    // handled separately via a presigned URL — see the architecture doc).
    if (window.ZERO.online()) {
      window.ZERO.api.post("/designs", {
        garmentType: D.type.id, garmentColor: D.garment,
        totalCents: Math.round(D.total * 100), spec: design
      }).catch(() => {});
    }
    toast("Design saved to your account");
  });
});
