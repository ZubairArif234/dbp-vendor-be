import express from "express";
import * as controller from "../controllers/product.controller.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// CREATE
router.post("/", auth, controller.create);

// GET ALL (filters supported)
router.get("/", controller.getAll);
// GET MINE PRODUCTS (filters supported)
router.get("/mine", auth, controller.getMineProducts);
// GET MINE STATS
router.get("/mine/stats", auth, controller.getStats);
// GET SINGLE
router.get("/:id", controller.getSingle);

// UPDATE
router.patch("/:id", auth, controller.update);
// UPDATE PRODUCT STATUS
router.patch("/status/:id", controller.updateProductStatus);
// UPDATE STATUS
router.patch("/:id/status", controller.updateStatus);

// ADD NOTES
router.patch("/:id/notes", controller.addNotes);

// DELETE
router.delete("/:id", auth, controller.remove);

export default router;
