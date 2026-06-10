/* ZERØ — Checkout */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, money, getCart, cartTotal, toast } = window.ZERO;
  const state = { shipping: SHIPPING[1], pay: "card", discount: 0 };

  // Dropdowns
  $("#provinceSel").innerHTML = '<option value="">Select province</option>' + SL_PROVINCES.map(p => `<option>${p}</option>`).join("");
  $("#districtSel").innerHTML = '<option value="">Select district</option>' + SL_DISTRICTS.map(d => `<option>${d}</option>`).join("");

  // Shipping
  $("#shippingOpts").innerHTML = SHIPPING.map((s, i) => `
    <label class="radio-card ${i === 1 ? "selected" : ""}" data-ship="${s.id}">
      <input type="radio" name="ship" ${i === 1 ? "checked" : ""}>
      <span class="dot"></span>
      <span class="rc-body"><b>${s.name}</b><small>${s.desc}</small></span>
      <span class="rc-price">${s.price ? money(s.price) : "FREE"}</span>
    </label>`).join("");

  // Payment methods
  const PAYS = [
    ["card", "Card", "Visa · Mastercard · Debit & Credit"],
    ["ezcash", "EZ Cash", "Mobile wallet payment"],
    ["bank", "Bank Transfer", "Upload receipt after transfer"],
    ["cod", "Cash on Delivery", "Pay when it arrives"]
  ];
  $("#payGrid").innerHTML = PAYS.map((p, i) => `
    <label class="radio-card ${i === 0 ? "selected" : ""}" data-pay="${p[0]}">
      <input type="radio" name="pay" ${i === 0 ? "checked" : ""}>
      <span class="dot"></span><span class="rc-body"><b>${p[1]}</b><small>${p[2]}</small></span>
    </label>`).join("");

  renderSummary();
  renderPayDetail();


  function renderSummary() {
    const cart = getCart();
    if (!cart.length) {
      $("#summaryItems").innerHTML = `<p class="muted" style="padding:12px 0">Your bag is empty. <a href="shop.html" class="link-underline">Shop now</a></p>`;
    } else {
      $("#summaryItems").innerHTML = cart.map(c => `
        <div class="summary-item"><div class="ph" data-label="${c.label || 'ZERØ'}"></div>
          <div><b>${c.name}</b><br><small>${[c.size, c.colorName, c.note].filter(Boolean).join(" · ") || "One Size"} · Qty ${c.qty}</small></div>
          <b>${money(c.price * c.qty)}</b></div>`).join("");
    }
    const sub = cartTotal();
    const ship = (sub >= 15000 && state.shipping.id !== "express") ? 0 : state.shipping.price;
    const total = Math.max(0, sub - state.discount) + ship;
    $("#sumSub").textContent = money(sub);
    $("#sumShip").textContent = ship ? money(ship) : "FREE";
    $("#sumTotal").textContent = money(total);
    $("#discountLine").style.display = state.discount ? "flex" : "none";
    $("#sumDisc").textContent = "- " + money(state.discount);
    state.total = total;
  }

  function renderPayDetail() {
    const el = $("#payDetail");
    if (state.pay === "bank") {
      el.innerHTML = `
      <div class="bank-box">
        <p class="eyebrow" style="margin-bottom:12px">Bank Transfer Details</p>
        <div class="bank-row"><span>Bank</span><b>Commercial Bank PLC</b></div>
        <div class="bank-row"><span>Account Name</span><b>ZERØ Clothing (Pvt) Ltd</b></div>
        <div class="bank-row"><span>Account No.</span><b>8001 234 567</b></div>
        <div class="bank-row"><span>Branch</span><b>Colombo 05</b></div>
        <p class="muted" style="font-size:.8rem;margin-top:14px">After payment, upload your receipt below or send it on WhatsApp.</p>
        <label class="upload-receipt" id="receiptUpload">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 16V4m0 0L8 8m4-4l4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
          <b id="receiptLabel">Upload Payment Receipt</b>
          <input type="file" id="receiptInput" accept="image/*,application/pdf" hidden>
        </label>
        <div id="verifyStatus"></div>
        <div class="wa-pay">
          <svg viewBox="0 0 32 32"><path d="M16 3C9 3 3.5 8.5 3.5 15.5c0 2.4.7 4.6 1.8 6.5L3 29l7.2-2.2c1.8 1 3.8 1.5 5.8 1.5 7 0 12.5-5.5 12.5-12.5S23 3 16 3z"/></svg>
          <div style="flex:1"><b style="font-size:.9rem">Send receipt on WhatsApp</b><br><small class="muted">077 869 1065 · instant verification</small></div>
        </div>
        <a class="btn btn-wa btn--block" id="waReceipt" style="margin-top:12px" target="_blank"><span>Send Receipt On WhatsApp</span></a>
      </div>`;
      updateWaLink();
    } else if (state.pay === "card") {
      el.innerHTML = `<div class="bank-box"><div class="field"><label>Card Number</label><input placeholder="0000 0000 0000 0000"></div>
        <div class="field--row"><div class="field"><label>Expiry</label><input placeholder="MM/YY"></div><div class="field"><label>CVV</label><input placeholder="123"></div></div>
        <div class="pay-icons" style="margin-top:6px"><span>VISA</span><span>MASTERCARD</span><span>AMEX</span></div></div>`;
    } else if (state.pay === "ezcash") {
      el.innerHTML = `<div class="bank-box"><div class="field"><label>EZ Cash Mobile Number</label><input placeholder="077 123 4567"></div><p class="muted" style="font-size:.8rem">You'll receive a PIN prompt to authorise the payment.</p></div>`;
    } else {
      el.innerHTML = `<div class="bank-box"><p class="muted">Pay in cash when your order is delivered. A Rs 200 COD handling fee applies for orders under Rs 5,000.</p></div>`;
    }
  }

  function updateWaLink() {
    const link = $("#waReceipt"); if (!link) return;
    const msg = `Hi ZERØ! I've placed an order for ${money(state.total)} and paid by bank transfer. Here is my receipt:`;
    link.href = `https://wa.me/${ZERO_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }


  // Events
  document.addEventListener("click", (e) => {
    const ship = e.target.closest("[data-ship]");
    if (ship) {
      $$("[data-ship]").forEach(x => x.classList.remove("selected"));
      ship.classList.add("selected"); ship.querySelector("input").checked = true;
      state.shipping = SHIPPING.find(s => s.id === ship.getAttribute("data-ship"));
      renderSummary(); updateWaLink();
    }
    const pay = e.target.closest("[data-pay]");
    if (pay) {
      $$("[data-pay]").forEach(x => x.classList.remove("selected"));
      pay.classList.add("selected"); pay.querySelector("input").checked = true;
      state.pay = pay.getAttribute("data-pay"); renderPayDetail();
    }
    if (e.target.closest("#receiptUpload")) {
      setTimeout(() => $("#receiptInput") && $("#receiptInput").click(), 0);
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "receiptInput" && e.target.files[0]) {
      $("#receiptLabel").textContent = "Receipt uploaded: " + e.target.files[0].name;
      $("#verifyStatus").innerHTML = `<div class="verify-status pending">● Receipt pending verification</div>`;
      setTimeout(() => { $("#verifyStatus").innerHTML = `<div class="verify-status ok">✓ Receipt received — verifying within 2 hours</div>`; }, 2200);
      toast("Receipt uploaded");
    }
  });

  $("#applyCoupon").addEventListener("click", () => {
    const code = $(".coupon-row input").value.trim().toUpperCase();
    if (code === "ZERO10") { state.discount = Math.round(cartTotal() * 0.1); toast("ZERO10 applied — 10% off"); }
    else if (code === "FREESHIP") { state.discount = state.shipping.price; toast("Free shipping applied"); }
    else if (code) { toast("Invalid coupon code"); state.discount = 0; }
    renderSummary();
  });

  $("#checkoutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!getCart().length) { toast("Your bag is empty"); return; }
    const order = "ZRO-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    window.ZERO.store.set("zero_last_order", { order, total: state.total, when: Date.now() });
    window.ZERO.store.set("zero_cart", []);
    toast("Order placed — " + order);
    setTimeout(() => location.href = "tracking.html?order=" + order, 900);
  });
});
