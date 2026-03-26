/**
 * ─── Vendor Profile Controller ───────────────────────────────────────────────
 *
 * Thin request handlers – parse input, call service, return JSON response.
 * Business logic should remain in the service layer.
 */

import * as vendorService from "../services/vendor.service.js";

/**
 * Create a new vendor profile
 */
export async function createVendorProfile(req, res) {
  try {
    const user_id = req.user.id; // from auth middleware
    const profileData = { ...req.body, user_id };

    const profile = await vendorService.createVendorProfile(profileData);
    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * Get a vendor profile by ID
 */
export async function getVendorProfile(req, res) {
  try {
    const { id } = req.params;
    const profile = await vendorService.getVendorProfileById(id);
    res.json({ success: true, data: profile });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * List all vendor profiles (optionally filter by logged-in user)
 */
export async function listVendorProfiles(req, res) {
  try {
    const user_id = req.query.user_id || req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const result = await vendorService.listVendorProfiles({
      user_id,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * Update a vendor profile
 */
export async function updateVendorProfile(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedProfile = await vendorService.updateVendorProfile(id, updates);
    res.json({ success: true, data: updatedProfile });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

/**
 * Delete a vendor profile
 */
export async function deleteVendorProfile(req, res) {
  try {
    const { id } = req.params;
    const deleted = await vendorService.deleteVendorProfile(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor profile not found" });
    }

    res.json({ success: true, message: "Vendor profile deleted successfully" });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}