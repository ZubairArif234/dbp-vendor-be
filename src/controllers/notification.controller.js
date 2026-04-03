import * as notificationService from "../services/notification.service.js";

/**
 * GET /api/notifications
 * Fetch recent notifications for the logged-in user
 */
export async function getMyNotifications(req, res) {
  try {
    const userId = req.user.id;
    const notifications = await notificationService.getNotifications(userId);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/notifications/mark-read
 * Mark all notifications as read for the logged-in user
 */
export async function markRead(req, res) {
  try {
    const userId = req.user.id;
    const result = await notificationService.markAllAsRead(userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
