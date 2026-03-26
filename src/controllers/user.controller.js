/**
 * ─── User Controller ───────────────────────────────────────────────
 */

import * as userService from "../services/user.service.js";

// ✅ Register
export async function register(req, res) {
  try {
    const user = await userService.createUser(req.body);

    res.status(201).json({
      success: true,
      message: "User registered. Please verify your email.",
      data: user,
    });
  } catch (err) {
    console.log(err.message, "error");

    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// ✅ Login
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const { user, token ,role} = await userService.loginUser(
      email,
      password
    );
    console.log("🚀 ~ login ~ user:", user)

    res.json({
      success: true,
      data: { user, token, role },
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// ✅ Verify Email OTP
export async function verifyEmail(req, res) {
  try {
    const { email, otp } = req.body;

    await userService.verifyEmail({ email, otp });

    res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// ✅ Resend OTP (verify / forgot)
export async function resendOtp(req, res) {
  try {
    const { email, type } = req.body;

    const result = await userService.resendOtp({
      email,
      type, // "verify" | "forgot"
    });

    res.json({
      success: true,
      message: "OTP sent successfully",
      data: result, // contains otp (you'll email it)
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// ✅ Forgot Password (send OTP)
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    const result = await userService.forgotPassword(email);

    res.json({
      success: true,
      message: "Password reset OTP sent",
      data: result,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// ✅ Reset Password
export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    await userService.resetPassword({
      email,
      otp,
      newPassword,
    });

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// ✅ Get Profile
export async function getProfile(req, res) {
  try {
    const user = await userService.getUserById(req.user.id);

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// ✅ List Users
export async function listUsers(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await userService.listUsers({
      page,
      limit,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}