import express from "express";
import * as vendorController from "../controllers/vendor.controller.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", auth, vendorController.createVendorProfile);
router.get("/", auth, vendorController.listVendorProfiles);
router.get("/me", auth, vendorController.getMyProfile);
router.get("/:id", auth, vendorController.getVendorProfile);
router.put("/:id", auth, vendorController.updateVendorProfile);
router.delete("/:id", auth, vendorController.deleteVendorProfile);

export default router;