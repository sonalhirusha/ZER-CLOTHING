// File upload handling (receipts + artwork) using multer disk storage with
// strict validation. Files are written under env.uploads.dir and served back
// via the /uploads static route. Swap diskStorage for S3 in production.
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../middleware/error.js";

fs.mkdirSync(env.uploads.dir, { recursive: true });

const ALLOWED = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const sub = req.uploadSubdir || "misc";
    const dir = path.join(env.uploads.dir, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = ALLOWED[file.mimetype] || path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED[file.mimetype]) {
    return cb(new ApiError(415, "unsupported_media", `Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
}

export function uploadInto(subdir, field = "file") {
  return [
    (req, _res, next) => {
      req.uploadSubdir = subdir;
      next();
    },
    multer({ storage, fileFilter, limits: { fileSize: env.uploads.maxBytes, files: 1 } }).single(field),
  ];
}

// Build the public URL + storage key for a stored file.
export function publicFile(req, file) {
  const sub = req.uploadSubdir || "misc";
  const key = `${sub}/${file.filename}`;
  return { key, url: `/uploads/${key}`, mime: file.mimetype, size: file.size };
}
