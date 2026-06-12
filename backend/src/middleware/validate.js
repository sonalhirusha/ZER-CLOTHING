// Zod request validation. Usage: validate(schema) where schema validates req.body.
import { ApiError } from "./error.js";

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return next(ApiError.unprocessable("Validation failed", details));
    }
    req.body = result.data;
    next();
  };
}
