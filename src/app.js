/**
 * ─── Application Entry Point ─────────────────────────────────────────────────
 *
 * Bootstraps Express, connects to MongoDB, mounts middleware & routes,
 * initialises Socket.IO, and starts the HTTP server.
 *
 * All feature routes live in  src/routes/
 * All socket handlers live in src/sockets/
 */

import { createServer } from "http";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";

import { PORT, CORS_ORIGINS, NODE_ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./config/socket.js";
import routes from "./routes/index.js";

// ─── Initialise Express ──────────────────────────────────────────────────────
const app = express();
const server = createServer(app);

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGINS || "*", credentials: true }));
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ────────────────────────────────────────────────────────────
// Serve a frontend build (or landing page) from public/
app.use(express.static(path.join(process.cwd(), "public")));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() }),
);

// ─── SPA Fallback (optional) ─────────────────────────────────────────────────
// Uncomment if you serve a single-page app from public/
// app.get("*", (_req, res) =>
//   res.sendFile(path.join(process.cwd(), "public", "index.html"))
// );

// ─── Socket.IO ───────────────────────────────────────────────────────────────
initSocket(server);

// ─── Start Server ────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${NODE_ENV}]`);
  });
}

start();

export default app; // exported for testing
