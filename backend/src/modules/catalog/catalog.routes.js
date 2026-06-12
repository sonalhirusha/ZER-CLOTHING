// Public catalog routes. Consumed by the frontend's ZERO.loadProducts().
import { Router } from "express";
import * as catalog from "./catalog.service.js";

const router = Router();

router.get("/products", async (req, res, next) => {
  try { res.json(await catalog.listProducts(req.query)); } catch (e) { next(e); }
});

router.get("/categories", async (req, res, next) => {
  try { res.json(await catalog.listCategories()); } catch (e) { next(e); }
});

router.get("/products/:slug", async (req, res, next) => {
  try { res.json(await catalog.getProductBySlug(req.params.slug)); } catch (e) { next(e); }
});

router.get("/products/:slug/reviews", async (req, res, next) => {
  try { res.json(await catalog.listReviews(req.params.slug)); } catch (e) { next(e); }
});

export default router;
