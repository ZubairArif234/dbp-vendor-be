import express from "express";
import * as controller from "../controllers/notification.controller.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Fetch Notifications (History)
router.get("/", auth, controller.getMyNotifications);

// Mark as Read
router.patch("/mark-read", auth, controller.markRead);

export default router;
