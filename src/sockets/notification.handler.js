/**
 * ─── Notification Socket Handlers ──────────────────────────────────────────
 *
 * Handles real-time notification events.
 */

/**
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export function registerNotificationHandlers(io, socket) {
  // ─── Mark as Read ─────────────────────────────────────────────────────────
  socket.on("notification:mark-read", (notificationId) => {
    // This could optionally trigger a DB update if not handled via REST
    console.log(`Notification ${notificationId} marked as read by ${socket.id}`);
  });

  // ─── Join personal room (redundant if handled in initSocket, but safe) ──────
  socket.on("notification:join", (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined notification room: ${userId}`);
  });
}
