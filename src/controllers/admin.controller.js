/**
 * ─── Admin Controller ─────────────────────────────────────────────────────────
 *
 * Handles admin-only vendor management actions.
 * All routes must be protected with auth + authorize("admin") middleware.
 */

import * as adminService from "../services/admin.service.js";

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
