// ZERØ CLOTHING API — application bootstrap.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import fs from "node:fs";

import { env } from "./config/env.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { startEmailWorker } from "./jobs/emailWorker.js";
import { emailMode } from "./services/mailer.js";

import authRoutes from "./modules/auth/auth.routes.js";
import catalogRoutes from "./modules/catalog/catalog.routes.js";
import orderRoutes from "./modules/orders/orders.routes.js";
import paymentRoutes from "./modules/payments/payments.routes.js";
import designRoutes from "./modules/designs/designs.routes.js";
import accountRoutes from "./modules/account/account.routes.js";
import supportRoutes from "./modules/support/support.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";

const app = express();

app.set("trust proxy", 1);

// Security headers. crossOriginResourcePolicy relaxed so uploaded images load
// from the separate storefront origin.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.use(morgan(env.isProd() ? "combined" : "dev"));
app.use(generalLimiter);

// Serve uploaded files (receipts, artwork).
fs.mkdirSync(env.uploads.dir, { recursive: true });
app.use("/uploads", express.static(env.uploads.dir, { maxAge: "1h" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "zero-clothing-api", emailMode: emailMode(), time: new Date().toISOString() });
});

// API v1
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1", catalogRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", designRoutes);
app.use("/api/v1", supportRoutes);
app.use("/api/v1", analyticsRoutes);

// 404 + error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Only listen when run directly (keeps the module importable for tests).
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  app.listen(env.port, () => {
    console.log(`ZERO CLOTHING API listening on http://localhost:${env.port}  (email: ${emailMode()})`);
    startEmailWorker();
  });
}

export default app;
