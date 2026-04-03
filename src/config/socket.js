/**
 * ─── Socket.IO Configuration ─────────────────────────────────────────────────
 *
 * Initialises Socket.IO on the HTTP server and registers socket event handlers.
 * Import `getIO()` anywhere you need to emit events from services/controllers.
 */

import { Server } from "socket.io";
import { CORS_ORIGINS } from "./env.js";
import registerSocketHandlers from "../sockets/index.js";

let io;

/**
 * Attach Socket.IO to the HTTP server.
 * Call once in app.js after creating the server.
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGINS || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);

    // Register all event handlers defined in src/sockets/
    registerSocketHandlers(io, socket);

    // 🚀 Automatically join a personal room based on userId (if provided in auth)
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    if (userId) {
      socket.join(userId);
      console.log(`⚡ Socket ${socket.id} joined personal room: ${userId}`);
    }

    socket.on("disconnect", (reason) => {
      console.log(`⚡ Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("Socket.IO initialised");
  return io;
}

/**
 * Get the initialised Socket.IO instance.
 * Use in services/controllers to push real-time events.
 *
 * Example:
 *   import { getIO } from "../config/socket.js";
 *   getIO().emit("order:updated", order);
 */
export function getIO() {
  if (!io) throw new Error("Socket.IO not initialised – call initSocket first");
  return io;
}
