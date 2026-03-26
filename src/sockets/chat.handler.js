/**
 * ─── Chat Socket Handlers (Example) ──────────────────────────────────────────
 *
 * Demonstrates how to organise socket events by feature.
 * Replace with your own real-time logic.
 *
 * Events handled:
 *   chat:join     – join a chat room
 *   chat:leave    – leave a chat room
 *   chat:message  – send a message to a room
 */

/**
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export function registerChatHandlers(io, socket) {
  // ─── Join a room ─────────────────────────────────────────────────────────
  socket.on("chat:join", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit("chat:user-joined", {
      socketId: socket.id,
      roomId,
    });
  });

  // ─── Leave a room ───────────────────────────────────────────────────────
  socket.on("chat:leave", (roomId) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);
    socket.to(roomId).emit("chat:user-left", {
      socketId: socket.id,
      roomId,
    });
  });

  // ─── Send a message ─────────────────────────────────────────────────────
  socket.on("chat:message", ({ roomId, message }) => {
    io.to(roomId).emit("chat:message", {
      socketId: socket.id,
      roomId,
      message,
      timestamp: new Date().toISOString(),
    });
  });
}
