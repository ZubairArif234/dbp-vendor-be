/**
 * ─── Seed Script (Example) ───────────────────────────────────────────────────
 *
 * Run with:  npm run seed:users
 *
 * Creates sample users in the database for development & testing.
 * Modify the `users` array below with your own seed data.
 */

import mongoose from "mongoose";
import { MONGO_URI, MONGO_DB_NAME } from "../src/config/env.js";
import User from "../src/models/User.js";

const users = [
  {
    name: "Admin User",
    email: "admin@example.com",
    password: "password123",
    role: "admin",
  },
  {
    name: "Regular User",
    email: "user@example.com",
    password: "password123",
    role: "user",
  },
];

async function seed() {
  try {
    await mongoose.connect(`${MONGO_URI}/${MONGO_DB_NAME}`);
    console.log("Connected to MongoDB");

    await User.deleteMany({});
    console.log("Cleared existing users");

    const created = await User.create(users);
    console.log(`Seeded ${created.length} users`);
  } catch (err) {
    console.error("Seed error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("Done");
  }
}

seed();
