// Public support routes — contact form (creates a ticket) + newsletter signup.
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { optionalAuth } from "../../middleware/auth.js";
import * as support from "./support.service.js";

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  subject: z.string().max(160).optional(),
  message: z.string().min(1).max(5000),
});

router.post("/contact", optionalAuth, validate(contactSchema), async (req, res, next) => {
  try { res.status(201).json(await support.createTicket(req.body, req.user ? req.user.id : null)); } catch (e) { next(e); }
});

router.post("/newsletter", validate(z.object({ email: z.string().email() })), async (req, res, next) => {
  try { res.json(await support.subscribeNewsletter(req.body.email)); } catch (e) { next(e); }
});

export default router;
