/**
 * ─── User Service (Example) ──────────────────────────────────────────────────
 *
 * Business logic for user operations.
 * Controllers call these; services talk to models & external APIs.
 */

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env.js";

export async function createUser({ name, email, password }) {
  const exists = await User.findOne({ email });
  if (exists) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }
  return User.create({ name, email, password });
}

export async function loginUser(email, password) {
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return { user, token };
}

export async function getUserById(id) {
  const user = await User.findById(id);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  return user;
}

export async function listUsers({ page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    User.find().skip(skip).limit(Number(limit)),
    User.countDocuments(),
  ]);
  return { data, total, page: Number(page), limit: Number(limit) };
}
