// Custom design studio persistence: save spec (garment, colors, text, placement,
// dimensions), upload artwork assets, list a customer's saved designs, reorder.
import { prisma } from "../../lib/prisma.js";
import { toJSON, fromJSON } from "../../lib/json.js";
import { ApiError } from "../../middleware/error.js";

function shapeDesign(d) {
  if (!d) return null;
  return {
    id: d.id,
    garmentType: d.garmentType,
    garmentColor: d.garmentColor,
    status: d.status,
    totalCents: d.totalCents,
    spec: fromJSON(d.spec, {}),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    assets: (d.assets || []).map((a) => ({ id: a.id, kind: a.kind, url: a.url, mime: a.mime, widthPx: a.widthPx, heightPx: a.heightPx })),
  };
}

export async function createDesign(input, userId) {
  const design = await prisma.customDesign.create({
    data: {
      userId: userId || null,
      garmentType: input.garmentType || input.type || "tee",
      garmentColor: input.garmentColor || input.garment || null,
      status: userId ? "saved" : "draft",
      totalCents: Math.max(0, Math.round(Number(input.totalCents ?? (input.total || 0) * 100))),
      spec: toJSON(input.spec || input) || "{}",
    },
    include: { assets: true },
  });
  return shapeDesign(design);
}

export async function attachArtwork(designId, file, dims, userId) {
  const design = await prisma.customDesign.findUnique({ where: { id: designId } });
  if (!design) throw ApiError.notFound("Design not found");
  if (design.userId && userId && design.userId !== userId) throw ApiError.forbidden();

  await prisma.designAsset.create({
    data: {
      customDesignId: designId,
      kind: "source_upload",
      storageKey: file.key,
      url: file.url,
      mime: file.mime,
      fileSize: file.size,
      widthPx: dims.widthPx ? Number(dims.widthPx) : null,
      heightPx: dims.heightPx ? Number(dims.heightPx) : null,
      dpi: dims.dpi ? Number(dims.dpi) : null,
    },
  });
  const full = await prisma.customDesign.findUnique({ where: { id: designId }, include: { assets: true } });
  return shapeDesign(full);
}

export async function listDesigns(userId) {
  const designs = await prisma.customDesign.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { assets: true },
  });
  return designs.map(shapeDesign);
}

export async function getDesign(id, userId) {
  const d = await prisma.customDesign.findUnique({ where: { id }, include: { assets: true } });
  if (!d) throw ApiError.notFound("Design not found");
  if (d.userId && userId && d.userId !== userId) throw ApiError.forbidden();
  return shapeDesign(d);
}

export async function reorderDesign(id, userId) {
  const original = await prisma.customDesign.findUnique({ where: { id }, include: { assets: true } });
  if (!original) throw ApiError.notFound("Design not found");
  if (original.userId && userId && original.userId !== userId) throw ApiError.forbidden();

  const copy = await prisma.customDesign.create({
    data: {
      userId: userId || original.userId || null,
      garmentType: original.garmentType,
      garmentColor: original.garmentColor,
      status: "saved",
      totalCents: original.totalCents,
      spec: original.spec,
      reorderOfId: original.id,
      assets: {
        create: (original.assets || []).map((a) => ({
          kind: a.kind, storageKey: a.storageKey, url: a.url, mime: a.mime, widthPx: a.widthPx, heightPx: a.heightPx, dpi: a.dpi, fileSize: a.fileSize,
        })),
      },
    },
    include: { assets: true },
  });
  return shapeDesign(copy);
}
