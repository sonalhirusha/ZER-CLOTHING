// Admin routes — login is public; everything else requires an admin token.
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as admin from "./admin.service.js";
import * as payments from "../payments/payments.service.js";
import * as support from "../support/support.service.js";
import * as analytics from "../analytics/analytics.service.js";

const router = Router();

router.post(
  "/login",
  authLimiter,
  validate(z.object({ email: z.string().email(), password: z.string().min(1) })),
  async (req, res, next) => {
    try { res.json(await admin.adminLogin(req.body)); } catch (e) { next(e); }
  }
);

// Everything below requires a valid admin token.
router.use(requireAdmin);

router.get("/me", (req, res) => res.json({ admin: req.admin }));

// Dashboard analytics
router.get("/analytics", async (req, res, next) => {
  try { res.json(await analytics.getSummary({ days: Number(req.query.days) || 30 })); } catch (e) { next(e); }
});

// Orders
router.get("/orders", async (req, res, next) => {
  try { res.json(await admin.listOrders({ status: req.query.status, q: req.query.q })); } catch (e) { next(e); }
});
router.get("/orders/:orderNumber", async (req, res, next) => {
  try { res.json(await admin.getOrder(req.params.orderNumber)); } catch (e) { next(e); }
});
router.post(
  "/orders/:orderNumber/status",
  validate(z.object({ status: z.string(), note: z.string().optional() })),
  async (req, res, next) => {
    try { res.json(await admin.updateOrderStatus(req.params.orderNumber, req.body.status, req.admin.id, req.body.note)); } catch (e) { next(e); }
  }
);

// Shipping
router.post("/orders/:orderNumber/shipment", async (req, res, next) => {
  try { res.json(await admin.updateShipment(req.params.orderNumber, req.body || {}, req.admin.id)); } catch (e) { next(e); }
});

// Payments
router.get("/payments", async (req, res, next) => {
  try { res.json(await admin.listPayments({ status: req.query.status })); } catch (e) { next(e); }
});
router.post("/payments/:orderNumber/verify", async (req, res, next) => {
  try { res.json(await payments.verifyPayment(req.params.orderNumber, req.admin.id)); } catch (e) { next(e); }
});
router.post("/payments/:orderNumber/refund", async (req, res, next) => {
  try { res.json(await payments.refundPayment(req.params.orderNumber, req.admin.id)); } catch (e) { next(e); }
});

// Customers
router.get("/customers", async (req, res, next) => {
  try { res.json(await admin.listCustomers({ q: req.query.q })); } catch (e) { next(e); }
});
router.get("/customers/:id", async (req, res, next) => {
  try { res.json(await admin.getCustomer(req.params.id)); } catch (e) { next(e); }
});

// Products
router.get("/products", async (req, res, next) => {
  try { res.json(await admin.listProducts()); } catch (e) { next(e); }
});
router.post("/products", validate(z.object({ name: z.string().min(1) }).passthrough()), async (req, res, next) => {
  try { res.status(201).json(await admin.createProduct(req.body)); } catch (e) { next(e); }
});
router.patch("/products/:slug", async (req, res, next) => {
  try { res.json(await admin.updateProduct(req.params.slug, req.body || {})); } catch (e) { next(e); }
});

// Inventory
router.get("/inventory/low-stock", async (req, res, next) => {
  try { res.json(await admin.lowStock()); } catch (e) { next(e); }
});
router.post(
  "/inventory/:variantId",
  validate(z.object({ quantityOnHand: z.number().int().nonnegative() })),
  async (req, res, next) => {
    try { res.json(await admin.updateInventory(req.params.variantId, req.body.quantityOnHand)); } catch (e) { next(e); }
  }
);

// Support tickets
router.get("/tickets", async (req, res, next) => {
  try { res.json(await support.listTickets({ status: req.query.status })); } catch (e) { next(e); }
});
router.get("/tickets/:id", async (req, res, next) => {
  try { res.json(await support.getTicket(req.params.id)); } catch (e) { next(e); }
});
router.post(
  "/tickets/:id/reply",
  validate(z.object({ body: z.string().min(1), status: z.string().optional() })),
  async (req, res, next) => {
    try { res.json(await support.replyTicket(req.params.id, req.body, req.admin.id)); } catch (e) { next(e); }
  }
);

export default router;
