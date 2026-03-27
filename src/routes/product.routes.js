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

// UPDATE
router.put("/:id", controller.update);

// UPDATE STATUS
router.patch("/:id/status", controller.updateStatus);

// ADD NOTES
router.patch("/:id/notes", controller.addNotes);

// DELETE
router.delete("/:id", controller.remove);

export default router;
