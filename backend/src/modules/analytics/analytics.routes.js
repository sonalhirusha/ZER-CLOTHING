// Public analytics ingestion endpoint (page views, add_to_cart, begin_checkout…).
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { optionalAuth } from "../../middleware/auth.js";
import * as analytics from "./analytics.service.js";

const router = Router();

const eventSchema = z.object({
  name: z.string().min(1).max(80),
  anonymousId: z.string().max(64).optional(),
  props: z.any().optional(),
  url: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  country: z.string().max(4).optional(),
});

router.post("/analytics/track", optionalAuth, validate(eventSchema), async (req, res, next) => {
  try {
    const out = await analytics.track(req.body, { userId: req.user ? req.user.id : null, userAgent: req.headers["user-agent"] });
    res.json(out);
  } catch (e) { next(e); }
});

export default router;
