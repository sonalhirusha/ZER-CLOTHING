/* ZERØ CLOTHING — Product & content data */
const ZERO_WHATSAPP = "94778691065";
const CURRENCY = "LKR";

const PRODUCTS = [
  { id: "z-acid-hood-blk", name: "Acid Wash Hoodie — Onyx", cat: "Acid Wash Hoodies", collection: "Acid Wash", price: 8900, was: 11500, rating: 4.9, reviews: 214, colors: ["#0a0a0a","#3a3a3a"], sizes: ["S","M","L","XL","XXL"], oos: ["XXL"], tags: ["Bestseller"], badge: "Bestseller", popularity: 98, date: 20260520, label: "ACID WASH HOODIE" },
  { id: "z-over-tee-bone", name: "Oversized Tee — Bone", cat: "Oversized Tees", collection: "Essentials", price: 4200, was: 0, rating: 4.8, reviews: 168, colors: ["#f5f5f5","#0a0a0a","#7d7d7d"], sizes: ["S","M","L","XL"], oos: [], tags: ["New"], badge: "New", popularity: 91, date: 20260601, label: "OVERSIZED TEE" },
  { id: "z-custom-tee-blk", name: "Custom Print Tee — Black", cat: "Custom T-Shirts", collection: "Custom", price: 3900, was: 0, rating: 4.7, reviews: 322, colors: ["#0a0a0a","#f5f5f5"], sizes: ["S","M","L","XL","XXL"], oos: [], tags: ["Customisable"], badge: "Designed By You", popularity: 95, date: 20260512, label: "CUSTOM TEE" },
  { id: "z-acid-hood-gry", name: "Acid Wash Hoodie — Ash", cat: "Acid Wash Hoodies", collection: "Acid Wash", price: 8900, was: 0, rating: 4.9, reviews: 142, colors: ["#7d7d7d","#0a0a0a"], sizes: ["S","M","L","XL"], oos: [], tags: [], badge: "", popularity: 88, date: 20260505, label: "ACID WASH ASH" },
  { id: "z-couple-hood", name: "His & Hers Hoodie Set", cat: "Couple Sets", collection: "Couple", price: 15900, was: 18900, rating: 5.0, reviews: 97, colors: ["#0a0a0a","#f5f5f5"], sizes: ["S","M","L","XL"], oos: [], tags: ["Couple","Sale"], badge: "Couple Set", popularity: 93, date: 20260528, label: "COUPLE HOODIES" },
  { id: "z-graphic-tee-01", name: "Graphic Tee — Static", cat: "Graphic Tees", collection: "Essentials", price: 4500, was: 0, rating: 4.6, reviews: 88, colors: ["#0a0a0a","#f5f5f5"], sizes: ["S","M","L","XL","XXL"], oos: ["S"], tags: [], badge: "", popularity: 80, date: 20260418, label: "GRAPHIC TEE" },
  { id: "z-over-hood-blk", name: "Oversized Hoodie — Void", cat: "Acid Wash Hoodies", collection: "Essentials", price: 7900, was: 0, rating: 4.8, reviews: 131, colors: ["#0a0a0a"], sizes: ["M","L","XL","XXL"], oos: [], tags: ["New"], badge: "New", popularity: 85, date: 20260530, label: "OVERSIZED HOODIE" },
  { id: "z-acid-vintage", name: "Acid Wash Tee — Vintage", cat: "Oversized Tees", collection: "Acid Wash", price: 4900, was: 6200, rating: 4.7, reviews: 76, colors: ["#7d7d7d","#3a3a3a"], sizes: ["S","M","L","XL"], oos: [], tags: ["Sale"], badge: "Sale", popularity: 78, date: 20260410, label: "ACID VINTAGE" },
  { id: "z-couple-tee", name: "Matching Tee Set — Mono", cat: "Couple Sets", collection: "Couple", price: 7800, was: 0, rating: 4.9, reviews: 64, colors: ["#0a0a0a","#f5f5f5"], sizes: ["S","M","L","XL"], oos: [], tags: ["Couple"], badge: "Couple Set", popularity: 82, date: 20260522, label: "COUPLE TEES" },
  { id: "z-cap-blk", name: "ZERØ Logo Cap", cat: "Accessories", collection: "Essentials", price: 2900, was: 0, rating: 4.5, reviews: 53, colors: ["#0a0a0a","#f5f5f5"], sizes: ["One Size"], oos: [], tags: [], badge: "", popularity: 70, date: 20260401, label: "LOGO CAP" },
  { id: "z-sweat-bone", name: "Heavyweight Sweatshirt — Bone", cat: "Custom Prints", collection: "Custom", price: 6900, was: 0, rating: 4.8, reviews: 110, colors: ["#f5f5f5","#0a0a0a"], sizes: ["S","M","L","XL","XXL"], oos: [], tags: ["Customisable"], badge: "Designed By You", popularity: 87, date: 20260515, label: "SWEATSHIRT" },
  { id: "z-tote-blk", name: "Canvas Tote — Mark", cat: "Accessories", collection: "Essentials", price: 2200, was: 0, rating: 4.6, reviews: 41, colors: ["#0a0a0a"], sizes: ["One Size"], oos: [], tags: [], badge: "", popularity: 60, date: 20260408, label: "CANVAS TOTE" }
];

const FILTER_CATS = ["Custom T-Shirts","Acid Wash Hoodies","Oversized Tees","Couple Sets","Graphic Tees","Custom Prints","Accessories"];
const FILTER_SIZES = ["S","M","L","XL","XXL"];
const FILTER_COLORS = [["#0a0a0a","Black"],["#f5f5f5","White"],["#7d7d7d","Gray"],["#3a3a3a","Charcoal"]];
const FILTER_COLLECTIONS = ["Acid Wash","Couple","Custom","Essentials"];


const REVIEWS = [
  { name: "Dineth P.", city: "Colombo", rating: 5, text: "Genuinely the best quality streetwear I've found in Sri Lanka. The acid wash hoodie feels premium and the print hasn't faded after 20 washes.", photos: 2 },
  { name: "Sachini R.", city: "Kandy", rating: 5, text: "Designed our anniversary couple set on the customizer — the live preview was exactly what arrived. Packaging felt like a luxury brand.", photos: 1 },
  { name: "Ishara M.", city: "Galle", rating: 5, text: "Fast island-wide delivery, paid by bank transfer and sent the receipt on WhatsApp. Smooth from start to finish. Will order again.", photos: 0 },
  { name: "Tharindu W.", city: "Negombo", rating: 5, text: "Oversized fit is perfect, heavyweight fabric. ZERØ is easily competing with the international brands I used to import.", photos: 2 },
  { name: "Nethmi S.", city: "Jaffna", rating: 4, text: "Loved the minimalist aesthetic. Customer support on WhatsApp answered in minutes and helped me pick a size.", photos: 0 },
  { name: "Kavindu J.", city: "Matara", rating: 5, text: "The customizer is addictive. Uploaded my own artwork, dropped it on the back print, price updated live. Came out flawless.", photos: 1 }
];

const SL_PROVINCES = ["Western","Central","Southern","Northern","Eastern","North Western","North Central","Uva","Sabaragamuwa"];
const SL_DISTRICTS = ["Ampara","Anuradhapura","Badulla","Batticaloa","Colombo","Galle","Gampaha","Hambantota","Jaffna","Kalutara","Kandy","Kegalle","Kilinochchi","Kurunegala","Mannar","Matale","Matara","Monaragala","Mullaitivu","Nuwara Eliya","Polonnaruwa","Puttalam","Ratnapura","Trincomalee","Vavuniya"];

const SHIPPING = [
  { id: "speed", name: "Speed Post", desc: "2–4 working days · SL Post", price: 450 },
  { id: "standard", name: "Standard Delivery", desc: "3–6 working days · Islandwide", price: 350 },
  { id: "express", name: "Express Delivery", desc: "1–2 working days · Courier", price: 850 },
  { id: "pickup", name: "Store Pickup", desc: "Colombo 05 · Ready in 24h", price: 0 }
];

const CUSTOM_TYPES = [
  { id: "tee", name: "T-Shirt", base: 3900, label: "TEE" },
  { id: "oversized", name: "Oversized Tee", base: 4200, label: "OVERSIZED" },
  { id: "hoodie", name: "Hoodie", base: 7900, label: "HOODIE" },
  { id: "acid", name: "Acid Wash Hoodie", base: 8900, label: "ACID HOODIE" },
  { id: "sweat", name: "Sweatshirt", base: 6900, label: "SWEATSHIRT" },
  { id: "couple-tee", name: "Couple Shirts", base: 7800, label: "COUPLE TEES" },
  { id: "couple-hood", name: "Couple Hoodies", base: 15900, label: "COUPLE HOODIES" }
];
const PRINT_PRICES = { upload: 600, text: 400, back: 500, sleeve: 350 };
