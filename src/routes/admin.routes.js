/**
 * ─── Admin Routes ─────────────────────────────────────────────────────────────
 *
 * All routes require authentication + admin role.
 *
 * GET    /api/admin/vendors            — list with filters
 * PATCH  /api/admin/vendors/:id/approval — update status
 * PATCH  /api/admin/vendors/:id/ban     — ban / unban a vendor
 */

import express from "express";
import * as adminController from "../controllers/admin.controller.js";
import { auth, authorize } from "../middleware/auth.js";

const router = express.Router();

// Apply auth + admin role to all admin routes
router.use(auth, authorize("admin"));

// ─── Vendor Management ───────────────────────────────────────────────────────
router.get("/vendors", adminController.adminGetVendors);
router.get("/vendors/options", adminController.getApprovedVendorsOptions);
router.patch("/vendors/:id/approval", adminController.updateVendorApproval);
router.patch("/vendors/:id/ban", adminController.banUnbanVendor);
router.patch("/vendors/:id/details", adminController.updateVendorMarginAndNote);

// ─── Vendor Statuses ─────────────────────────────────────────────────────────
router.get("/vendor-statuses", adminController.getVendorStatuses);
router.post("/vendor-statuses", adminController.createVendorStatus);
router.patch("/vendor-statuses/:id", adminController.updateVendorStatus);
router.patch("/products/:id", adminController.updateProduct);
router.delete("/products/:id", adminController.deleteProduct);

export default router;
