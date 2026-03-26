/**
 * ─── User Controller (Example) ───────────────────────────────────────────────
 *
 * Thin request handlers – parse input, call a service, return a response.
 * Keep business logic in services, not here.
 */

import * as userService from "../services/user.service.js";

export async function register(req, res) {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const { user, token } = await userService.loginUser(email, password);
    res.json({ success: true, data: { user, token } });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

export async function getProfile(req, res) {
  try {
    const user = await userService.getUserById(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}

export async function listUsers(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await userService.listUsers({ page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
}
