// Catalog read API. Shapes products into the exact form the existing ZERØ
// frontend expects (prices in rupees, colors/sizes/oos arrays), so the static
// site lights up against the live API with no further mapping.
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error.js";

const toRupees = (cents) => Math.round((cents || 0) / 100);

// Collapse a product's variants into the frontend's flat shape.
function shapeProduct(p) {
  const colors = [];
  const sizes = [];
  const sizeAvail = {}; // size -> total available across colors

  for (const v of p.variants) {
    if (v.colorHex && !colors.includes(v.colorHex)) colors.push(v.colorHex);
    if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
    const avail = v.inventory ? v.inventory.quantityOnHand - v.inventory.reserved : 0;
    if (v.size) sizeAvail[v.size] = (sizeAvail[v.size] || 0) + Math.max(0, avail);
  }
  const oos = sizes.filter((s) => (sizeAvail[s] || 0) <= 0);

  return {
    id: p.slug, // frontend routes by ?id=<slug>
    slug: p.slug,
    name: p.name,
    cat: p.category ? p.category.name : "",
    collection: p.collection || "",
    price: toRupees(p.basePriceCents),
    was: p.compareAtCents ? toRupees(p.compareAtCents) : 0,
    rating: p.ratingAvg || 0,
    reviews: p.ratingCount || 0,
    colors,
    sizes,
    oos,
    tags: p.tags || [],
    badge: p.badge || "",
    popularity: p.popularity || 0,
    label: p.name.toUpperCase(),
    img: "",
    img2: "",
  };
}

const productInclude = { category: true, variants: { include: { inventory: true } } };

export async function listProducts(query = {}) {
  const where = { status: "active" };
  if (query.collection) where.collection = query.collection;
  if (query.cat) where.category = { name: query.cat };

  const products = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { popularity: "desc" },
    take: Math.min(Number(query.limit) || 100, 200),
  });
  return products.map(shapeProduct);
}

export async function getProductBySlug(slug) {
  const product = await prisma.product.findUnique({ where: { slug }, include: productInclude });
  if (!product) throw ApiError.notFound("Product not found");
  return shapeProduct(product);
}

export async function listCategories() {
  const cats = await prisma.category.findMany({ orderBy: { position: "asc" } });
  return cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
}

export async function listReviews(slug) {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) throw ApiError.notFound("Product not found");
  const reviews = await prisma.review.findMany({
    where: { productId: product.id, status: "published" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { firstName: true } } },
  });
  return reviews.map((r) => ({
    rating: r.rating,
    title: r.title,
    text: r.body,
    name: r.user ? r.user.firstName : "ZERØ Customer",
    verified: Boolean(r.orderId),
    createdAt: r.createdAt,
  }));
}
