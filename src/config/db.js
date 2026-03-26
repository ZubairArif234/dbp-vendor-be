/**
 * ─── MongoDB Connection ──────────────────────────────────────────────────────
 *
 * Connects to MongoDB using Mongoose. Called once at server start.
 */

import mongoose from "mongoose";
import { MONGO_URI, MONGO_DB_NAME } from "./env.js";

export async function connectDB() {
  try {
    await mongoose.connect(`${MONGO_URI}/${MONGO_DB_NAME}`);
    console.log(`MongoDB connected → ${MONGO_DB_NAME}`);
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB runtime error:", err.message);
  });
}
