// Customer account routes (all require auth).
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import * as account from "./account.service.js";

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(20).optional(),
  marketingOptIn: z.boolean().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
});

const addressSchema = z.object({
  label: z.string().optional(),
  recipientName: z.string().min(1),
  phone: z.string().min(6),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  district: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default("LK"),
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});

router.get("/overview", async (req, res, next) => {
  try { res.json(await account.overview(req.user.id)); } catch (e) { next(e); }
});

router.patch("/profile", validate(profileSchema), async (req, res, next) => {
  try { res.json(await account.updateProfile(req.user.id, req.body)); } catch (e) { next(e); }
});

router.post("/change-password", validate(passwordSchema), async (req, res, next) => {
  try { res.json(await account.changePassword(req.user.id, req.body)); } catch (e) { next(e); }
});

router.get("/addresses", async (req, res, next) => {
  try { res.json(await account.listAddresses(req.user.id)); } catch (e) { next(e); }
});
router.post("/addresses", validate(addressSchema), async (req, res, next) => {
  try { res.status(201).json(await account.createAddress(req.user.id, req.body)); } catch (e) { next(e); }
});
router.patch("/addresses/:id", validate(addressSchema.partial()), async (req, res, next) => {
  try { res.json(await account.updateAddress(req.user.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete("/addresses/:id", async (req, res, next) => {
  try { res.json(await account.deleteAddress(req.user.id, req.params.id)); } catch (e) { next(e); }
});

router.get("/wishlist", async (req, res, next) => {
  try { res.json(await account.listWishlist(req.user.id)); } catch (e) { next(e); }
});
router.post("/wishlist", validate(z.object({ productSlug: z.string().min(1) })), async (req, res, next) => {
  try { res.json(await account.addWishlist(req.user.id, req.body.productSlug)); } catch (e) { next(e); }
});
router.delete("/wishlist/:slug", async (req, res, next) => {
  try { res.json(await account.removeWishlist(req.user.id, req.params.slug)); } catch (e) { next(e); }
});

router.get("/notifications", async (req, res, next) => {
  try { res.json(await account.listNotifications(req.user.id)); } catch (e) { next(e); }
});
router.post("/notifications/read-all", async (req, res, next) => {
  try { res.json(await account.markAllNotificationsRead(req.user.id)); } catch (e) { next(e); }
});
router.post("/notifications/:id/read", async (req, res, next) => {
  try { res.json(await account.markNotificationRead(req.user.id, req.params.id)); } catch (e) { next(e); }
});

export default router;
