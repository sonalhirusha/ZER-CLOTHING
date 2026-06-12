// Order + checkout + tracking routes.
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth, optionalAuth } from "../../middleware/auth.js";
import * as orders from "./orders.service.js";

const router = Router();

const addressSchema = z.object({
  recipientName: z.string().min(1),
  phone: z.string().min(6),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  district: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default("LK"),
});

// An item is either a catalog item (variantId OR productSlug+size+color) or a
// custom-studio piece (custom:true with name + price).
const itemSchema = z
  .object({
    variantId: z.string().optional(),
    productSlug: z.string().optional(),
    size: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    quantity: z.number().int().positive().max(50),
    custom: z.boolean().optional(),
    name: z.string().optional(),
    unitPriceCents: z.number().int().positive().optional(),
    priceLkr: z.number().positive().optional(),
    customDesignId: z.string().optional(),
    designSpec: z.any().optional(),
  })
  .refine((i) => i.variantId || i.productSlug || i.custom || i.designSpec || i.customDesignId || i.name, {
    message: "Item must reference a product or be a custom design",
  });

const shippingMethodEnum = z.enum(["speed_post", "standard", "express", "pickup"]);
const paymentMethodEnum = z.enum(["card", "payhere", "stripe", "ezcash", "bank_transfer", "cod"]);

const quoteSchema = z.object({
  items: z.array(itemSchema).min(1),
  couponCode: z.string().optional(),
  shippingMethod: shippingMethodEnum,
});

const orderSchema = quoteSchema.extend({
  email: z.string().email(),
  paymentMethod: paymentMethodEnum,
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  customer: z.object({ name: z.string().optional(), phone: z.string().optional() }).optional(),
});

router.post("/checkout/quote", optionalAuth, validate(quoteSchema), async (req, res, next) => {
  try {
    res.json(await orders.quote(req.body, { userId: req.user ? req.user.id : null }));
  } catch (e) { next(e); }
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

// Public tracking (guest-safe) — used by tracking.html.
router.get("/orders/:orderNumber/tracking", async (req, res, next) => {
  try { res.json(await orders.getTracking(req.params.orderNumber)); } catch (e) { next(e); }
});

router.get("/orders/:orderNumber", optionalAuth, async (req, res, next) => {
  try {
    res.json(await orders.getOrder(req.params.orderNumber, req.user ? req.user.id : null));
  } catch (e) { next(e); }
});

export default router;
