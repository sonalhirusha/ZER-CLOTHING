/* ZERØ — Checkout */
document.addEventListener("DOMContentLoaded", function () {
  const { $, $$, money, getCart, cartTotal, toast, online } = window.ZERO;
  const state = { shipping: SHIPPING[1], pay: "card", discount: 0, coupon: null };

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
    let ship = (sub >= 15000 && state.shipping.id !== "express") ? 0 : state.shipping.price;
    let discount = 0;
    if (state.coupon === "ZERO10") discount = Math.round(sub * 0.1);
    if (state.coupon === "FREESHIP") ship = 0;
    const total = Math.max(0, sub - discount) + ship;
    state.discount = discount;
    $("#sumSub").textContent = money(sub);
    $("#sumShip").textContent = ship ? money(ship) : "FREE";
    $("#sumTotal").textContent = money(total);
    $("#discountLine").style.display = discount ? "flex" : "none";
    $("#sumDisc").textContent = "- " + money(discount);
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
      el.innerHTML = `<div class="bank-box"><div class="field"><label>Cardholder Name</label><input id="cardName" placeholder="Name on card"></div>
        <div class="field"><label>Card Number</label><input id="cardNumber" inputmode="numeric" placeholder="0000 0000 0000 0000"></div>
        <div class="field--row"><div class="field"><label>Expiry</label><input id="cardExpiry" placeholder="MM/YY"></div><div class="field"><label>CVV</label><input id="cardCvv" inputmode="numeric" placeholder="123"></div></div>
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

  // Track the selected receipt file (uploaded to the API after the order is created).
  document.addEventListener("change", (e) => {
    if (e.target.id === "receiptInput" && e.target.files[0]) {
      state.receiptFile = e.target.files[0];
      $("#receiptLabel").textContent = "Receipt selected: " + e.target.files[0].name;
      $("#verifyStatus").innerHTML = `<div class="verify-status pending">● Receipt will be uploaded with your order</div>`;
      toast("Receipt attached");
    }
  });

  $("#applyCoupon").addEventListener("click", () => {
    const code = $(".coupon-row input").value.trim().toUpperCase();
    if (code === "ZERO10") { state.coupon = code; toast("ZERO10 applied — 10% off"); }
    else if (code === "FREESHIP") { state.coupon = code; toast("FREESHIP applied — free shipping"); }
    else if (code) { state.coupon = null; toast("Invalid coupon code"); }
    renderSummary(); updateWaLink();
  });

  function genOrderNo() {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return "ZRO-" + ymd + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function collectAddress(form) {
    const data = {};
    form.querySelectorAll(".field").forEach(f => {
      const label = (f.querySelector("label")?.textContent || "").replace(/\(optional\)/i, "").trim();
      const input = f.querySelector("input, select, textarea");
      if (label && input) data[label] = (input.value || "").trim();
    });
    return data;
  }

  // Map the on-page state to the live API contract.
  function buildApiPayload(order, d) {
    const methodMap = { speed: "speed_post", standard: "standard", express: "express", pickup: "pickup" };
    const payMap = { card: "card", ezcash: "ezcash", bank: "bank_transfer", cod: "cod" };
    const items = getCart().map(c => {
      const isCustom = String(c.id || "").startsWith("custom");
      if (isCustom) {
        return { custom: true, name: c.name, priceLkr: c.price, quantity: c.qty, customDesignId: c.customDesignId || undefined, designSpec: c.designSpec || undefined };
      }
      return { productSlug: c.id, size: c.size || undefined, color: c.colorName || undefined, quantity: c.qty };
    });
    return {
      email: d["Email"] || "",
      items,
      couponCode: state.coupon || undefined,
      shippingMethod: methodMap[order.shippingMethod] || "standard",
      paymentMethod: payMap[order.payment] || "cod",
      customer: { name: order.customer.name, phone: order.customer.phone },
      shippingAddress: {
        recipientName: `${d["First Name"] || ""} ${d["Last Name"] || ""}`.trim() || "Customer",
        phone: d["Phone Number"] || "", line1: d["Address Line 1"] || "", line2: d["Address Line 2"] || "",
        city: d["City"] || "", district: d["District"] || "", province: d["Province"] || "",
        postalCode: d["Postal Code"] || "", country: "LK"
      }
    };
  }

  function readCard() {
    return {
      number: ($("#cardNumber")?.value || "").trim(),
      expiry: ($("#cardExpiry")?.value || "").trim(),
      cvv: ($("#cardCvv")?.value || "").trim(),
      name: ($("#cardName")?.value || "").trim()
    };
  }

  $("#checkoutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const cart = getCart();
    if (!cart.length) { toast("Your bag is empty"); return; }
    // Required-field validation with focus + feedback.
    const missing = [...form.querySelectorAll("[required]")].find(f => !String(f.value || "").trim());
    if (missing) { missing.focus(); missing.scrollIntoView({ block: "center", behavior: "smooth" }); toast("Please complete all required fields"); return; }

    const d = collectAddress(form);
    const sub = cartTotal();
    let ship = (sub >= 15000 && state.shipping.id !== "express") ? 0 : state.shipping.price;
    if (state.coupon === "FREESHIP") ship = 0;
    const discount = state.coupon === "ZERO10" ? Math.round(sub * 0.1) : 0;
    const total = Math.max(0, sub - discount) + ship;

    const order = {
      order: genOrderNo(),
      items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price, size: c.size, colorName: c.colorName, note: c.note, label: c.label })),
      subtotal: sub, shipping: ship, discount, total,
      payment: state.pay, shippingMethod: state.shipping.id,
      customer: { name: `${d["First Name"] || ""} ${d["Last Name"] || ""}`.trim(), email: d["Email"] || "", phone: d["Phone Number"] || "" },
      address: d, placedAt: Date.now(), status: 0
    };

    const btn = form.querySelector('button[type="submit"]');
    btn?.classList.add("is-busy");
    const finish = (ord) => {
      window.ZERO.saveOrder(ord);
      window.ZERO.store.set("zero_cart", []);
      toast("Order placed — " + ord.order);
      setTimeout(() => location.href = "tracking.html?order=" + ord.order, 700);
    };
    const failHard = (msg) => { btn?.classList.remove("is-busy"); toast(msg || "Payment failed — please check your details"); };

    if (online()) {
      // Basic card pre-validation for instant feedback.
      if (state.pay === "card") {
        const card = readCard();
        if (!card.number || !card.expiry || !card.cvv || !card.name) { return failHard("Please complete your card details"); }
      }
      window.ZERO.api.post("/orders", buildApiPayload(order, d), { "Idempotency-Key": order.order })
        .then(async (res) => {
          const orderNumber = res.orderNumber || order.order;
          const placed = { ...order, order: orderNumber };
          // Settle payment by method.
          if (state.pay === "card") {
            await window.ZERO.api.post("/payments/card", { orderNumber, card: readCard() }); // throws on invalid card
          } else if (state.pay === "bank" && state.receiptFile) {
            const fd = new FormData();
            fd.append("receipt", state.receiptFile);
            await window.ZERO.api.upload(`/payments/${encodeURIComponent(orderNumber)}/receipt`, fd).catch(() => {});
          }
          finish(placed);
        })
        .catch((err) => {
          const msg = (err && err.data && err.data.error && err.data.error.message) || err.message;
          // Card declined / validation: keep the customer on the page to retry.
          if (state.pay === "card") return failHard(msg);
          // Other methods: fall back to local order so the customer isn't blocked.
          finish(order);
        });
    } else {
      setTimeout(() => finish(order), 450);
    }
  });
});
