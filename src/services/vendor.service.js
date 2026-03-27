import { v4 as uuidv4 } from "uuid";
import { base } from "../config/airtable.js";

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
  }

  // 4. Return the new vendor profile
  return {
    id: newProfile.fields.id || newProfile.id,
    ...newProfile.fields,
  };
}

/**
 * Get a vendor profile by ID
 */
export async function getVendorProfileById(id) {
  try {
    const record = await base(TABLE_NAME).find(id);
    return {
      id: record.id,
      ...record.fields,
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
    id: r.id,
    ...r.fields,
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
    id: updatedProfile.id,
    ...updatedProfile.fields,
  };
}

/**
 * Delete a vendor profile by ID
 */
export async function deleteVendorProfile(id) {
  const deletedRecords = await base(TABLE_NAME).destroy([id]);
  return deletedRecords[0].id === id;
}
