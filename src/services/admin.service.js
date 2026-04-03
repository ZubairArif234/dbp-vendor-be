import { base } from "../config/airtable.js";
import { v4 as uuidv4 } from "uuid";
import { dispatchNotification } from "./notification.service.js";

const VENDOR_TABLE_NAME = "vendor_profile";
const USER_TABLE_NAME = "users";
const VENDOR_STATUS_TABLE_NAME = "vendor_statuses";

/**
 * Admin Get Vendors
 * Supports: search (name/email), pagination, filter by status, approval, region, is_banned
 */
export async function getVendors({
  page = 1,
  limit = 10,
  search = "",
  status,
  region,
  // is_banned,
}) {
  console.log("🚀 ~ getVendors ~ status:", status);

  // ✅ 1. Build USER filters (status only — Airtable side)
  const userFilters = [];
  if (status) {
    userFilters.push(`LOWER({status}) = LOWER("${status}")`);
  }
  const userFilterFormula =
    userFilters.length > 0 ? `AND(${userFilters.join(",")})` : null;

  // ✅ 2. Fetch ALL users sorted by created_at DESC
  const userQuery = {
    fields: [
      "full_name",
      "email",
      "role",
      "status",
      "is_banned",
      "is_profile_completed",
      "is_email_verified",
      "created_at",
    ],
    sort: [{ field: "created_at", direction: "desc" }],
  };
  if (userFilterFormula) {
    userQuery.filterByFormula = userFilterFormula;
  }

  const allUserRecords = await base(USER_TABLE_NAME)
    .select(userQuery)
    .firstPage();

  if (allUserRecords.length === 0) {
    return { data: [], total: 0, page: Number(page), limit: Number(limit) };
  }

  // ✅ 3. Build VENDOR filters (search + region only — no user_id filter here)
  const vendorFilters = [];
  if (search && search.trim()) {
    const s = search.trim().replace(/"/g, '\\"');
    vendorFilters.push(
      `OR(
        FIND(LOWER("${s}"), LOWER({vendor_name})),
        FIND(LOWER("${s}"), LOWER({business_email}))
      )`,
    );
  }
  if (region && region.trim()) {
    const r = region.trim().replace(/"/g, '\\"');
    vendorFilters.push(`FIND(LOWER("${r}"), LOWER({office_address}))`);
  }

  const vendorFilterFormula =
    vendorFilters.length > 0 ? `AND(${vendorFilters.join(",")})` : null;

  // ✅ 4. Fetch ALL matching vendors (no user_id restriction — join in JS)
  const vendorQuery = {};
  if (vendorFilterFormula) {
    vendorQuery.filterByFormula = vendorFilterFormula;
  }

  const allVendorRecords = await base(VENDOR_TABLE_NAME)
    .select(vendorQuery)
    .firstPage();

  if (allVendorRecords.length === 0) {
    return { data: [], total: 0, page: Number(page), limit: Number(limit) };
  }

  // ✅ 5. Build vendor map keyed by user_id for fast lookup
  const vendorByUserId = {};
  allVendorRecords.forEach((vendor) => {
    const userId = vendor.fields.user_id?.[0];
    if (userId) {
      vendorByUserId[userId] = vendor;
    }
  });

  // ✅ 6. Merge users + vendors in user sorted order (created_at DESC)
  //        Only include users who have a matching vendor record
  const merged = [];
  for (const userRecord of allUserRecords) {
    const vendor = vendorByUserId[userRecord.id];
    if (!vendor) continue; // no vendor record for this user — skip

    const user = userRecord.fields;
    merged.push({
      id: userRecord.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      is_banned: user.is_banned ?? false,
      is_profile_completed: user.is_profile_completed ?? false,
      is_email_verified: user.is_email_verified ?? false,
      created_at: user.created_at,
      profile: {
        id: vendor.id,
        ...vendor.fields,
        notes: vendor.fields.notes || vendor.fields.additional_notes || "",
      },
    });
  }

  // ✅ 7. Paginate on the fully merged + sorted list
  const total = merged.length;
  const start = (Number(page) - 1) * Number(limit);
  const data = merged.slice(start, start + Number(limit));

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

/**
 * Update Vendor Approval Status
 * @param {string} id - Airtable record ID (Vendor Profile ID or User ID)
 * @param {"approved"|"rejected"|"pending"} approval - new approval status
 */
export async function updateVendorApproval(id, approval) {
  if (!approval) {
    const err = new Error("approval field is required");
    err.status = 400;
    throw err;
  }

  // Support dynamic statuses (no longer hardcoded to just 3)

  let targetUserId = id;
  try {
    const vendorRecord = await base(VENDOR_TABLE_NAME).find(id);
    if (vendorRecord && vendorRecord.fields.user_id?.[0]) {
      targetUserId = vendorRecord.fields.user_id[0];
    }
  } catch (err) {
    // If not found as Vendor, assume the id provided is already a User ID.
  }

  const records = await base(USER_TABLE_NAME).update([
    {
      id: targetUserId,
      fields: { status: approval },
    },
  ]);

  // 🔔 Notify Vendor
  await dispatchNotification(targetUserId, {
    type: "PROFILE_STATUS_UPDATED",
    title: "Profile Status Updated",
    message: `Your vendor profile status has been updated to '${approval}' by the admin.`,
    link: "/vendor/dashboard",
    emailData: { template: "vendor-notice" }, // email will fallback if email is not in data? Wait, dispatchNotification expects emailData.to? No, dispatchNotification fetches user? Ah wait.
  });

  return {
    id: records[0].id,
    ...records[0].fields,
  };
}

/**
 * Ban or Unban a Vendor
 * @param {string} id - Airtable record ID (Vendor Profile ID or User ID)
 * @param {boolean|string} ban - true to ban, false to unban
 */
export async function banUnbanVendor(id, ban) {
  let is_banned;
  if (ban === "true" || ban === true) is_banned = true;
  else if (ban === "false" || ban === false) is_banned = false;

  if (typeof is_banned !== "boolean") {
    const err = new Error(
      "ban field is required and must be a boolean (true | false)",
    );
    err.status = 400;
    throw err;
  }

  let targetUserId = id;
  try {
    const vendorRecord = await base(VENDOR_TABLE_NAME).find(id);
    if (vendorRecord && vendorRecord.fields.user_id?.[0]) {
      targetUserId = vendorRecord.fields.user_id[0];
    }
  } catch (err) {
    // If not found as Vendor, assume the id provided is already a User ID.
  }

  const records = await base(USER_TABLE_NAME).update([
    {
      id: targetUserId,
      fields: { is_banned: is_banned },
    },
  ]);

  return {
    id: records[0].id,
    ...records[0].fields,
  };
}

export async function updateVendorDetails(id, details) {
  if (!id) {
    const err = new Error("Vendor ID is required");
    err.status = 400;
    throw err;
  }

  const fieldsToUpdate = {};

  // Map frontend fields to Airtable fields
  if (details.name !== undefined) fieldsToUpdate.vendor_name = details.name;
  if (details.summary !== undefined) fieldsToUpdate.overview = details.summary;
  if (details.contact !== undefined)
    fieldsToUpdate.contact_name = details.contact;
  if (details.phone !== undefined)
    fieldsToUpdate.business_phone = details.phone;
  if (details.website !== undefined) fieldsToUpdate.website = details.website;
  if (details.office_address !== undefined) {
    fieldsToUpdate.office_address = details.office_address;
  } else if (details.address !== undefined) {
    fieldsToUpdate.office_address = details.address;
  }
  if (details.deliveryType !== undefined)
    fieldsToUpdate.delivery_type = details.deliveryType;
  if (details.logistics !== undefined)
    fieldsToUpdate.logistics_details = details.logistics;

  if (details.margin !== undefined) {
    const numMargin = Number(details.margin);
    if (!isNaN(numMargin) && numMargin >= 0 && numMargin <= 99) {
      fieldsToUpdate.margin = numMargin;
    }
  }

  if (details.note !== undefined) {
    fieldsToUpdate.notes = details.note.trim();
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    const err = new Error("No valid fields provided for update");
    err.status = 400;
    throw err;
  }

  // ✅ Find internal Airtable record ID using your custom UUID or Airtable Record ID
  let airtableRecordId = id;
  if (!id.startsWith("rec")) {
    const records = await base(VENDOR_TABLE_NAME)
      .select({
        filterByFormula: `{id} = "${id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      const err = new Error("Vendor profile not found");
      err.status = 404;
      throw err;
    }
    airtableRecordId = records[0].id;
  }

  // ✅ Update record
  const updatedRecords = await base(VENDOR_TABLE_NAME).update([
    { id: airtableRecordId, fields: fieldsToUpdate },
  ]);

  return {
    id: updatedRecords[0].fields.id || updatedRecords[0].id,
    ...updatedRecords[0].fields,
  };
}

/**
 * Get all approved vendors as options for select
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getApprovedVendorsOptions() {
  const userRecords = await base(USER_TABLE_NAME)
    .select({
      filterByFormula: `AND({role} = "vendor", {status} = "approved")`,
      fields: ["full_name", "id"],
    })
    .all();

  if (userRecords.length === 0) return [];

  const vendorProfiles = await base(VENDOR_TABLE_NAME)
    .select({
      fields: ["vendor_name", "user_id"],
    })
    .all();

  return userRecords.map((r) => {
    // Link using the internal Airtable record ID
    const profile = vendorProfiles.find(
      (v) => v.fields.user_id && v.fields.user_id.includes(r.id),
    );

    return {
      id: r.fields.id, // Return custom UUID for frontend filtering
      name: profile?.fields?.vendor_name || r.fields.full_name,
    };
  });
}

// ─── Vendor Statuses Management ──────────────────────────────────────────────

/**
 * Get all vendor statuses
 * @returns {Promise<Array<{id: string, label: string, color: string, isArchived: boolean}>>}
 */
export async function getVendorStatuses() {
  const records = await base(VENDOR_STATUS_TABLE_NAME).select().all();
  return records.map((r) => ({
    id: r.fields.id || r.id,
    label: r.fields.label || "",
    color: r.fields.color || "gray",
    isArchived: r.fields.is_archived || false,
    _airtableId: r.id, // Keep raw Airtable ID for updates
  }));
}

/**
 * Create a new vendor status
 * @param {{label: string, color: string}} data
 */
export async function createVendorStatus(data) {
  const newId = uuidv4();
  const record = await base(VENDOR_STATUS_TABLE_NAME).create([
    {
      fields: {
        id: newId,
        label: data.label,
        color: data.color,
        is_archived: false,
      },
    },
  ]);

  return {
    id: record[0].fields.id || record[0].id,
    label: record[0].fields.label,
    color: record[0].fields.color,
    isArchived: record[0].fields.is_archived || false,
    _airtableId: record[0].id,
  };
}

/**
 * Update an existing vendor status
 * @param {string} id - The _airtableId or custom uuid of the status
 * @param {{label?: string, color?: string, isArchived?: boolean}} data
 */
export async function updateVendorStatus(id, data) {
  // First find the raw Airtable record ID
  const records = await base(VENDOR_STATUS_TABLE_NAME)
    .select({
      filterByFormula: `OR(RECORD_ID() = '${id}', {id} = '${id}')`,
    })
    .firstPage();

  if (records.length === 0) {
    throw new Error(`Status not found: ${id}`);
  }

  const airtableRecordId = records[0].id;

  const fields = {};
  if (data.label !== undefined) fields.label = data.label;
  if (data.color !== undefined) fields.color = data.color;
  if (data.isArchived !== undefined) fields.is_archived = data.isArchived;

  const updatedRecord = await base(VENDOR_STATUS_TABLE_NAME).update([
    {
      id: airtableRecordId,
      fields,
    },
  ]);

  return {
    id: updatedRecord[0].fields.id || updatedRecord[0].id,
    label: updatedRecord[0].fields.label,
    color: updatedRecord[0].fields.color,
    isArchived: updatedRecord[0].fields.is_archived || false,
    _airtableId: updatedRecord[0].id,
  };
}

export async function getAdminStats() {
  // 1. Total Vendors
  const vendorRecords = await base(VENDOR_TABLE_NAME)
    .select({ fields: [] })
    .all();
  const totalVendors = vendorRecords.length;

  // 2. Total Products
  const productRecords = await base("products")
    .select({ fields: ["status"], filterByFormula: "NOT({status} = 'draft')" })
    .all();
  const totalProducts = productRecords.length;

  const stats = {
    totalVendors,
    totalProducts,
    pendingApprovals: 0,
    activeProducts: 0,
  };

  productRecords.forEach((r) => {
    const status = (r.fields.status || "").toLowerCase();
    if (status === "submitted" || status === "under review")
      stats.pendingApprovals++;
    else if (
      status === "approved" ||
      status === "exported" ||
      status === "confirmed"
    )
      stats.activeProducts++;
  });

  return stats;
}
