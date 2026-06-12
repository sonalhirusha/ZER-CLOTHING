// Payment routes: card charge, receipt upload, status, PayHere webhook.
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { optionalAuth } from "../../middleware/auth.js";
import { uploadInto, publicFile } from "../../lib/upload.js";
import { ApiError } from "../../middleware/error.js";
import * as payments from "./payments.service.js";

const router = Router();

const cardSchema = z.object({
  orderNumber: z.string().min(4),
  card: z.object({
    number: z.string().min(12),
    expiry: z.string().min(4),
    cvv: z.string().min(3),
    name: z.string().min(1),
  }),
});

router.post("/payments/card", optionalAuth, validate(cardSchema), async (req, res, next) => {
  try {
    res.json(await payments.payByCard(req.body.orderNumber, req.body.card, { userId: req.user ? req.user.id : null }));
  } catch (e) { next(e); }
});

// Bank-transfer receipt upload (multipart/form-data; field name: "receipt").
router.post("/payments/:orderNumber/receipt", optionalAuth, ...uploadInto("receipts", "receipt"), async (req, res, next) => {
  try {
    if (!req.file) throw ApiError.badRequest("Receipt file is required (field: receipt)");
    const file = publicFile(req, req.file);
    res.json(await payments.attachReceipt(req.params.orderNumber, file, { userId: req.user ? req.user.id : null }));
  } catch (e) { next(e); }
});

router.get("/payments/:orderNumber", async (req, res, next) => {
  try { res.json(await payments.getPayment(req.params.orderNumber)); } catch (e) { next(e); }
});

// PayHere server-to-server notification webhook.
router.post("/payments/payhere/notify", async (req, res, next) => {
  try { res.json(await payments.handlePayhereNotify(req.body)); } catch (e) { next(e); }
});

export default router;
