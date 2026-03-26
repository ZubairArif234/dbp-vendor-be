/**
 * ─── User Routes ─────────────────────────────────────────────────────────────
 *
 * Mounted at /api/users by the root router in routes/index.js
 */

import { Router } from "express";
import * as userCtrl from "../controllers/user.controller.js";
import { auth, authorize } from "../middleware/auth.js";

const router = Router();

// Public
router.post("/register", userCtrl.register);
router.post("/login", userCtrl.login);
router.post("/verify-email", userCtrl.verifyEmail);
router.post("/resend-otp", userCtrl.resendOtp);
router.post("/forgot-password", userCtrl.forgotPassword);
router.post("/reset-password", userCtrl.resetPassword);

// Protected
router.get("/me", auth, userCtrl.getProfile);

// Admin only
router.get("/", auth, authorize("admin"), userCtrl.listUsers);

export default router;
