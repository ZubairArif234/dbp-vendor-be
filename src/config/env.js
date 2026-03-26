/**
 * ─── Environment Configuration ───────────────────────────────────────────────
 *
 * Reads from process.env (loaded by dotenv) and exports individual constants.
 * Add all new env vars here so the rest of the app never touches process.env.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config();

// ─── Server ──────────────────────────────────────────────────────────────────
export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || "development";

// ─── Database ────────────────────────────────────────────────────────────────
export const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
export const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "express_boilerplate";

// ─── Auth / JWT ──────────────────────────────────────────────────────────────
export const JWT_SECRET = process.env.JWT_SECRET || "super-secret-change-me";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "14d";

// ─── CORS ────────────────────────────────────────────────────────────────────
// Comma-separated origins or leave blank for wildcard in dev
export const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : "*";

// ─── Paths ───────────────────────────────────────────────────────────────────
export const PROJECT_ROOT = process.cwd();
export const UPLOAD_DIR = path.join(PROJECT_ROOT, "uploads");

// ─── External API Keys (add your own) ────────────────────────────────────────
// export const OPENAI_API_KEY   = process.env.OPENAI_API_KEY   || "";
// export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
// export const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN   || "";
