import Airtable from "airtable";
import { v4 as uuidv4 } from "uuid";
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

const TABLE = "products";
const VARIANT_TABLE = "product_variant";
const USERS_TABLE = "users";
const VENDOR_TABLE = "vendor_profile";

// Helper to format Airtable record
const mapRecord = (rec) => ({
  ...rec.fields,
  id: rec.id,
});

const generateSKU = (name) => {
  return `${name.slice(0, 4).toUpperCase()}-${Date.now()}`;
};
// ─────────────────────────────────────────────
// CREATE PRODUCT + VARIANTS
// ─────────────────────────────────────────────
export async function createProduct(data, user_id) {
  const { variants = [], ...productData } = data;
  const id = uuidv4();
  // 1️⃣ Create Product
  const productRecord = await base(TABLE).create([
    {
      fields: {
        id,
        ...productData,
        user_id: [user_id],
        thumbnail: JSON.stringify(productData.thumbnail || []),
        min_amount: Number(productData.min_amount),
        low_avail_limit: Number(productData.low_avail_limit),
        sku: generateSKU(productData.product_name),
      },
    },
  ]);

  // ✅ Fix: reference user_id directly, not fields.user_id
  console.log("🚀 ~ createProduct ~ user_id:", user_id);

  const productId = productRecord[0].id;
  console.log("🚀 ~ createProduct ~ productId:", productId);

  // 2️⃣ Create Variants (if any)
  let createdVariants = [];
  if (variants.length > 0) {
    const variantPayload = variants.map((v) => ({
      fields: {
        name: v.name,
        price: Number(v.price),
        cost: Number(v.cost),
        avail_today: Number(v.avail_today),
        out_of_stock: v.out_of_stock || false,
        product_id: [productId],
      },
    }));
    const variantRecords = await base(VARIANT_TABLE).create(variantPayload);
    createdVariants = variantRecords.map(mapRecord);
  }

  return {
    product: mapRecord(productRecord[0]),
    variants: createdVariants,
  };
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateProduct(id, data, user) {
  const { variants = [], ...productData } = data;

  const allowedFields = [
    "product_name",
    "category",
    "discount_avail",
    "for_sale",
    "status",
    "long_summary",
    "nutritional_facts",
    "produce_item",
    "product_color",
    "recipes",
    "short_summary",
    "storage_temp",
    "storage_tips",
    "tax_farm_fee",
    "tax_sales",
    "warehouse",
    "supplier",
    "status",
    "min_amount",
    "low_avail_limit",
    "margin",
    "thumbnail",
  ];

  const cleanFields = Object.fromEntries(
    Object.entries(productData).filter(([key]) => allowedFields.includes(key)),
  );

  // 1️⃣ Determine if sensitive fields are being updated (anything except avail_today in variants)
  // 1️⃣ Determine if sensitive fields are being updated (anything except avail_today in variants)
  const productFields = Object.keys(productData).filter((k) => k !== "id");
  const hasProductUpdates = productFields.length > 0;

  // Check if any variant field other than 'id' or 'avail_today' is updated
  const hasOtherVariantUpdates = variants.some((v) =>
    Object.keys(v).some((k) => k !== "id" && k !== "avail_today"),
  );

  console.log(
    "🚀 ~ updateProduct ~ hasOtherVariantUpdates:",
    hasOtherVariantUpdates,
    variants,
  );

  // 2️⃣ Only set status to 'under review' if user is vendor AND
  // there are updates to product fields OR updates to variant fields other than avail_today
  if (
    user?.role === "vendor" &&
    (hasProductUpdates || hasOtherVariantUpdates)
  ) {
    productData.status = "under review";
  }

  // 3️⃣ Update Product
  const record = await base(TABLE).update([
    {
      id,
      fields: {
        ...cleanFields,
        ...(productData.thumbnail && {
          thumbnail: JSON.stringify(productData.thumbnail),
        }),
        status: cleanFields.status || "under review",
        min_amount: Number(productData.min_amount),
        low_avail_limit: Number(productData.low_avail_limit),
        margin: Number(productData.margin_override) || 40,
      },
    },
  ]);

  // 4️⃣ Update Variants (if any provided in the update payload)
  if (variants.length > 0) {
    const variantPayload = variants
      .map((v) => {
        const fields = {};
        if (v.name !== undefined) fields.name = v.name;
        if (v.price !== undefined) fields.price = Number(v.price);
        if (v.cost !== undefined) fields.cost = Number(v.cost);
        if (v.avail_today !== undefined)
          fields.avail_today = Number(v.avail_today);
        if (v.out_of_stock !== undefined) fields.out_of_stock = v.out_of_stock;

        if (!v._id || Object.keys(fields).length === 0) return null;
        return { id: v._id, fields };
      })
      .filter(Boolean);
    console.log("🚀 ~ updateProduct ~ variantPayload:", variantPayload);

    // ✅ Batch into chunks of 10 (Airtable hard limit)
    const chunks = [];
    for (let i = 0; i < variantPayload.length; i += 10) {
      chunks.push(variantPayload.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      await base(VARIANT_TABLE).update(chunk);
    }
  }

  return mapRecord(record[0]);
}

// ─────────────────────────────────────────────
// GET (WITH FILTERS)
// ─────────────────────────────────────────────
export async function getProducts({
  page = 1,
  limit = 10,
  search,
  status,
  category,
  supplier,
  out_of_stock,
}) {
  let filters = [];

  // 🔍 Search by product name
  if (search) {
    const s = search.trim().replace(/"/g, '\\"');
    filters.push(`FIND(LOWER("${s}"), LOWER({product_name}))`);
  }

  // ✅ Status filter — use TRUE()/FALSE() for Airtable checkbox fields
  if (status !== undefined) {
    filters.push(`{status} = "${status}"`);
  }

  // 📦 Category filter
  if (category) {
    filters.push(`{category} = "${category}"`);
  }

  // 🏪 Vendor filter — match against the lookup field pull from user_id
  if (supplier) {
    // supplier is the custom UUID. Matching against the lookup field {id (from user_id)}
    // is more reliable than matching against the linked record field itself.
    filters.push(`FIND("${supplier}", ARRAYJOIN({id (from user_id)}))`);
  }

  // 📉 Out of stock filter
  if (out_of_stock) {
    filters.push(`{lowAvailLimit} <= 0`);
  }

  const formula = filters.length
    ? filters.length === 1
      ? filters[0]
      : `AND(${filters.join(",")})`
    : "";
  // 1️⃣ Products
  const records = await base(TABLE).select({ filterByFormula: formula }).all();

  const total = records.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paginated = records.slice(start, start + limit);
  console.log("🚀 ~ getProducts ~ paginated:", paginated);

  const airtableProductIds = paginated.map((rec) => rec.id);

  // 2️⃣ USER IDs (from product)
  const userIds = [
    ...new Set(
      paginated.flatMap((rec) => rec.fields["id (from user_id)"] || []),
    ),
  ];
  console.log("🚀 ~ getProducts ~ userIds:", userIds);

  // 3️⃣ Fetch Vendor Profiles directly
  let vendorMapByUser = {};

  if (userIds.length) {
    const vendorRecords = await base(VENDOR_TABLE)
      .select({
        filterByFormula: `OR(${userIds
          .map((id) => `FIND("${id}", ARRAYJOIN({user_id}))`)
          .join(",")})`,
      })
      .all();

    vendorMapByUser = vendorRecords.reduce((acc, v) => {
      const linkedUsers = v.fields.user_id || [];

      for (const uid of linkedUsers) {
        acc[uid] = mapRecord(v);
      }

      return acc;
    }, {});
  }

  // 4️⃣ Variants
  const variantRecords = await base(VARIANT_TABLE).select().all();

  const variantsByProduct = {};

  for (const variant of variantRecords) {
    const linkedIds = variant.fields.product_id || [];

    for (const pid of linkedIds) {
      if (airtableProductIds.includes(pid)) {
        if (!variantsByProduct[pid]) {
          variantsByProduct[pid] = [];
        }
        variantsByProduct[pid].push(mapRecord(variant));
      }
    }
  }

  // 5️⃣ Merge
  const data = paginated.map((rawRecord) => {
    const product = mapRecord(rawRecord);
    console.log("🚀 ~ getProducts ~ product:", product);

    const userId = rawRecord.fields.user_id?.[0];
    const vendor = userId ? vendorMapByUser[userId] : null;

    return {
      ...product,
      vendorProfile: vendor || null, // ✅ directly attach
      variants: variantsByProduct[rawRecord.id] || [],
    };
  });

  return {
    data,
    total,
    page,
    totalPages,
  };
}

export async function getMineProducts({
  search,
  status,
  category,
  supplier,
  out_of_stock,
  user_id,
  page = 1,
  pageSize = 20,
}) {
  console.log("🚀 ~ getMineProducts ~ user_id:", user_id);

  // 1️⃣ Build filters (Airtable-side — excludes linked record user_id)
  let filters = [];

  if (search && search.trim()) {
    const s = search.trim().replace(/"/g, '\\"');
    filters.push(`FIND(LOWER("${s}"), LOWER({product_name}))`);
  }

  if (category && category.trim()) {
    filters.push(`{category} = "${category.trim()}"`);
  }

  if (supplier && supplier.trim()) {
    filters.push(`{supplier} = "${supplier.trim()}"`);
  }

  if (out_of_stock) {
    filters.push(`{low_avail_limit} <= 0`);
  }

  const filterFormula = filters.length > 0 ? `AND(${filters.join(",")})` : null;

  const query = {};
  if (filterFormula) query.filterByFormula = filterFormula;

  // 2️⃣ Fetch all matching records
  const allRecords = await base(TABLE).select(query).all();

  // 3️⃣ Filter by user_id in JS (linked record field — FIND() unreliable in formula)
  let filtered = allRecords.filter((record) => {
    const linkedUsers = record.fields.user_id || [];
    return linkedUsers.includes(user_id);
  });

  // 4️⃣ Filter by status in JS (same pattern as getVendors)
  if (status && status.trim()) {
    filtered = filtered.filter((r) => r.fields.status === status.trim());
  }

  // 5️⃣ Pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (Number(page) - 1) * Number(pageSize);
  const paginated = filtered.slice(start, start + Number(pageSize));
  const products = paginated.map(mapRecord);

  // 6️⃣ Early return
  if (products.length === 0) {
    return { data: [], total, page: Number(page), totalPages };
  }

  // 7️⃣ Fetch variants for this page's products only
  // 7️⃣ Fetch variants — match against Airtable record IDs (not mapped UUIDs)
  const airtableProductIds = paginated.map((r) => r.id); // ✅ raw rec... IDs

  const allVariantRecords = await base(VARIANT_TABLE).select().all();

  const matchedVariants = allVariantRecords.filter((v) => {
    const linkedProducts = v.fields.product_id || [];
    return linkedProducts.some((pid) => airtableProductIds.includes(pid));
  });

  const variants = matchedVariants.map(mapRecord);

  // 8️⃣ Group variants by Airtable product rec ID
  const variantsByProduct = {};
  for (const variant of matchedVariants) {
    const linkedIds = variant.fields.product_id || []; // ✅ raw fields, not mapped
    for (const pid of linkedIds) {
      if (!variantsByProduct[pid]) variantsByProduct[pid] = [];
      variantsByProduct[pid].push(mapRecord(variant));
    }
  }

  // 9️⃣ Merge — use Airtable rec ID to look up, but product.id is mapped UUID
  const data = paginated.map((rawRecord) => {
    const product = mapRecord(rawRecord);
    return {
      ...product,
      variants: variantsByProduct[rawRecord.id] || [], // ✅ rawRecord.id = rec...
    };
  });
  return {
    data,
    total,
    page: Number(page),
    totalPages,
  };
}

export async function updateProductStatus(id, status, notes = "") {
  console.log("🚀 ~ updateProductStatus ~ id:", id);
  if (!id) throw new Error("Product ID is required");

  const VALID_STATUSES = [
    "under review",
    "need fix",
    "approved",
    "exported",
    "confirmed",
    "archived",
  ];

  if (!VALID_STATUSES.includes(status.toLowerCase())) {
    throw new Error(
      `Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  console.log(
    "🚀 ~ updateProductStatus ~ id:",
    id,
    "status:",
    status,
    "notes:",
    notes,
  );

  const record = await base(TABLE).update([
    {
      id: id,
      fields: {
        status: status.toLowerCase(), // ✅ single select — pass string directly
        ...(notes && { notes }),
      },
    },
  ]);

  return mapRecord(record[0]);
}

export async function getProduct(id) {
  // 1️⃣ Fetch product
  const record = await base(TABLE).find(id);
  if (!record) throw new Error(`Product not found: ${id}`);

  // 2️⃣ Fetch all variants and filter by this product's rec ID
  const allVariantRecords = await base(VARIANT_TABLE).select().all();
  const matchedVariants = allVariantRecords.filter((v) => {
    const linkedProducts = v.fields.product_id || [];
    return linkedProducts.includes(record.id); // ✅ raw rec... ID
  });

  // 3️⃣ Merge
  const product = mapRecord(record);
  const variants = matchedVariants.map(mapRecord);

  return {
    ...product,
    variants,
  };
}

// ─────────────────────────────────────────────
// UPDATE STATUS
// ─────────────────────────────────────────────
export async function updateStatus(id, status) {
  const record = await base(TABLE).update([
    {
      id,
      fields: {
        forSale: status,
      },
    },
  ]);

  return mapRecord(record[0]);
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────
export async function deleteProduct(id) {
  await base(TABLE).destroy([id]);
  return { success: true };
}
