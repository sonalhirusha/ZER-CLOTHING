// Custom design routes — save designs + upload artwork + list + reorder.
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth, optionalAuth } from "../../middleware/auth.js";
import { uploadInto, publicFile } from "../../lib/upload.js";
import { ApiError } from "../../middleware/error.js";
import * as designs from "./designs.service.js";

const router = Router();

const designSchema = z.object({
  garmentType: z.string().optional(),
  type: z.string().optional(),
  garmentColor: z.string().optional(),
  garment: z.string().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  spec: z.any().optional(),
}).passthrough();

router.post("/designs", optionalAuth, validate(designSchema), async (req, res, next) => {
  try { res.status(201).json(await designs.createDesign(req.body, req.user ? req.user.id : null)); } catch (e) { next(e); }
});

// Upload artwork for a design (multipart; field name: "artwork").
router.post("/designs/:id/artwork", optionalAuth, ...uploadInto("artwork", "artwork"), async (req, res, next) => {
  try {
    if (!req.file) throw ApiError.badRequest("Artwork file is required (field: artwork)");
    const file = publicFile(req, req.file);
    const dims = { widthPx: req.body.widthPx, heightPx: req.body.heightPx, dpi: req.body.dpi };
    res.json(await designs.attachArtwork(req.params.id, file, dims, req.user ? req.user.id : null));
  } catch (e) { next(e); }
});

router.get("/designs", requireAuth, async (req, res, next) => {
  try { res.json(await designs.listDesigns(req.user.id)); } catch (e) { next(e); }
});

router.get("/designs/:id", optionalAuth, async (req, res, next) => {
  try { res.json(await designs.getDesign(req.params.id, req.user ? req.user.id : null)); } catch (e) { next(e); }
});

router.post("/designs/:id/reorder", requireAuth, async (req, res, next) => {
  try { res.status(201).json(await designs.reorderDesign(req.params.id, req.user.id)); } catch (e) { next(e); }
});

export default router;
