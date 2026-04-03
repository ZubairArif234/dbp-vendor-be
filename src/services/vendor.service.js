import { v4 as uuidv4 } from "uuid";
import { base } from "../config/airtable.js";
import { notifyAdmins } from "./notification.service.js";

const TABLE_NAME = "vendor_profile";
const USER_TABLE_NAME = "users";

/**
 * Create a new vendor profile and mark user's profile as completed
 */
export async function createVendorProfile({
  user_id,
  vendor_name,
  contact_name,
  business_phone,
  business_email,
  website,
  vendor_overview,
  delivery_type,
  logistics_details,
  vendor_logo,
  office_address,
  additional_notes,
}) {
  // 1. Generate unique ID for the vendor profile
  const id = uuidv4();

  // 2. Create the vendor profile in Airtable
  const records = await base(TABLE_NAME).create([
    {
      fields: {
        id,
        user_id: [user_id],
        vendor_name,
        contact_name,
        business_phone,
        business_email,
        website,
        overview:vendor_overview,
        delivery_type,
        logistics_details,
        vendor_logo,
        office_address,
        additional_notes,
      },
    },
  ]);

  const newProfile = records[0];

  // 3. Update the user to mark profile as completed
  if (user_id) {
    await base(USER_TABLE_NAME).update([
      {
        id: user_id,
        fields: { is_profile_completed: true },
      },
    ]);

    // 🔔 Notify Admins
    await notifyAdmins({
      type: "PROFILE_COMPLETED",
      title: "Vendor Profile Completed",
      message: `The vendor '${vendor_name}' has completed their profile setup.`,
      link: "/admin/vendors",
      emailData: { template: "admin-notice" },
    });
  }

  // 4. Return the new vendor profile
  return {
    ...newProfile.fields,
    id: newProfile.id,
  };
}

/**
 * Get a vendor profile by ID
 */
export async function getVendorProfileById(id) {
  try {
    const record = await base(TABLE_NAME).find(id);
    return {
      ...record.fields,
      id: record.id,
    };
  } catch (err) {
    if (err.statusCode === 404) {
      const error = new Error("Vendor profile not found");
      error.status = 404;
      throw error;
    }
    throw err;
  }
}

/**
 * Get a vendor profile by User ID
 */
export async function getVendorProfileByUserId(userId) {
  let userUUID = userId;
  try {
    // If userId is the Airtable Record ID (starts with rec), get the UUID
    if (userId.startsWith('rec')) {
      const userRecord = await base(USER_TABLE_NAME).find(userId);
      if (userRecord && userRecord.fields.id) {
        userUUID = userRecord.fields.id;
      }
    }
  } catch (err) {
    // Ignore and fallback to trying userId directly
  }

  const filterFormula = `SEARCH('${userUUID}', {user_id})`;
  const records = await base(TABLE_NAME)
    .select({ filterByFormula: filterFormula, maxRecords: 1 })
    .firstPage();

  if (records.length === 0) {
    return null; /* No profile found */
  }

  const record = records[0];
  return {
    ...record.fields,
    id: record.id,
  };
}

/**
 * List all vendor profiles (with optional filter by user_id)
 */
export async function listVendorProfiles({ user_id, page = 1, limit = 20 }) {
  const filterFormula = user_id ? `{user_id} = '${user_id}'` : undefined;

  const records = await base(TABLE_NAME)
    .select({
      filterByFormula: filterFormula,
      maxRecords: Number(limit),
    })
    .firstPage();

  const data = records.map((r) => ({
    ...r.fields,
    id: r.id,
  }));

  return {
    data,
    total: data.length,
    page: 1,
    limit: Number(limit),
  };
}

/**
 * Update a vendor profile by ID
 */
export async function updateVendorProfile(id, updates) {
  const records = await base(TABLE_NAME).update([
    {
      id,
      fields: updates,
    },
  ]);

  const updatedProfile = records[0];
  return {
    ...updatedProfile.fields,
    id: updatedProfile.id,
  };
}

/**
 * Delete a vendor profile by ID
 */
export async function deleteVendorProfile(id) {
  const deletedRecords = await base(TABLE_NAME).destroy([id]);
  return deletedRecords[0].id === id;
}
