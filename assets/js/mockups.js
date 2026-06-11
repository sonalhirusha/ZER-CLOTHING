/* =====================================================================
   ZERØ CLOTHING — Premium SVG Garment Mockup Engine
   ---------------------------------------------------------------------
   Renders crisp, brand-accurate vector garment "product renders" into any
   .ph placeholder that has no real photo. Color-, view- and acid-aware.
   Pure builder (ZeroMockups.svg) is DOM-free and unit-testable in Node.
   ===================================================================== */
(function (root) {
  "use strict";

  /* ----------  color helpers  ---------- */
  function hexToRgb(hex) {
    let c = String(hex || "#141416").replace("#", "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const f = (v) => (amt < 0 ? Math.round(v * (1 + amt)) : Math.round(v + (255 - v) * amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  /* ----------  named garment colors  ---------- */
  const COLORS = {
    black: "#15151a", onyx: "#101015", void: "#0d0d12", charcoal: "#2b2b31",
    ash: "#9a9aa1", gray: "#7d7d84", bone: "#e9e6dd", white: "#f4f4f2",
    navy: "#1a2942", vintage: "#5b5b62", static: "#1b1b20"
  };

  /* ----------  classify a placeholder label into a garment  ---------- */
  function classify(label, hint) {
    const L = String(label || "").toUpperCase();
    const out = { type: "tee", color: COLORS.black, view: "front", acid: false, couple: false };

    out.view = /BACK/.test(L) ? "back" : "front";
    out.acid = /ACID/.test(L);

    if (/COUPLE/.test(L)) { out.couple = true; out.type = /HOOD/.test(L) ? "hoodie" : "tee"; }
    else if (/HOOD/.test(L)) out.type = "hoodie";
    else if (/SWEAT/.test(L)) out.type = "sweatshirt";
    else if (/OVERSIZE/.test(L)) out.type = "oversized";
    else if (/\bCAP\b/.test(L)) out.type = "cap";
    else if (/TOTE/.test(L)) out.type = "tote";
    else if (/(TEE|T-?SHIRT|GRAPHIC|VINTAGE|STATIC|PRINT)/.test(L)) out.type = "tee";

    // color keywords
    const cmap = [
      ["BONE", COLORS.bone], ["WHITE", COLORS.white], ["ASH", COLORS.ash],
      ["CHARCOAL", COLORS.charcoal], ["NAVY", COLORS.navy], ["VINTAGE", COLORS.vintage],
      ["ONYX", COLORS.onyx], ["VOID", COLORS.void], ["BLACK", COLORS.black],
      ["MONO", COLORS.black], ["STATIC", COLORS.static]
    ];
    for (const [k, v] of cmap) { if (L.indexOf(k) > -1) { out.color = v; break; } }
    if (hint) out.color = hint;
    return out;
  }

  /* ----------  garment body geometry presets  ---------- */
  const CX = 240;
  const PRESETS = {
    tee: { sx: 92, nh: 46, nyTop: 122, sy: 150, stx: 168, sty: 206, sby: 272, uax: 128, ux: 80, uy: 240, bw: 84, hy: 498, hd: 16 },
    oversized: { sx: 112, nh: 52, nyTop: 130, sy: 162, stx: 190, sty: 238, sby: 306, uax: 150, ux: 102, uy: 256, bw: 106, hy: 522, hd: 12 },
    sweatshirt: { sx: 106, nh: 48, nyTop: 128, sy: 158, stx: 178, sty: 226, sby: 296, uax: 140, ux: 96, uy: 252, bw: 100, hy: 504, hd: 10, rib: true, crew: true },
    hoodie: { sx: 110, nh: 50, nyTop: 132, sy: 162, stx: 184, sty: 236, sby: 312, uax: 146, ux: 100, uy: 258, bw: 106, hy: 510, hd: 10, rib: true, hood: true, pocket: true }
  };

  function bodyPath(p, view) {
    const dip = view === "back" ? p.nyTop + 8 : p.nyTop + 30; // shallow vs deep neckline
    return [
      `M${CX - p.sx},${p.sy}`,
      `L${CX - p.nh},${p.nyTop}`,
      `Q${CX},${dip} ${CX + p.nh},${p.nyTop}`,
      `L${CX + p.sx},${p.sy}`,
      `L${CX + p.stx},${p.sty}`,
      `L${CX + p.uax},${p.sby}`,
      `L${CX + p.ux},${p.uy}`,
      `L${CX + p.bw},${p.hy}`,
      `Q${CX},${p.hy + p.hd} ${CX - p.bw},${p.hy}`,
      `L${CX - p.ux},${p.uy}`,
      `L${CX - p.uax},${p.sby}`,
      `L${CX - p.stx},${p.sty}`,
      "Z"
    ].join(" ");
  }

  let UID = 0;

  /* ----------  build one garment <svg> string  ---------- */
  function svg(opts) {
    opts = opts || {};
    const o = classify(opts.label, opts.color);
    if (opts.type) o.type = opts.type;
    if (opts.view) o.view = opts.view;
    if (typeof opts.acid === "boolean") o.acid = opts.acid;
    if (typeof opts.couple === "boolean") o.couple = opts.couple;

    const id = "zm" + (UID++);
    const W = 480, H = 600;
    const dark = luminance(o.color) < 0.45;
    const ink = dark ? "#f3f3f5" : "#161616";        // print ink contrast
    const seam = dark ? shade(o.color, 0.18) : shade(o.color, -0.22);
    const hi = dark ? shade(o.color, 0.16) : shade(o.color, 0.5);
    const lo = shade(o.color, dark ? -0.4 : -0.16);

    // ----- shared defs -----
    const defs = `
      <defs>
        <radialGradient id="bg${id}" cx="50%" cy="34%" r="80%">
          <stop offset="0%" stop-color="#202028"/>
          <stop offset="55%" stop-color="#121216"/>
          <stop offset="100%" stop-color="#080809"/>
        </radialGradient>
        <linearGradient id="fab${id}" x1="22%" y1="6%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="${hi}"/>
          <stop offset="46%" stop-color="${o.color}"/>
          <stop offset="100%" stop-color="${lo}"/>
        </linearGradient>
        <radialGradient id="sheen${id}" cx="38%" cy="22%" r="62%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="${dark ? 0.14 : 0.5}"/>
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <filter id="soft${id}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14"/>
        </filter>
        <filter id="acid${id}">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.026" numOctaves="3" seed="${(UID * 7) % 97}" result="n"/>
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0"/>
        </filter>
      </defs>`;

    // ----- background + floor shadow -----
    const bg = `<rect width="${W}" height="${H}" fill="url(#bg${id})"/>
      <ellipse cx="${CX}" cy="546" rx="150" ry="26" fill="#000" opacity="0.55" filter="url(#soft${id})"/>`;

    let garment = "";

    if (o.type === "cap") {
      garment = capSVG(id, o, { ink, seam, hi, lo });
    } else if (o.type === "tote") {
      garment = toteSVG(id, o, { ink, seam });
    } else if (o.couple) {
      garment = coupleSVG(id, o, { ink, seam });
    } else {
      garment = apparelSVG(id, o, { ink, seam, hi, lo, dark });
    }

    return `<svg class="zm-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${(opts.label || "ZERO garment").replace(/"/g, "")}">${defs}${bg}${garment}</svg>`;
  }

  /* ----------  apparel (tee / oversized / sweatshirt / hoodie)  ---------- */
  function apparelSVG(id, o, c) {
    const p = PRESETS[o.type] || PRESETS.tee;
    const path = bodyPath(p, o.view);
    const clip = `<clipPath id="cl${id}"><path d="${path}"/></clipPath>`;

    // hem & cuff ribbing for hoodie / sweatshirt
    let rib = "";
    if (p.rib) {
      const ry = p.hy - 22;
      rib += `<g clip-path="url(#cl${id})"><rect x="${CX - p.bw - 4}" y="${ry}" width="${(p.bw + 4) * 2}" height="48" fill="${c.seam}"/>`;
      for (let x = CX - p.bw; x < CX + p.bw; x += 9) rib += `<line x1="${x}" y1="${ry}" x2="${x}" y2="${ry + 48}" stroke="${c.lo}" stroke-width="1.4" opacity="0.5"/>`;
      rib += `</g>`;
      // cuffs
      [-1, 1].forEach((s) => {
        const cx = CX + s * (p.uax + 12), cy = p.sby - 6;
        rib += `<g clip-path="url(#cl${id})"><rect x="${cx - 26}" y="${cy - 6}" width="52" height="24" fill="${c.seam}" transform="rotate(${s * 18} ${cx} ${cy})"/></g>`;
      });
    }

    // hood (behind body) + drawstrings + pocket
    let hoodBehind = "", front = "";
    if (p.hood) {
      const hy = p.sy - 4;
      hoodBehind = `
        <path d="M${CX - p.sx - 4},${hy} C ${CX - 96},${p.nyTop - 104} ${CX + 96},${p.nyTop - 104} ${CX + p.sx + 4},${hy}
                 L ${CX + p.sx - 14},${p.sy + 18} C ${CX + 40},${p.nyTop - 6} ${CX - 40},${p.nyTop - 6} ${CX - p.sx + 14},${p.sy + 18} Z"
              fill="${shade(o.color, c.dark ? -0.12 : -0.06)}" stroke="${c.seam}" stroke-width="1.5"/>`;
    }

    // body
    let body = `<path d="${path}" fill="url(#fab${id})" stroke="${c.seam}" stroke-width="2"/>`;
    body += `<path d="${path}" fill="url(#sheen${id})"/>`;

    // acid / mineral wash — bleached, mottled overlay clipped to the garment
    let acid = "";
    if (o.acid) {
      acid = `<g clip-path="url(#cl${id})">
        <rect x="0" y="0" width="480" height="600" filter="url(#acid${id})" opacity="0.42"/>
        <ellipse cx="${CX - 30}" cy="${(p.uy + p.hy) / 2}" rx="120" ry="150" fill="#fff" opacity="0.10"/>
        <ellipse cx="${CX + 56}" cy="${p.uy + 30}" rx="70" ry="96" fill="#fff" opacity="0.08"/>
        <ellipse cx="${CX - 70}" cy="${p.hy - 60}" rx="60" ry="70" fill="#000" opacity="0.10"/>
      </g>`;
    }

    // neckline rib
    const ndip = o.view === "back" ? p.nyTop + 8 : p.nyTop + 30;
    let neck = `<path d="M${CX - p.nh},${p.nyTop} Q${CX},${ndip} ${CX + p.nh},${p.nyTop}" fill="none" stroke="${c.seam}" stroke-width="6" stroke-linecap="round"/>`;
    if (p.crew) neck += `<path d="M${CX - p.nh - 4},${p.nyTop - 2} Q${CX},${ndip + 6} ${CX + p.nh + 4},${p.nyTop - 2}" fill="none" stroke="${c.lo}" stroke-width="3" opacity="0.6"/>`;

    // sleeve seams + side seams (subtle)
    let seams = `<g opacity="0.45" stroke="${c.seam}" stroke-width="1.6" fill="none">
        <path d="M${CX - p.sx + 6},${p.sy + 6} L${CX - p.ux + 4},${p.uy - 6}"/>
        <path d="M${CX + p.sx - 6},${p.sy + 6} L${CX + p.ux - 4},${p.uy - 6}"/>
        <path d="M${CX - p.bw + 8},${p.uy + 8} L${CX - p.bw + 12},${p.hy - 8}"/>
        <path d="M${CX + p.bw - 8},${p.uy + 8} L${CX + p.bw - 12},${p.hy - 8}"/>
      </g>`;

    if (p.hood && o.view === "front") {
      const sx = 14;
      front += `<g stroke="${c.seam}" stroke-width="4" stroke-linecap="round" fill="none">
          <path d="M${CX - sx},${ndip - 4} C ${CX - sx - 6},${ndip + 46} ${CX - sx - 4},${ndip + 78} ${CX - sx - 2},${ndip + 96}"/>
          <path d="M${CX + sx},${ndip - 4} C ${CX + sx + 6},${ndip + 46} ${CX + sx + 4},${ndip + 78} ${CX + sx + 2},${ndip + 96}"/>
        </g>
        <circle cx="${CX - sx - 2}" cy="${ndip + 100}" r="6" fill="${c.seam}"/>
        <circle cx="${CX + sx + 2}" cy="${ndip + 100}" r="6" fill="${c.seam}"/>`;
    }
    if (p.pocket && o.view === "front") {
      const py = p.hy - 150;
      front += `<path d="M${CX - 72},${py} L${CX + 72},${py} L${CX + 80},${py + 92} L${CX - 80},${py + 92} Z"
                fill="${shade(o.color, c.dark ? -0.1 : -0.05)}" stroke="${c.seam}" stroke-width="1.6"/>
                <path d="M${CX - 72},${py} Q${CX},${py + 16} ${CX + 72},${py}" fill="none" stroke="${c.seam}" stroke-width="2"/>`;
    }

    // print / branding
    const print = brandPrint(id, o, c, p);

    return `${clip}${hoodBehind}${body}${acid}${seams}${neck}${rib}${front}${print}`;
  }

  function brandPrint(id, o, c, p) {
    const dispFont = "'Clash Display','Space Grotesk',system-ui,sans-serif";
    if (o.view === "back") {
      const y = (p.uy + p.hy) / 2 - 10;
      return `<g text-anchor="middle" clip-path="url(#cl${id})">
        <text x="${CX}" y="${y}" font-family="${dispFont}" font-weight="600" font-size="78" letter-spacing="-3" fill="${c.ink}" opacity="0.92">ZER<tspan>Ø</tspan></text>
        <text x="${CX}" y="${y + 38}" font-family="'Inter',sans-serif" font-weight="600" font-size="15" letter-spacing="8" fill="${c.ink}" opacity="0.6">DESIGNED BY YOU</text>
        <rect x="${CX - 30}" y="${p.nyTop + 14}" width="60" height="18" rx="3" fill="none" stroke="${c.seam}" stroke-width="1.4" opacity="0.7"/>
      </g>`;
    }
    // front chest mark
    const cy = p.uy + 6;
    return `<g text-anchor="middle">
      <text x="${CX}" y="${cy}" font-family="${dispFont}" font-weight="600" font-size="30" letter-spacing="-1" fill="${c.ink}" opacity="0.9">ZER<tspan>Ø</tspan></text>
    </g>`;
  }

  /* ----------  cap  ---------- */
  function capSVG(id, o, c) {
    const col = o.color;
    return `<g>
      <path d="M120,330 Q120,210 240,206 Q360,210 360,330 L348,330 Q330,250 240,248 Q150,250 132,330 Z" fill="url(#fab${id})" stroke="${c.seam}" stroke-width="2"/>
      <path d="M132,330 Q240,300 348,330 Q360,372 240,386 Q120,372 132,330 Z" fill="${shade(col, -0.12)}" stroke="${c.seam}" stroke-width="2"/>
      <path d="M240,210 L240,322" stroke="${c.seam}" stroke-width="1.5" opacity="0.5"/>
      <path d="M196,214 Q240,206 284,214" stroke="${c.seam}" stroke-width="1.5" fill="none" opacity="0.5"/>
      <circle cx="240" cy="214" r="7" fill="${c.seam}"/>
      <text x="240" y="300" text-anchor="middle" font-family="'Clash Display','Space Grotesk',sans-serif" font-weight="600" font-size="34" letter-spacing="-1" fill="${c.ink}" opacity="0.92">ZER<tspan>Ø</tspan></text>
    </g>`;
  }

  /* ----------  tote  ---------- */
  function toteSVG(id, o, c) {
    return `<g>
      <path d="M176,210 q0,-46 64,-46 q64,0 64,46" fill="none" stroke="${c.seam}" stroke-width="9" stroke-linecap="round"/>
      <path d="M150,236 L330,236 L348,470 Q240,492 132,470 Z" fill="url(#fab${id})" stroke="${c.seam}" stroke-width="2"/>
      <path d="M150,236 L330,236 L332,262 L148,262 Z" fill="${shade(o.color, -0.1)}"/>
      <text x="240" y="372" text-anchor="middle" font-family="'Clash Display','Space Grotesk',sans-serif" font-weight="600" font-size="58" letter-spacing="-2" fill="${c.ink}" opacity="0.92">ZER<tspan>Ø</tspan></text>
    </g>`;
  }

  /* ----------  couple set (two garments)  ---------- */
  function coupleSVG(id, o, c) {
    const left = svgInner({ type: o.type, color: o.color, view: "front" });
    const rightColor = luminance(o.color) < 0.45 ? COLORS.bone : COLORS.black;
    const right = svgInner({ type: o.type, color: rightColor, view: "front" });
    return `<g transform="translate(-86,46) scale(0.66)" opacity="0.98">${left}</g>
            <g transform="translate(250,72) scale(0.66)">${right}</g>`;
  }
  // build only the garment group (no bg) for composing couples
  function svgInner(opts) {
    const full = svg(opts);
    // strip outer <svg> + defs/bg by re-running apparel directly
    const o = classify(opts.label, opts.color);
    if (opts.type) o.type = opts.type;
    if (opts.view) o.view = opts.view;
    const id = "zc" + (UID++);
    const dark = luminance(o.color) < 0.45;
    const c = {
      ink: dark ? "#f3f3f5" : "#161616",
      seam: dark ? shade(o.color, 0.18) : shade(o.color, -0.22),
      hi: dark ? shade(o.color, 0.16) : shade(o.color, 0.5),
      lo: shade(o.color, dark ? -0.4 : -0.16), dark
    };
    const defs = `<defs>
        <linearGradient id="fab${id}" x1="22%" y1="6%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="${c.hi}"/><stop offset="46%" stop-color="${o.color}"/><stop offset="100%" stop-color="${c.lo}"/>
        </linearGradient>
        <radialGradient id="sheen${id}" cx="38%" cy="22%" r="62%">
          <stop offset="0%" stop-color="#fff" stop-opacity="${dark ? 0.14 : 0.5}"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient></defs>`;
    return defs + apparelSVG(id, o, c);
  }

  /* =====================================================================
     DOM layer — paint placeholders that have no real photo
     ===================================================================== */
  function isSkippable(el) {
    if (!el || el.classList.contains("ph--img") || el.classList.contains("zm-done")) return true;
    if (el.closest(".hero__bg")) return true;          // hero keeps its 3D backdrop
    if (el.classList.contains("ava")) return true;     // tiny avatars stay abstract
    if (el.classList.contains("thumb")) return true;   // cart line thumbnails stay compact
    if (el.closest(".review-photos")) return true;     // 56px review chips stay abstract
    return false;
  }

  function injectMock(el) {
    const label = el.getAttribute("data-label") || "";
    const hint = el.getAttribute("data-mock-color") || null;
    const markup = svg({ label: label, color: hint });
    el.classList.add("zm-done", "ph--mock");
    const holder = document.createElement("div");
    holder.className = "zm-holder";
    holder.innerHTML = markup;
    el.appendChild(holder);
  }

  function paint(rootEl) {
    const scope = rootEl || document;
    const list = scope.querySelectorAll ? scope.querySelectorAll(".ph") : [];
    list.forEach((el) => {
      if (isSkippable(el)) return;
      const src = el.getAttribute("data-img");
      if (!src) { injectMock(el); return; }
      // give real photos a chance; only mock if the file is missing
      const probe = new Image();
      probe.onload = () => { /* applyImages will show the real photo */ };
      probe.onerror = () => { if (!isSkippable(el)) injectMock(el); };
      probe.src = src;
    });
  }

  /* expose pure + DOM API */
  root.ZeroMockups = { svg, classify, paint, shade, COLORS };

  /* ----------  auto-run in the browser  ---------- */
  if (typeof document !== "undefined") {
    const boot = () => {
      paint(document);
      // re-paint when cards / drawers are injected dynamically
      try {
        const mo = new MutationObserver((muts) => {
          for (const m of muts) {
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue;
              if (n.classList && n.classList.contains("ph")) paint(n.parentNode || document);
              else if (n.querySelector && n.querySelector(".ph")) paint(n);
            }
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
      } catch (e) { /* no-op */ }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
