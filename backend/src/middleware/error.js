// Typed API error + central error handler. Never leaks internals to clients.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, "bad_request", msg, details); }
  static unauthorized(msg = "Authentication required") { return new ApiError(401, "unauthorized", msg); }
  static forbidden(msg = "Forbidden") { return new ApiError(403, "forbidden", msg); }
  static notFound(msg = "Not found") { return new ApiError(404, "not_found", msg); }
  static conflict(msg, details) { return new ApiError(409, "conflict", msg, details); }
  static unprocessable(msg, details) { return new ApiError(422, "unprocessable", msg, details); }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // Unknown error: log server-side, return generic message.
  console.error("[unhandled]", err);
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}
