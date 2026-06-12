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

  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const get = (sel) => form.querySelector(sel);
    const name = get('input[required]')?.value.trim() || "";
    const email = get('input[type="email"]')?.value.trim() || "";
    const subject = get("select")?.value || "Enquiry";
    const message = get("textarea")?.value.trim() || "";

    if (!name || !message) { toast("Please add your name and message"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("Enter a valid email address"); get('input[type="email"]')?.focus(); return; }

    const btn = form.querySelector('button[type="submit"]');
    btn?.classList.add("is-busy");

    const done = () => { btn?.classList.remove("is-busy"); form.reset(); toast("Message sent — we'll reply shortly"); };

    if (window.ZERO.online()) {
      // Real backend: open a support ticket + trigger the team email.
      window.ZERO.api.post("/contact", { name, email, subject, message }).then(done).catch(() => {
        btn?.classList.remove("is-busy"); openWhatsApp(name, subject, message);
      });
    } else {
      // Static fallback that still delivers the message: open a pre-filled WhatsApp chat.
      setTimeout(() => { done(); openWhatsApp(name, subject, message); }, 400);
    }
  });

  function openWhatsApp(name, subject, message) {
    const text = `Hi ZERØ! [${subject}]\nName: ${name}\n\n${message}`;
    window.open(`https://wa.me/${ZERO_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }
});
