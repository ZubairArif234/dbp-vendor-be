import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { base } from "../config/airtable.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env.js";

const TABLE_NAME = "users";

export async function createUser({ full_name, email, password }) {
  // 1. Check if user already exists
  const existingUsers = await base(TABLE_NAME)
    .select({
      filterByFormula: `{Email} = '${email}'`,
      maxRecords: 1,
    })
    .firstPage();

  if (existingUsers.length > 0) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }

  // 2. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. Generate user ID
  const userId = uuidv4();

  // 4. Generate OTP (6-digit)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 5. Set OTP expiry (10 minutes from now)
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // 6. Create user in Airtable
  const records = await base(TABLE_NAME).create([
    {
      fields: {
        id: userId,
        full_name: full_name,
        email: email,
        password: hashedPassword,
        email_verification_token: otp,
        email_verification_token_expires: otpExpiry,
      },
    },
  ]);

  const newUser = records[0];

  // 7. Return safe user data + OTP (for email sending)
  return {
    id: newUser.fields.id || newUser.id,
    name: newUser.fields.full_name,
    email: newUser.fields.email,
    otp, // send this via email service
    otpExpiry,
  };
}

export async function loginUser(email, password) {
  const users = await base(TABLE_NAME)
    .select({
      filterByFormula: `{email} = "${email}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (!users.length) {
    throw new Error("Invalid email or password");
  }

  const user = users[0];


  const isValidPassword = await bcrypt.compare(
    password,
    user.fields.password
  );

  if (!isValidPassword) {
    throw new Error("Invalid email or password");
  }

  const token = jwt.sign(
    { id: user.id, role: user.fields.role || "user" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    user: {
      id: user.id,
      name: user.fields.full_name,
      email: user.fields.email,
      is_profile_completed: user.fields.is_profile_completed,
      is_email_verified: user.fields.is_email_verified,
      is_approved_by_admin: user.fields.is_approved_by_admin,
      profile_image: user.fields.profile_image,
    },
    role: user.fields.role,
    token,
  };
}

export async function verifyEmail({ email, otp }) {
  const records = await base(TABLE_NAME)
    .select({
      filterByFormula: `{email} = "${email}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (!records.length) {
    throw new Error("User not found");
  }

  const user = records[0];

  if (user.fields.email_verification_token !== otp) {
    throw new Error("Invalid OTP");
  }

  if (
    new Date() >
    new Date(user.fields.email_verification_token_expires)
  ) {
    throw new Error("OTP expired");
  }

  await base(TABLE_NAME).update([
    {
      id: user.id,
      fields: {
        is_email_verified: true,
        email_verification_token: "",
        email_verification_token_expires: null,
      },
    },
  ]);

  return { success: true };
}

export async function resendOtp({ email, type }) {
  const records = await base(TABLE_NAME)
    .select({
      filterByFormula: `{email} = "${email}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (!records.length) {
    throw new Error("User not found");
  }

  const user = records[0];

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  let fieldsToUpdate = {};

  if (type === "verify") {
    fieldsToUpdate = {
      email_verification_token: otp,
      email_verification_token_expires: expiry,
    };
  } else if (type === "forgot") {
    fieldsToUpdate = {
      reset_password_token: otp,
      reset_password_token_expires: expiry,
    };
  } else {
    throw new Error("Invalid type");
  }

  await base(TABLE_NAME).update([
    {
      id: user.id,
      fields: fieldsToUpdate,
    },
  ]);

  return { otp }; // send via email
}

export async function forgotPassword(email) {
  const records = await base(TABLE_NAME)
    .select({
      filterByFormula: `{email} = "${email}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (!records.length) {
    throw new Error("User not found");
  }

  const user = records[0];

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await base(TABLE_NAME).update([
    {
      id: user.id,
      fields: {
        password_reset_token: otp,
        password_reset_token_expires: expiry,
      },
    },
  ]);

  return { otp };
}

export async function resetPassword({ email, otp, newPassword }) {
  const records = await base(TABLE_NAME)
    .select({
      filterByFormula: `{email} = "${email}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (!records.length) {
    throw new Error("User not found");
  }

  const user = records[0];

  if (user.fields.password_reset_token !== otp) {
    throw new Error("Invalid OTP");
  }

  if (
    new Date() >
    new Date(user.fields.password_reset_token_expires)
  ) {
    throw new Error("OTP expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await base(TABLE_NAME).update([
    {
      id: user.id,
      fields: {
        password: hashedPassword,
        password_reset_token: "",
        password_reset_token_expires: null,
      },
    },
  ]);

  return { success: true };
}

export async function getUserById(id) {
  try {
    const user = await base(TABLE_NAME).find(id);
    return {
      id: user.id,
      full_name: user.fields.full_name,
      email: user.fields.email,
      role: user.fields.role,
      profile_image: user.fields.profile_image,
    };
  } catch (err) {
    if (err.statusCode === 404) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }
    throw err;
  }
}

export async function listUsers({ page = 1, limit = 20 }) {
  // Simple pagination logic using select with maxRecords
  // Note: True pagination with Airtable requires offset/fetchNextPage
  const users = await base(TABLE_NAME)
    .select({
      maxRecords: Number(limit),
      // offset is not easily addressable by page number without caching the offset tokens,
      // so we will just return the first 'limit' records for simplicity.
    })
    .firstPage();

  const data = users.map((u) => ({
    id: u.id,
    name: u.fields.Name,
    email: u.fields.Email,
  }));

  return { data, total: data.length, page: 1, limit: Number(limit) };
}
