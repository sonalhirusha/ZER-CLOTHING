// Admin JWT guard — separate secret + token namespace from customer auth.
import { verifyAdminToken } from "../lib/jwt.js";
import { ApiError } from "./error.js";

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized());
  try {
    const payload = verifyAdminToken(token);
    if (!payload.adm) return next(ApiError.forbidden());
    req.admin = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired admin token"));
  }
}

export function requireAdminRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) return next(ApiError.unauthorized());
    if (roles.length && !roles.includes(req.admin.role)) return next(ApiError.forbidden());
    next();
  };
}
