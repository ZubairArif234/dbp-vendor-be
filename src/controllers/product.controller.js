import * as service from "../services/product.service.js";

// CREATE
export const create = async (req, res) => {
  try {
    const user_id = req.user.id;
    const data = await service.createProduct(req.body, user_id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
export const update = async (req, res) => {
  try {
    const data = await service.updateProduct(req.params.id, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET (FILTERS)
export const getAll = async (req, res) => {
  try {
    const data = await service.getProducts(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//GET SINGLE
export const getSingle = async (req, res) => {
  try {
    const data = await service.getProduct(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProductStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const data = await service.updateProductStatus(
      req.params.id,
      status,
      notes,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET MINE PRODUCTS (FILTERS)
export const getMineProducts = async (req, res) => {
  try {
    const user_id = req.user.id;
    const data = await service.getMineProducts({ ...req.query, user_id });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET MINE STATS
export const getStats = async (req, res) => {
  try {
    const user_id = req.user.id;
    const data = await service.getVendorStats(user_id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE STATUS
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const data = await service.updateStatus(req.params.id, status);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
export const remove = async (req, res) => {
  try {
    await service.deleteProduct(req.params.id, req.user);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ADD NOTES
export const addNotes = async (req, res) => {
  try {
    const { note } = req.body;
    const data = await service.addNotes(req.params.id, note);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
