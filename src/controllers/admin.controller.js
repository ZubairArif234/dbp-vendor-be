/**
 * ─── Admin Controller ─────────────────────────────────────────────────────────
 *
 * Handles admin-only vendor management actions.
 * All routes must be protected with auth + authorize("admin") middleware.
 */

import * as adminService from "../services/admin.service.js";
import * as productService from "../services/product.service.js";

/**
 * GET /api/admin/vendors
 * Query params: page, limit, search, status, region, is_banned
 */
export async function adminGetVendors(req, res) {
  try {
    const result = await adminService.getVendors(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/admin/vendors/:id/approval
 * Body: { approval: "approved" | "rejected" | "pending" }
 */
export async function updateVendorApproval(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await adminService.updateVendorApproval(
      id,
      status?.toLowerCase(),
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/admin/vendors/:id/ban
 * Body: { ban: true | false }
 */
export async function banUnbanVendor(req, res) {
  try {
    const { id } = req.params;
    const { is_banned } = req.body;

    const updated = await adminService.banUnbanVendor(id, is_banned);

    // Convert string to bool for messaging if needed, or just let service handle validation
    const isBanned = is_banned === "true" || is_banned === true;

    res.json({
      success: true,
      message: isBanned
        ? "Vendor banned successfully"
        : "Vendor unbanned successfully",
      data: updated,
    });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/admin/vendors/:id/details
 * Body: { margin?: number, note?: string }
 */
export async function updateVendorMarginAndNote(req, res) {
  try {
    const { id } = req.params;
    const { margin, note } = req.body;

    const updated = await adminService.updateVendorMarginAndNote(id, {
      margin,
      note,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * GET /api/admin/vendors/options
 */
export async function getApprovedVendorsOptions(req, res) {
  try {
    const result = await adminService.getApprovedVendorsOptions();
    res.json({ success: true, data: result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

// ─── Vendor Statuses ─────────────────────────────────────────────────────────

export async function getVendorStatuses(req, res) {
  try {
    const statuses = await adminService.getVendorStatuses();
    res.json({ success: true, data: statuses });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function createVendorStatus(req, res) {
  try {
    const { label, color } = req.body;
    if (!label) throw new Error("Label is required");
    const newStatus = await adminService.createVendorStatus({ label, color });
    res.status(201).json({ success: true, data: newStatus });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function updateVendorStatus(req, res) {
  try {
    const { id } = req.params;
    const { label, color, isArchived } = req.body;
    const updatedStatus = await adminService.updateVendorStatus(id, { label, color, isArchived });
    res.json({ success: true, data: updatedStatus });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const updated = await productService.updateProduct(id, req.body, req.user);
    res.json({ success: true, data: updated });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}
