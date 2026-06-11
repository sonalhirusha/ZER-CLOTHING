/* =====================================================================
   ZERØ CLOTHING — PREMIUM EXPERIENCE LAYER  (additive, non-breaking)
   ---------------------------------------------------------------------
   • WebGL animated "liquid chrome" background (CSS-gradient fallback)
   • Real 3D tilt + glare on cards / tiles / [data-tilt]
   • Magnetic buttons, soft cursor glow, scroll-reveal polish
   All effects are pointer/fine-input gated and respect reduced-motion.
   ===================================================================== */
(function () {
  "use strict";
  if (window.__ZERO_PREMIUM__) return;
  window.__ZERO_PREMIUM__ = true;

  /* Inject the premium stylesheet LAST so it wins ties over enhance.css
     (which app.js injects at runtime). One <script> tag wires everything. */
  try {
    if (!document.querySelector("link[data-zx-premium]")) {
      var pl = document.createElement("link");
      pl.rel = "stylesheet"; pl.href = "assets/css/premium.css"; pl.setAttribute("data-zx-premium", "1");
      (document.head || document.documentElement).appendChild(pl);
    }
  } catch (e) { /* non-fatal */ }

  var mql = window.matchMedia || function () { return { matches: false, addListener: function () {} }; };
  var REDUCE = mql("(prefers-reduced-motion: reduce)").matches;
  var FINE = mql("(hover: hover) and (pointer: fine)").matches;
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  var caf = window.cancelAnimationFrame || clearTimeout;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* =================================================================
     1)  ANIMATED BACKGROUND — WebGL liquid chrome (graceful fallback)
     ================================================================= */
  var FRAG = [
    "precision highp float;",
    "uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse;",
    "float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }",
    "float noise(vec2 p){ vec2 i=floor(p), f=fract(p);",
    "  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));",
    "  vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }",
    "float fbm(vec2 p){ float v=0., a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }",
    "void main(){",
    "  vec2 p=(gl_FragCoord.xy - 0.5*u_res.xy)/u_res.y;",
    "  float t=u_time*0.035;",
    "  vec2 q=vec2(fbm(p*1.4 + t), fbm(p*1.4 - t + 5.2));",
    "  float n=fbm(p*2.0 + q*1.7 + vec2(t*0.5,-t*0.3));",
    "  vec2 m=(u_mouse*2.0-1.0)*vec2(u_res.x/u_res.y,1.0);",
    "  float light=smoothstep(1.25,0.0,length(p-m))*0.22;",
    "  float streak=smoothstep(0.46,0.78,n);",
    "  vec3 base=mix(vec3(0.015,0.015,0.02), vec3(0.05,0.05,0.065), n);",
    "  vec3 silver=vec3(0.80,0.81,0.85);",
    "  vec3 col=base + silver*streak*0.085 + silver*light;",
    "  col*=smoothstep(1.45,0.15,length(p));",
    "  col+=hash(gl_FragCoord.xy+u_time)*0.012;",
    "  gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n");
  var VERT = "attribute vec2 a; void main(){ gl_Position=vec4(a,0.0,1.0); }";

  function initBackground() {
    if (document.getElementById("zx-webgl")) return;
    var canvas = document.createElement("canvas");
    canvas.id = "zx-webgl";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);

    if (REDUCE) { document.body.classList.add("zx-bg-fallback"); return; }

    var gl = null;
    try { gl = canvas.getContext("webgl", { antialias: false, depth: false, alpha: false, powerPreference: "low-power" }) || canvas.getContext("experimental-webgl"); }
    catch (e) { gl = null; }
    if (!gl) { document.body.classList.add("zx-bg-fallback"); canvas.remove(); return; }

    function compile(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
      return s;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { document.body.classList.add("zx-bg-fallback"); canvas.remove(); return; }
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { document.body.classList.add("zx-bg-fallback"); canvas.remove(); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "u_res");
    var uTime = gl.getUniformLocation(prog, "u_time");
    var uMouse = gl.getUniformLocation(prog, "u_mouse");

    var mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    window.addEventListener("pointermove", function (e) {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    }, { passive: true });

    function resize() {
      // lighter on phones — the shader is fullscreen, so keep fill-rate sane
      var cap = window.innerWidth < 900 ? 1 : 1.5;
      var dpr = Math.min(window.devicePixelRatio || 1, cap);
      var w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    window.addEventListener("resize", resize, { passive: true });
    resize();

    var start = performance.now ? performance.now() : Date.now();
    var rafId = null, running = true;
    function frame(now) {
      if (!running) return;
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, ((now || Date.now()) - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = raf(frame);
    }
    rafId = raf(frame);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { running = false; if (rafId) caf(rafId); }
      else if (!running) { running = true; rafId = raf(frame); }
    });
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; document.body.classList.add("zx-bg-fallback"); }, false);
  }

  /* =================================================================
     2)  3D TILT + GLARE  (cards, tiles, [data-tilt])
     ================================================================= */
  var TILT_SEL = ".product-card, .cat-tile, [data-tilt], .type-card, .split-feature .pane--media";
  function attachTilt(el) {
    if (!FINE || REDUCE || el.__zxTilt) return;
    el.__zxTilt = true;
    el.classList.add("zx-tilt");
    var glare = document.createElement("span");
    glare.className = "zx-glare";
    el.appendChild(glare);
    var max = el.classList.contains("product-card") ? 5 : 7;
    var state = { rx: 0, ry: 0, trx: 0, try_: 0, gx: 50, gy: 50, on: false, id: null };

    function render() {
      state.rx = lerp(state.rx, state.trx, 0.18);
      state.ry = lerp(state.ry, state.try_, 0.18);
      el.style.transform = "perspective(900px) rotateX(" + state.rx.toFixed(2) + "deg) rotateY(" + state.ry.toFixed(2) + "deg)";
      glare.style.setProperty("--gx", state.gx + "%");
      glare.style.setProperty("--gy", state.gy + "%");
      if (state.on || Math.abs(state.rx - state.trx) > 0.05 || Math.abs(state.ry - state.try_) > 0.05) {
        state.id = raf(render);
      } else { el.style.transform = ""; state.id = null; }
    }
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      state.try_ = (px - 0.5) * 2 * max;
      state.trx = -(py - 0.5) * 2 * max;
      state.gx = px * 100; state.gy = py * 100;
      if (!state.id) state.id = raf(render);
    }, { passive: true });
    el.addEventListener("pointerenter", function () { state.on = true; el.classList.add("zx-tilting"); if (!state.id) state.id = raf(render); });
    el.addEventListener("pointerleave", function () { state.on = false; state.trx = 0; state.try_ = 0; el.classList.remove("zx-tilting"); });
  }
  function scanTilt(root) {
    try { (root || document).querySelectorAll(TILT_SEL).forEach(attachTilt); } catch (e) {}
  }

  /* =================================================================
     3)  MAGNETIC BUTTONS
     ================================================================= */
  function attachMagnet(el) {
    if (!FINE || REDUCE || el.__zxMag) return;
    el.__zxMag = true;
    var s = { x: 0, y: 0, tx: 0, ty: 0, id: null };
    function render() {
      s.x = lerp(s.x, s.tx, 0.2); s.y = lerp(s.y, s.ty, 0.2);
      el.style.transform = "translate(" + s.x.toFixed(2) + "px," + s.y.toFixed(2) + "px)";
      if (Math.abs(s.x - s.tx) > 0.1 || Math.abs(s.y - s.ty) > 0.1) s.id = raf(render);
      else { if (s.tx === 0 && s.ty === 0) el.style.transform = ""; s.id = null; }
    }
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      s.tx = clamp((e.clientX - (r.left + r.width / 2)) * 0.3, -14, 14);
      s.ty = clamp((e.clientY - (r.top + r.height / 2)) * 0.3, -10, 10);
      if (!s.id) s.id = raf(render);
    }, { passive: true });
    el.addEventListener("pointerleave", function () { s.tx = 0; s.ty = 0; if (!s.id) s.id = raf(render); });
  }
  function scanMagnet(root) {
    try { (root || document).querySelectorAll(".btn--lg, [data-magnetic]").forEach(attachMagnet); } catch (e) {}
  }

  /* =================================================================
     4)  CURSOR GLOW (fine pointers only — native cursor stays)
     ================================================================= */
  function initCursor() {
    if (!FINE || REDUCE) return;
    var dot = document.createElement("div");
    dot.className = "zx-cursor"; dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);
    var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, shown = false, id = null;
    function render() {
      x = lerp(x, tx, 0.18); y = lerp(y, ty, 0.18);
      dot.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)";
      id = raf(render);
    }
    window.addEventListener("pointermove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; dot.classList.add("on"); }
      if (!id) id = raf(render);
      var hot = e.target && e.target.closest && e.target.closest("a,button,.btn,.product-card,.cat-tile,[data-tilt],input,select,textarea");
      dot.classList.toggle("is-hot", !!hot);
    }, { passive: true });
    window.addEventListener("pointerdown", function () { dot.classList.add("is-down"); });
    window.addEventListener("pointerup", function () { dot.classList.remove("is-down"); });
    document.addEventListener("mouseleave", function () { dot.classList.remove("on"); shown = false; });
  }

  /* =================================================================
     5)  SCROLL-REVEAL POLISH
     ================================================================= */
  function initReveal() {
    if (!("IntersectionObserver" in window)) return null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("zx-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    function scan(root) {
      try {
        (root || document).querySelectorAll(".section-head, .split-feature, .gallery-item, .stat").forEach(function (el) {
          if (el.__zxRev) return; el.__zxRev = true; el.classList.add("zx-rev"); io.observe(el);
        });
      } catch (e) {}
    }
    scan(document);
    return scan;
  }

  /* =================================================================
     BOOT + observe dynamically-injected nodes
     ================================================================= */
  function boot() {
    try { initBackground(); } catch (e) {}
    scanTilt(document);
    scanMagnet(document);
    try { initCursor(); } catch (e) {}
    var revScan = null;
    try { revScan = initReveal(); } catch (e) {}

    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType !== 1) continue;
            var scope = n.parentNode || document;
            scanTilt(scope);
            scanMagnet(scope);
            if (revScan) revScan(scope);
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
