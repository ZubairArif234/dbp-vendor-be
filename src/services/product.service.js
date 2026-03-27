import Airtable from "airtable";
import { v4 as uuidv4 } from "uuid";
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

const TABLE = "products";
const VARIANT_TABLE = "product_variant";

// Helper to format Airtable record
const mapRecord = (rec) => ({
  id: rec.id,
  ...rec.fields,
});

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
export async function updateProduct(id, data) {
  const record = await base(TABLE).update([
    {
      id,
      fields: {
        ...data,
        ...(data.thumbnail && {
          thumbnail: JSON.stringify(data.thumbnail),
        }),
      },
    },
  ]);

  return mapRecord(record[0]);
}

// ─────────────────────────────────────────────
// GET (WITH FILTERS)
// ─────────────────────────────────────────────
export async function getProducts({
  search,
  status,
  category,
  supplier,
  out_of_stock,
}) {
  let filters = [];

  // 🔍 Search by productName
  if (search) {
    filters.push(`FIND(LOWER("${search}"), LOWER({productName}))`);
  }

  // Status (forSale)
  if (status !== undefined) {
    filters.push(`{forSale} = ${status ? 1 : 0}`);
  }

  // Category
  if (category) {
    filters.push(`{category} = "${category}"`);
  }

  // Supplier
  if (supplier) {
    filters.push(`{supplier} = "${supplier}"`);
  }

  // Out of stock (based on lowAvailLimit or custom logic)
  if (out_of_stock) {
    filters.push(`{lowAvailLimit} <= 0`);
  }

  const formula = filters.length > 0 ? `AND(${filters.join(",")})` : "";

  const records = await base(TABLE)
    .select({
      filterByFormula: formula,
    })
    .all();

  return records.map(mapRecord);
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
  console.log("🚀 ~ total records fetched:", allRecords.length);

  // 3️⃣ Filter by user_id in JS (linked record field — FIND() unreliable in formula)
  let filtered = allRecords.filter((record) => {
    const linkedUsers = record.fields.user_id || [];
    return linkedUsers.includes(user_id);
  });

  // 4️⃣ Filter by status in JS (same pattern as getVendors)
  if (status && status.trim()) {
    filtered = filtered.filter((r) => r.fields.status === status.trim());
  }

  console.log("🚀 ~ after JS filters:", filtered.length);

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
  console.log("🚀 ~ airtableProductIds:", airtableProductIds);

  const allVariantRecords = await base(VARIANT_TABLE).select().all();
  console.log("🚀 ~ total variants in table:", allVariantRecords.length);

  const matchedVariants = allVariantRecords.filter((v) => {
    const linkedProducts = v.fields.product_id || [];
    console.log("🚀 ~ variant linked product_id:", linkedProducts);
    return linkedProducts.some((pid) => airtableProductIds.includes(pid));
  });

  console.log("🚀 ~ matched variants:", matchedVariants.length);

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

// ─────────────────────────────────────────────
// ADD NOTES
// ─────────────────────────────────────────────
export async function addNotes(id, note) {
  const record = await base(TABLE).find(id);

  const existingNotes = record.fields.additional_notes || "";

  const updated = await base(TABLE).update([
    {
      id,
      fields: {
        additional_notes: existingNotes ? `${existingNotes}\n\n${note}` : note,
      },
    },
  ]);

  return mapRecord(updated[0]);
}
