/**
 * ─── Authentication Middleware ────────────────────────────────────────────────
 *
 * Verifies the JWT from the Authorization header and attaches the decoded
 * user payload to `req.user`.
 *
 * Usage:
 *   import { auth, authorize } from "../middleware/auth.js";
 *   router.get("/profile", auth, controller.getProfile);
 *   router.delete("/users/:id", auth, authorize("admin"), controller.deleteUser);
 */

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

export function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  }

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * Role-based access control.
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
    }
    next();
  };
}
