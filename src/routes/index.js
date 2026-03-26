/**
 * ─── Root Router ─────────────────────────────────────────────────────────────
 *
 * Composes all feature routers and mounts them under /api.
 *
 * To add a new feature:
 *   1. Create  src/routes/feature.routes.js
 *   2. Import and mount it below.
 */

import { Router } from "express";
import userRoutes from "./user.routes.js";

const router = Router();

// ─── Mount feature routers ──────────────────────────────────────────────────
router.use("/users", userRoutes);
// router.use("/posts",  postRoutes);   // ← add more here
// router.use("/orders", orderRoutes);

export default router;
