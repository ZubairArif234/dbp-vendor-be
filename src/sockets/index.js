/**
 * ─── Socket Event Handlers ───────────────────────────────────────────────────
 *
 * Registers all Socket.IO event listeners for a connected socket.
 * Split large handler sets into separate files and import them here.
 *
 * This file is imported by src/config/socket.js on each new connection.
 */

import { registerChatHandlers } from "./chat.handler.js";
import { registerNotificationHandlers } from "./notification.handler.js";

/**
 * @param {import("socket.io").Server} io   – the Socket.IO server instance
 * @param {import("socket.io").Socket} socket – the individual client socket
 */
export default function registerSocketHandlers(io, socket) {
  // Register handler groups
  registerChatHandlers(io, socket);
  registerNotificationHandlers(io, socket);
}
