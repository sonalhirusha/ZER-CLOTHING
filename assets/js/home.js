/* ZERØ — Home page */
document.addEventListener("DOMContentLoaded", async function () {
  const { $, productCard, initReveal } = window.ZERO;
  const PRODUCTS = await window.ZERO.loadProducts();

  const features = [
    { t: "Premium Fabric", d: "240–320 GSM heavyweight cotton. Built to outlast the trend cycle.", i: '<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 7v10l8 4 8-4V7"/>' },
    { t: "Custom Printing", d: "DTG & screen prints that stay crisp wash after wash after wash.", i: '<rect x="5" y="9" width="14" height="8" rx="1"/><path d="M7 9V4h10v5M7 17v3h10v-3"/>' },
    { t: "Islandwide Delivery", d: "All 9 provinces, all 25 districts. Speed Post & express courier.", i: '<path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>' },
    { t: "Secure Payments", d: "Visa, Mastercard, EZ Cash, bank transfer & cash on delivery.", i: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>' },
    { t: "Fast Production", d: "Custom orders printed & packed within 48 hours, guaranteed.", i: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>' },
    { t: "Designed By You", d: "Our live studio puts the creative direction in your hands.", i: '<path d="M12 19l7-7-3-3-7 7v3z"/><path d="M16 9l-1-1"/><path d="M5 19h14"/>' }
  ];
  $("#whyGrid").innerHTML = features.map((f, n) => `
    <div class="feature">
      <span class="num">0${n + 1}</span>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5">${f.i}</svg></div>
      <h3>${f.t}</h3><p>${f.d}</p>
    </div>`).join("");

  const featured = PRODUCTS.filter(p => p.popularity >= 85).slice(0, 8);
  $("#featuredGrid").innerHTML = featured.slice(0, 4).map(productCard).join("");

  const star = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.3 3.2L7 14.2 2 9.4l7-.9z"/></svg>';
  $("#reviewGrid").innerHTML = REVIEWS.slice(0, 3).map(r => `
    <div class="review-card">
      <span class="stars">${star.repeat(r.rating)}</span>
      <p>"${r.text}"</p>
      ${r.photos ? `<div class="review-photos">${Array(r.photos).fill('<div class="ph" data-label="PHOTO"></div>').join("")}</div>` : ""}
      <div class="who"><div class="ava ph" data-label=""></div><div><b>${r.name}</b><small>${r.city} · Verified Buyer</small></div></div>
    </div>`).join("");

  initReveal();
});
