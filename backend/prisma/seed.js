// Seed the database with the ZERØ catalog, coupons, an admin user and a few
// reviews. Mirrors assets/js/data.js so the API serves the same products the
// static site shows. Run: npm run seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COLOR_NAMES = {
  "#0a0a0a": "Black", "#000000": "Black", "#f5f5f5": "Bone", "#ffffff": "White",
  "#7d7d7d": "Ash", "#3a3a3a": "Charcoal", "#1a2942": "Navy",
};

// Mirror of the frontend catalog (prices in LKR rupees).
const PRODUCTS = [
  { id: "z-acid-hood-blk", name: "Acid Wash Hoodie — Onyx", cat: "Acid Wash Hoodies", collection: "Acid Wash", price: 8900, was: 11500, rating: 4.9, reviews: 214, colors: ["#0a0a0a", "#3a3a3a"], sizes: ["S", "M", "L", "XL", "XXL"], oos: ["XXL"], tags: ["Bestseller"], badge: "Bestseller", popularity: 98 },
  { id: "z-over-tee-bone", name: "Oversized Tee — Bone", cat: "Oversized Tees", collection: "Essentials", price: 4200, was: 0, rating: 4.8, reviews: 168, colors: ["#f5f5f5", "#0a0a0a", "#7d7d7d"], sizes: ["S", "M", "L", "XL"], oos: [], tags: ["New"], badge: "New", popularity: 91 },
  { id: "z-custom-tee-blk", name: "Custom Print Tee — Black", cat: "Custom T-Shirts", collection: "Custom", price: 3900, was: 0, rating: 4.7, reviews: 322, colors: ["#0a0a0a", "#f5f5f5"], sizes: ["S", "M", "L", "XL", "XXL"], oos: [], tags: ["Customisable"], badge: "Designed By You", popularity: 95 },
  { id: "z-acid-hood-gry", name: "Acid Wash Hoodie — Ash", cat: "Acid Wash Hoodies", collection: "Acid Wash", price: 8900, was: 0, rating: 4.9, reviews: 142, colors: ["#7d7d7d", "#0a0a0a"], sizes: ["S", "M", "L", "XL"], oos: [], tags: [], badge: "", popularity: 88 },
  { id: "z-couple-hood", name: "His & Hers Hoodie Set", cat: "Couple Sets", collection: "Couple", price: 15900, was: 18900, rating: 5.0, reviews: 97, colors: ["#0a0a0a", "#f5f5f5"], sizes: ["S", "M", "L", "XL"], oos: [], tags: ["Couple", "Sale"], badge: "Couple Set", popularity: 93 },
  { id: "z-graphic-tee-01", name: "Graphic Tee — Static", cat: "Graphic Tees", collection: "Essentials", price: 4500, was: 0, rating: 4.6, reviews: 88, colors: ["#0a0a0a", "#f5f5f5"], sizes: ["S", "M", "L", "XL", "XXL"], oos: ["S"], tags: [], badge: "", popularity: 80 },
  { id: "z-over-hood-blk", name: "Oversized Hoodie — Void", cat: "Acid Wash Hoodies", collection: "Essentials", price: 7900, was: 0, rating: 4.8, reviews: 131, colors: ["#0a0a0a"], sizes: ["M", "L", "XL", "XXL"], oos: [], tags: ["New"], badge: "New", popularity: 85 },
  { id: "z-acid-vintage", name: "Acid Wash Tee — Vintage", cat: "Oversized Tees", collection: "Acid Wash", price: 4900, was: 6200, rating: 4.7, reviews: 76, colors: ["#7d7d7d", "#3a3a3a"], sizes: ["S", "M", "L", "XL"], oos: [], tags: ["Sale"], badge: "Sale", popularity: 78 },
  { id: "z-couple-tee", name: "Matching Tee Set — Mono", cat: "Couple Sets", collection: "Couple", price: 7800, was: 0, rating: 4.9, reviews: 64, colors: ["#0a0a0a", "#f5f5f5"], sizes: ["S", "M", "L", "XL"], oos: [], tags: ["Couple"], badge: "Couple Set", popularity: 82 },
  { id: "z-cap-blk", name: "ZERØ Logo Cap", cat: "Accessories", collection: "Essentials", price: 2900, was: 0, rating: 4.5, reviews: 53, colors: ["#0a0a0a", "#f5f5f5"], sizes: ["One Size"], oos: [], tags: [], badge: "", popularity: 70 },
  { id: "z-sweat-bone", name: "Heavyweight Sweatshirt — Bone", cat: "Custom Prints", collection: "Custom", price: 6900, was: 0, rating: 4.8, reviews: 110, colors: ["#f5f5f5", "#0a0a0a"], sizes: ["S", "M", "L", "XL", "XXL"], oos: [], tags: ["Customisable"], badge: "Designed By You", popularity: 87 },
  { id: "z-tote-blk", name: "Canvas Tote — Mark", cat: "Accessories", collection: "Essentials", price: 2200, was: 0, rating: 4.6, reviews: 41, colors: ["#0a0a0a"], sizes: ["One Size"], oos: [], tags: [], badge: "", popularity: 60 },
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  console.log("Seeding ZERØ catalog…");

  // Categories
  const catNames = [...new Set(PRODUCTS.map((p) => p.cat))];
  const catByName = {};
  for (let i = 0; i < catNames.length; i++) {
    const name = catNames[i];
    const cat = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { name, position: i },
      create: { slug: slugify(name), name, position: i },
    });
    catByName[name] = cat.id;
  }

  // Products + variants + inventory
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: p.id },
      update: {
        name: p.name,
        basePriceCents: p.price * 100,
        compareAtCents: p.was ? p.was * 100 : null,
        badge: p.badge || null,
        tags: JSON.stringify(p.tags || []),
        collection: p.collection || null,
        ratingAvg: p.rating || 0,
        ratingCount: p.reviews || 0,
        popularity: p.popularity || 0,
        categoryId: catByName[p.cat],
      },
      create: {
        slug: p.id,
        name: p.name,
        description: "Heavyweight premium streetwear, finished by hand in Colombo.",
        categoryId: catByName[p.cat],
        basePriceCents: p.price * 100,
        compareAtCents: p.was ? p.was * 100 : null,
        currency: "LKR",
        status: "active",
        badge: p.badge || null,
        tags: JSON.stringify(p.tags || []),
        collection: p.collection || null,
        ratingAvg: p.rating || 0,
        ratingCount: p.reviews || 0,
        popularity: p.popularity || 0,
      },
    });

    let pos = 0;
    for (const size of p.sizes) {
      for (let ci = 0; ci < p.colors.length; ci++) {
        const hex = p.colors[ci];
        const sku = `${p.id}-${slugify(size)}-${ci}`;
        const available = p.oos.includes(size) ? 0 : 25;
        const variant = await prisma.productVariant.upsert({
          where: { sku },
          update: {},
          create: {
            productId: product.id,
            sku,
            size,
            colorHex: hex,
            colorName: COLOR_NAMES[hex] || "Black",
            position: pos++,
          },
        });
        await prisma.inventory.upsert({
          where: { variantId: variant.id },
          update: { quantityOnHand: available },
          create: { variantId: variant.id, quantityOnHand: available, reorderLevel: 5 },
        });
      }
    }
  }

  // Coupons
  await prisma.coupon.upsert({
    where: { code: "ZERO10" },
    update: {},
    create: { code: "ZERO10", type: "percent", value: 10, minSubtotalCents: 0, perUserLimit: 1, active: true },
  });
  await prisma.coupon.upsert({
    where: { code: "FREESHIP" },
    update: {},
    create: { code: "FREESHIP", type: "free_ship", value: 0, minSubtotalCents: 0, perUserLimit: 1, active: true },
  });

  // Admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@zeroclothing.lk";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "ZERØ Admin",
      passwordHash: await bcrypt.hash(adminPass, 12),
      role: "super_admin",
    },
  });

  // A couple of published reviews on the hero product
  const hero = await prisma.product.findUnique({ where: { slug: "z-acid-hood-blk" } });
  if (hero) {
    const count = await prisma.review.count({ where: { productId: hero.id } });
    if (count === 0) {
      await prisma.review.createMany({
        data: [
          { productId: hero.id, rating: 5, title: "Premium feel", body: "Best streetwear quality I've found in Sri Lanka. Print still crisp after 20 washes.", status: "published" },
          { productId: hero.id, rating: 5, title: "True to size", body: "Heavyweight and perfectly oversized. Fast islandwide delivery.", status: "published" },
        ],
      });
    }
  }

  console.log(`Seeded ${PRODUCTS.length} products, 2 coupons, admin (${adminEmail} / ${adminPass}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
