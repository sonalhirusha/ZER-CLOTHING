// ZERØ CLOTHING API — application bootstrap.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

import authRoutes from "./modules/auth/auth.routes.js";
import orderRoutes from "./modules/orders/orders.routes.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / curl (no origin) and any allow-listed frontend
      if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan(env.isProd() ? "combined" : "dev"));
app.use(generalLimiter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "zero-clothing-api", time: new Date().toISOString() });
});

// API v1
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", orderRoutes);

// 404 + error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Only listen when run directly (keeps the module importable for tests).
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  app.listen(env.port, () => {
    console.log(`ZERO CLOTHING API listening on http://localhost:${env.port}`);
  });
}

export default app;
