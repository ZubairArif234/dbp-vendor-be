import Airtable from "airtable";
import { v4 as uuidv4 } from "uuid";
import { dispatchNotification, notifyAdmins } from "./notification.service.js";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

const TABLE = "products";
const VARIANT_TABLE = "product_variant";
const USERS_TABLE = "users";
const VENDOR_TABLE = "vendor_profile";

// Helper to format Airtable record
const mapRecord = (rec) => {
  const fields = { ...rec.fields };
  if (typeof fields.thumbnail === "string") {
    try {
      fields.thumbnail = JSON.parse(fields.thumbnail);
    } catch (e) {
      fields.thumbnail = [];
    }
  }
  return {
    ...fields,
    id: rec.id,
  };
};

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
        margin: Number(productData.margin),
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

  if (productData?.status != "draft") {
    // 🔔 Notify Admins
    await notifyAdmins({
      type: "PRODUCT_UNDER_REVIEW",
      title: "New Product Uploaded",
      message: `A new product '${productData.product_name}' was uploaded and needs review.`,
      link: "/admin/products",
      emailData: { template: "admin-notice" },
    });
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

  // 1️⃣ Fetch current state for comparison
  const productRecord = await base(TABLE).find(id);
  if (!productRecord) throw new Error("Product not found");

  const allVariantRecords = await base(VARIANT_TABLE).select().all();
  const existingVariantRecords = allVariantRecords.filter((v) => {
    const linkedIds = v.fields.product_id || [];
    return linkedIds.includes(id);
  });
  const existingIds = existingVariantRecords.map((r) => r.id);
  const incomingIds = variants.filter((v) => v._id).map((v) => v._id);

  // 2️⃣ Detection Logic
  let hasSensitiveChanges = false;

  const allowedFields = [
    "product_name",
    "category",
    "discount_avail",
    "for_sale",
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
    "min_amount",
    "low_avail_limit",
    "margin",
    "thumbnail",
  ];

  const cleanFields = Object.fromEntries(
    Object.entries(productData).filter(([key]) => allowedFields.includes(key)),
  );

  // A. Detect Product-level changes
  for (const key of allowedFields) {
    if (productData[key] !== undefined) {
      let newVal = productData[key];
      let oldVal = productRecord.fields[key];

      let changed = false;
      if (key === "thumbnail") {
        const newThumb = JSON.stringify(newVal || []);
        const oldThumb = oldVal || "[]";
        if (newThumb !== oldThumb) changed = true;
      } else if (["min_amount", "low_avail_limit", "margin"].includes(key)) {
        if (Number(newVal) !== Number(oldVal)) changed = true;
      } else {
        // String or boolean comparison
        const v1 =
          newVal === null || newVal === undefined ? "" : String(newVal).trim();
        const v2 =
          oldVal === null || oldVal === undefined ? "" : String(oldVal).trim();
        if (v1 !== v2) changed = true;
      }

      if (changed) {
        console.log(`🔍 ~ Sensitive change in product field [${key}]:`, {
          old: productRecord.fields[key],
          new: productData[key],
        });
        hasSensitiveChanges = true;
      }
    }
  }

  // B. Detect Variant Additions or Removals
  const hasAdded = variants.some((v) => !v._id);
  const hasRemoved = existingIds.some((eid) => !incomingIds.includes(eid));

  if (hasAdded || hasRemoved) {
    console.log("🔄 ~ Variant structure change detected:", {
      hasAdded,
      hasRemoved,
    });
    hasSensitiveChanges = true;
  }

  // C. Detect Sensitive Variant Edits (anything except avail_today and out_of_stock)
  if (!hasSensitiveChanges) {
    for (const v of variants) {
      if (v._id) {
        const existing = existingVariantRecords.find((r) => r.id === v._id);
        if (existing) {
          const sensitiveFields = ["name", "price", "cost", "pos"];
          for (const f of sensitiveFields) {
            if (v[f] !== undefined) {
              let newVal = v[f];
              let oldVal = existing.fields[f];
              let changed = false;

              if (["price", "cost", "pos"].includes(f)) {
                if (Number(newVal) !== Number(oldVal)) changed = true;
              } else {
                const v1 =
                  newVal === null || newVal === undefined
                    ? ""
                    : String(newVal).trim();
                const v2 =
                  oldVal === null || oldVal === undefined
                    ? ""
                    : String(oldVal).trim();
                if (v1 !== v2) changed = true;
              }

              if (changed) {
                console.log(
                  `🔍 ~ Sensitive change in variant [${v._id}] field [${f}]:`,
                  { old: oldVal, new: newVal },
                );
                hasSensitiveChanges = true;
              }
            }
            if (hasSensitiveChanges) break;
          }
        }
      }
      if (hasSensitiveChanges) break;
    }
  }

  // 3️⃣ Only set status to 'under review' if user is vendor and sensitive changes occurred
  if (user?.role === "vendor" && hasSensitiveChanges) {
    productData.status = "under review";

    // 🔔 Notify Admins if not already under review
    if (productRecord.fields.status !== "under review") {
      await notifyAdmins({
        type: "PRODUCT_UNDER_REVIEW",
        title: "Product Edited",
        message: `The product '${productData.product_name || productRecord.fields.product_name || "A product"}' was edited and needs review.`,
        link: "/admin/products",
        emailData: { template: "admin-notice" },
      });
    }
  }

  // 5️⃣ Update Product
  const record = await base(TABLE).update([
    {
      id,
      fields: {
        ...cleanFields,
        ...(productData.thumbnail && {
          thumbnail: JSON.stringify(productData.thumbnail),
        }),
        status: (() => {
          const s = (
            productData.status ||
            productRecord.fields.status ||
            "under review"
          ).toLowerCase();
          const STATUS_MAP = {
            draft: "draft",
            submitted: "submitted",
            "under review": "under review",
            "needs fix": "need fix",
            "need fix": "need fix",
            approved: "approved",
            exported: "exported",
            confirmed: "confirmed",
            archived: "archived",
            "request delete": "request delete",
          };
          return STATUS_MAP[s] || "under review";
        })(),
        min_amount: Number(
          productData.min_amount || productRecord.fields.min_amount,
        ),
        low_avail_limit: Number(
          productData.low_avail_limit || productRecord.fields.low_avail_limit,
        ),
        margin: Number(productData.margin || productRecord.fields.margin) || 40,
      },
    },
  ]);

  // 6️⃣ Handle Variants: Create new, update existing, delete removed
  if (variants !== undefined) {
    // ── existingVariantRecords is already fetched above
    // const existingIds = existingVariantRecords.map((r) => r.id);
    // const incomingIds = variants.filter((v) => v._id).map((v) => v._id);

    console.log("🔍 ~ updateProduct ~ existingIds:", existingIds);
    console.log("🔍 ~ updateProduct ~ incomingIds:", incomingIds);

    // ── 4a. DELETE variants that are no longer in the payload
    const toDelete = existingIds.filter((eid) => !incomingIds.includes(eid));
    if (toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += 10) {
        await base(VARIANT_TABLE).destroy(toDelete.slice(i, i + 10));
      }
      console.log("🗑️ ~ updateProduct ~ deleted variants:", toDelete);
    }

    // ── 4b. UPDATE existing variants
    const toUpdate = variants
      .filter((v) => v._id)
      .map((v) => {
        const fields = {};
        if (v.name !== undefined) fields.name = v.name;
        if (v.price !== undefined) fields.price = Number(v.price);
        if (v.cost !== undefined) fields.cost = Number(v.cost);
        if (v.avail_today !== undefined)
          fields.avail_today = Number(v.avail_today);
        if (v.out_of_stock !== undefined) fields.out_of_stock = v.out_of_stock;
        if (v.pos !== undefined) fields.pos = Number(v.pos); // ✅ persist drag order
        return { id: v._id, fields };
      })
      .filter((v) => Object.keys(v.fields).length > 0);

    if (toUpdate.length > 0) {
      for (let i = 0; i < toUpdate.length; i += 10) {
        await base(VARIANT_TABLE).update(toUpdate.slice(i, i + 10));
      }
      console.log("✏️ ~ updateProduct ~ updated variants:", toUpdate.length);
    }

    // ── 4c. CREATE new variants (those without an _id)
    const toCreate = variants.filter((v) => !v._id);
    if (toCreate.length > 0) {
      const createPayload = toCreate.map((v, i) => ({
        fields: {
          name: v.name,
          price: Number(v.price),
          cost: Number(v.cost),
          avail_today: Number(v.avail_today || 0),
          out_of_stock: v.out_of_stock || false,
          product_id: [id], // link to the product using its Airtable record ID
          pos: incomingIds.length + i + 1,
        },
      }));

      for (let i = 0; i < createPayload.length; i += 10) {
        await base(VARIANT_TABLE).create(createPayload.slice(i, i + 10));
      }
      console.log("➕ ~ updateProduct ~ created variants:", toCreate.length);
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
    console.log("🚀 ~ getProducts ~ status:", status);
  } else {
    // 🛡️ SECURITY: By default, never show 'draft' products to admins in the general list.
    filters.push(`NOT({status} = "draft")`);
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
  const records = await base(TABLE)
    .select({
      filterByFormula: formula,
      sort: [
        {
          field: "created_at", // or your actual date field
          direction: "desc", // newest first
        },
      ],
    })
    .all();

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
      vendorProfile: vendor || null,
      variants: (variantsByProduct[rawRecord.id] || []).sort(
        (a, b) => (a.pos || 0) - (b.pos || 0),
      ),
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
  stock,
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

  // 4️⃣ Filter by status in JS
  if (status && status.trim() && status !== "all") {
    filtered = filtered.filter((r) => r.fields.status === status.trim());
  }

  // 5️⃣ Fetch variants for ALL filtered products to calculate total stock
  const airtableProductIds = filtered.map((r) => r.id);
  if (airtableProductIds.length === 0) {
    return { data: [], total: 0, page: Number(page), totalPages: 0 };
  }

  const allVariantRecords = await base(VARIANT_TABLE).select().all();
  const variantsByProduct = {};
  for (const variant of allVariantRecords) {
    const linkedIds = variant.fields.product_id || [];
    for (const pid of linkedIds) {
      if (airtableProductIds.includes(pid)) {
        if (!variantsByProduct[pid]) variantsByProduct[pid] = [];
        variantsByProduct[pid].push(mapRecord(variant));
      }
    }
  }

  // 6️⃣ Filter by stock in JS
  if (stock && stock !== "all") {
    filtered = filtered.filter((r) => {
      const variants = variantsByProduct[r.id] || [];
      const totalStock = variants.reduce(
        (sum, v) => sum + (Number(v.avail_today) || 0),
        0,
      );

      if (stock === "out_of_stock") return totalStock === 0;
      if (stock === "in_stock") return totalStock > 0;
      return true;
    });
  }

  // 7️⃣ Pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / Number(pageSize));
  const start = (Number(page) - 1) * Number(pageSize);
  const paginated = filtered.slice(start, start + Number(pageSize));

  // 8️⃣ Merge
  const vendorRecords = await base(VENDOR_TABLE)
    .select({
      filterByFormula: `FIND("${user_id}", ARRAYJOIN({user_id}))`,
      maxRecords: 1,
    })
    .firstPage();
  const vendorProfile = vendorRecords.length
    ? mapRecord(vendorRecords[0])
    : null;

  const data = paginated.map((rawRecord) => {
    const product = mapRecord(rawRecord);
    return {
      ...product,
      vendorProfile,
      variants: (variantsByProduct[rawRecord.id] || []).sort(
        (a, b) => (a.pos || 0) - (b.pos || 0),
      ),
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
    "draft",
    "submitted",
    "under review",
    "needs fix",
    "need fix",
    "approved",
    "exported",
    "confirmed",
    "archived",
    "request delete",
  ];

  if (!VALID_STATUSES.includes(status.toLowerCase())) {
    throw new Error(
      `Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const STATUS_MAP = {
    draft: "draft",
    submitted: "submitted",
    "under review": "under review",
    "needs fix": "need fix",
    "need fix": "need fix",
    approved: "approved",
    exported: "exported",
    confirmed: "confirmed",
    archived: "archived",
    "request delete": "request delete",
  };

  const exactStatus = STATUS_MAP[status.toLowerCase()];

  console.log(
    "🚀 ~ updateProductStatus ~ id:",
    id,
    "status:",
    status,
    "notes:",
    notes,
  );

  const productRecord = await base(TABLE).find(id);
  if (!productRecord) throw new Error("Product not found");

  const currentStatus = (productRecord.fields.status || "").toLowerCase();
  if (currentStatus === exactStatus.toLowerCase()) {
    const error = new Error(`Product is already of status: ${exactStatus}`);
    error.status = 400;
    throw error;
  }

  const vendorUserId = productRecord.fields.user_id?.[0];

  const record = await base(TABLE).update([
    {
      id: id,
      fields: {
        status: exactStatus, // ✅ single select — mapped to exact casing

        ...(notes && { notes }),
      },
    },
  ]);

  const updatedProduct = mapRecord(record[0]);
  const productName = updatedProduct.product_name || "A product";

  // 🔔 Notifications
  if (status.toLowerCase() === "request delete") {
    // Notify Admins
    await notifyAdmins({
      type: "PRODUCT_DELETION_REQUEST",
      title: "Product Deletion Requested",
      message: `A vendor has requested to delete '${productName}'.`,
      link: "/admin/products",
      emailData: { template: "admin-notice" },
    });
  } else if (vendorUserId) {
    // Notify Vendor (Assume Admin made the change)
    await dispatchNotification(vendorUserId, {
      type: "PRODUCT_STATUS_UPDATED",
      title: "Product Status Updated",
      message: `The status for '${productName}' is now '${status}'.`,
      link: "/vendor/products",
      emailData: {
        template: "vendor-notice",
        data: { notes },
      },
    });
  }

  return updatedProduct;
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

  // 2.5️⃣ Fetch vendor profile
  const userId = record.fields.user_id?.[0]; // Airtable rec ID
  let vendorProfile = null;
  if (userId) {
    const vendorRecords = await base(VENDOR_TABLE)
      .select({
        filterByFormula: `FIND("${userId}", ARRAYJOIN({user_id}))`,
        maxRecords: 1,
      })
      .firstPage();
    if (vendorRecords.length > 0) {
      vendorProfile = mapRecord(vendorRecords[0]);
    }
  }

  // 3️⃣ Merge
  const product = mapRecord(record);
  const variants = matchedVariants
    .map(mapRecord)
    .sort((a, b) => (a.pos || 0) - (b.pos || 0));

  return {
    ...product,
    vendorProfile,
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
export async function deleteProduct(id, user = null) {
  let vendorUserId = null;
  let productName = "A product";
  let status = "";

  try {
    const productRecord = await base(TABLE).find(id);
    vendorUserId = productRecord?.fields?.user_id?.[0]; // Internal Airtable ID from linked record
    productName = productRecord?.fields?.product_name || productName;
    status = productRecord?.fields?.status || "";

    if (user && user.role === "vendor") {
      // 1️⃣ Enforce Ownership!
      if (vendorUserId !== user.id && vendorUserId) {
        const err = new Error(
          "You do not have permission to delete this product.",
        );
        err.status = 403;
        throw err;
      }

      // 2️⃣ Enforce Status!
      // Vendor can only delete if draft
      const status = (productRecord?.fields?.status || "").toLowerCase();
      if (status !== "draft") {
        const err = new Error(
          "Vendors can only permanently delete 'draft' products.",
        );
        err.status = 403;
        throw err;
      }
    }
  } catch (err) {
    if (err.status) throw err;
    const error = new Error("Product not found");
    error.status = 404;
    throw error;
  }

  await base(TABLE).destroy([id]);

  if (vendorUserId) {
    if (status != "draft") {
      // 🔔 Notify Vendor
      await dispatchNotification(vendorUserId, {
        type: "PRODUCT_DELETION_COMPLETED",
        title: "Product Deleted",
        message: `Your product '${productName}' was successfully deleted by the admin.`,
        link: "/vendor/products",
        emailData: { template: "vendor-notice" },
      });
    }
  }

  return { success: true };
}

export async function getVendorStats(user_id) {
  const allRecords = await base(TABLE).select().all();

  const filtered = allRecords.filter((record) => {
    const linkedUsers = record.fields.user_id || [];
    return linkedUsers.includes(user_id);
  });

  const stats = {
    total: filtered.length,
    pending: 0, // submitted, under review
    accepted: 0, // approved, exported, confirmed
    rejected: 0, // needs fix
    draft: 0,
  };

  filtered.forEach((r) => {
    const status = (r.fields.status || "").toLowerCase();
    if (status === "draft") stats.draft++;
    else if (status === "submitted" || status === "under review")
      stats.pending++;
    else if (
      status === "approved" ||
      status === "exported" ||
      status === "confirmed"
    )
      stats.accepted++;
    else if (status === "needs fix" || status === "need fix") stats.rejected++;
  });

  return stats;
}
