// Auth routes: signup, login, logout, refresh, verify, forgot/reset, me.
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import * as auth from "./auth.service.js";

const router = Router();

const meta = (req) => ({ userAgent: req.headers["user-agent"], ip: req.ip });

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const tokenSchema = z.object({ token: z.string().min(10) });
const emailSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(8) });

router.post("/signup", authLimiter, validate(signupSchema), async (req, res, next) => {
  try { res.status(201).json(await auth.signup(req.body, meta(req))); } catch (e) { next(e); }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try { res.json(await auth.login(req.body, meta(req))); } catch (e) { next(e); }
});

router.post("/refresh", async (req, res, next) => {
  try { res.json(await auth.refresh(req.body || {}, meta(req))); } catch (e) { next(e); }
});

router.post("/logout", async (req, res, next) => {
  try { res.json(await auth.logout(req.body || {})); } catch (e) { next(e); }
});

router.post("/verify-email", validate(tokenSchema), async (req, res, next) => {
  try { res.json(await auth.verifyEmail(req.body)); } catch (e) { next(e); }
});

router.post("/forgot-password", authLimiter, validate(emailSchema), async (req, res, next) => {
  try { res.json(await auth.requestPasswordReset(req.body)); } catch (e) { next(e); }
});

router.post("/reset-password", authLimiter, validate(resetSchema), async (req, res, next) => {
  try { res.json(await auth.resetPassword(req.body)); } catch (e) { next(e); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try { res.json(await auth.me(req.user.id)); } catch (e) { next(e); }
});

export default router;
