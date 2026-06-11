// Order + checkout routes.
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth, optionalAuth } from "../../middleware/auth.js";
import * as orders from "./orders.service.js";

const router = Router();

const addressSchema = z.object({
  recipientName: z.string().min(1),
  phone: z.string().min(7),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  district: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default("LK"),
});

const itemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
  customDesignId: z.string().optional(),
});

const quoteSchema = z.object({
  items: z.array(itemSchema).min(1),
  couponCode: z.string().optional(),
  shippingMethod: z.enum(["speed_post", "standard", "express", "pickup"]),
});

const orderSchema = quoteSchema.extend({
  email: z.string().email(),
  paymentMethod: z.enum(["payhere", "stripe", "ezcash", "bank_transfer", "cod"]),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
});

router.post("/checkout/quote", validate(quoteSchema), async (req, res, next) => {
  try { res.json(await orders.quote(req.body)); } catch (e) { next(e); }
});

router.post("/orders", optionalAuth, validate(orderSchema), async (req, res, next) => {
  try {
    const order = await orders.createOrder(req.body, {
      userId: req.user ? req.user.id : null,
      idempotencyKey: req.headers["idempotency-key"] || null,
    });
    res.status(201).json(order);
  } catch (e) { next(e); }
});

router.get("/orders", requireAuth, async (req, res, next) => {
  try { res.json(await orders.listOrders(req.user.id)); } catch (e) { next(e); }
});

router.get("/orders/:orderNumber", optionalAuth, async (req, res, next) => {
  try { res.json(await orders.getOrder(req.params.orderNumber, req.user ? req.user.id : null)); } catch (e) { next(e); }
});

export default router;
