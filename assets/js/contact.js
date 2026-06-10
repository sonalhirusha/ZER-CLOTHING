/* ZERØ — Contact & FAQ */
document.addEventListener("DOMContentLoaded", function () {
  const { $, toast } = window.ZERO;

  const FAQ = [
    ["How long does a custom order take?", "Custom orders are printed and packed within 48 hours, then shipped. Total delivery is typically 2–4 working days with Speed Post or 1–2 days with Express courier."],
    ["What payment methods do you accept?", "Visa, Mastercard, debit & credit cards, EZ Cash, bank transfer (with receipt upload or WhatsApp verification) and cash on delivery islandwide."],
    ["Do you deliver to my area?", "Yes — we deliver to all 9 provinces and all 25 districts across Sri Lanka. Free delivery on orders over Rs 15,000."],
    ["Can I return or exchange an item?", "Non-custom items can be returned within 7 days in unworn condition. Custom-printed pieces are made to order and can only be returned if faulty."],
    ["How do I care for my acid wash piece?", "Wash cold inside-out, do not bleach, hang or tumble dry low and iron in reverse. Each acid wash fade is one-of-one and will soften beautifully over time."],
    ["Can I send my payment receipt on WhatsApp?", "Absolutely. At checkout choose Bank Transfer, then tap 'Send Receipt On WhatsApp' — a pre-filled message opens to 077 869 1065 for instant verification."]
  ];
  $("#faqAcc").innerHTML = FAQ.map(f => `
    <div class="acc-item"><button class="acc-head" data-acc>${f[0]}<span class="pm"></span></button>
    <div class="acc-body"><div class="acc-body-inner">${f[1]}</div></div></div>`).join("");

  document.addEventListener("click", (e) => {
    const acc = e.target.closest("[data-acc]");
    if (acc) {
      const item = acc.closest(".acc-item"); const body = item.querySelector(".acc-body");
      const open = item.classList.toggle("open");
      body.style.maxHeight = open ? body.querySelector(".acc-body-inner").scrollHeight + 24 + "px" : "0";
    }
  });

  $("#contactForm").addEventListener("submit", (e) => { e.preventDefault(); e.target.reset(); toast("Message sent — we'll reply shortly"); });
});
