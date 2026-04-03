import { base } from "../config/airtable.js";
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../config/socket.js";
import sendEmail from "../utils/sendEmail.js";

const NOTIFICATION_TABLE = "notifications";
const USER_TABLE = "users";

/**

 * Dispatch a notification across all channels (Airtable, Socket, Email)
 * @param {string} recipientId - Airtable User Record ID
 * @param {object} data - { type, title, message, link, emailData? }
 */
export async function dispatchNotification(
  recipientId,
  { type, title, message, link, emailData },
) {
  const id = uuidv4();

  try {
    // 1️⃣ Create record in Airtable
    const [record] = await base(NOTIFICATION_TABLE).create([
      {
        fields: {
          id,
          user_id: [recipientId],
          type,
          title,
          message,
          link,
          is_read: false,
        },
      },
    ]);

    const notification = {
      id: record.id,
      ...record.fields,
      created_at: record.createdTime,
    };

    // 2️⃣ Real-time (Socket.io)
    try {
      const io = getIO();
      io.to(recipientId).emit("notification", notification);
      console.log(`⚡ Real-time notification sent to user ${recipientId}`);
    } catch (err) {
      console.error("Socket emit error:", err.message);
    }

    // 3️⃣ Email (Nodemailer)
    if (emailData && emailData.template) {
      try {
        let recipientEmail = emailData.to;

        // Auto-fetch email if not provided
        if (!recipientEmail) {
          try {
            const userRecord = await base(USER_TABLE).find(recipientId);
            recipientEmail =
              userRecord?.fields?.email || userRecord?.fields?.Email;
          } catch (e) {
            console.error(
              "Could not fetch user email for notification:",
              e.message,
            );
          }
        }

        if (recipientEmail) {
          await sendEmail({
            to: recipientEmail,
            subject: emailData.subject || title,
            template: emailData.template,
            data: {
              ...emailData.data,
              title,
              message,
              link,
            },
          });
          console.log(`📧 Email notification sent to ${recipientEmail}`);
        } else {
          console.log(
            `⚠️ Skipped email notification: no email found for user ${recipientId}`,
          );
        }
      } catch (err) {
        console.error("Email send error:", err.message);
      }
    }

    return notification;
  } catch (err) {
    console.error("Error dispatching notification:", err);
    throw err;
  }
}

/**
 * Dispatch notification to all admins
 */
export async function notifyAdmins(data) {
  try {
    const adminRecords = await base(USER_TABLE)
      .select({ filterByFormula: `{role} = 'admin'` })
      .all();

    const notifications = [];
    for (const admin of adminRecords) {
      const emailCopy = data.emailData
        ? {
            ...data.emailData,
            to: admin.fields.email || "admin@example.com", // Fallback if no email
          }
        : null;

      const notif = await dispatchNotification(admin.id, {
        ...data,
        emailData: emailCopy,
      });
      notifications.push(notif);
    }
    return notifications;
  } catch (err) {
    console.error("Error notifying admins:", err);
  }
}

/**
 * Fetch notifications for a user

 */
export async function getNotifications(userId, limit = 20) {
  console.log("🚀 ~ getNotifications ~ userId:", userId);

  // Airtable linked fields resolve to their primary field value (the custom UUID) in formulas,
  // NOT the internal `recXXXX` ID. So we must convert the `recXXXX` from the JWT back to the custom UUID.
  let searchId = userId;
  try {
    const user = await base(USER_TABLE).find(userId);
    searchId = user.fields.id || userId;
  } catch (err) {
    console.error("Could not fetch user to resolve custom UUID:", err.message);
  }

  const records = await base(NOTIFICATION_TABLE)
    .select({
      fields: [
        "id",
        "title",
        "message",
        "link",
        "is_read",
        "type",
        "user_id",
        "created_at",
      ],
      filterByFormula: `FIND("${searchId}", {user_id}&"") > 0`,
      sort: [{ field: "created_at", direction: "desc" }],
      maxRecords: limit,
    })
    .all();
  console.log("🚀 ~ getNotifications ~ records:", records);

  return records.map((r) => ({
    id: r.id,
    ...r.fields,
    created_at: r.get("created_at"),
  }));
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  let searchId = userId;
  try {
    const user = await base(USER_TABLE).find(userId);
    searchId = user.fields.id || userId;
  } catch (err) {}

  const records = await base(NOTIFICATION_TABLE)
    .select({
      filterByFormula: `AND(FIND("${searchId}", {user_id}&"") > 0, {is_read} = FALSE())`,
    })
    .all();

  if (records.length === 0) return { success: true, count: 0 };

  const updates = records.map((r) => ({
    id: r.id,
    fields: { is_read: true },
  }));

  // Airtable update limit is 10 per call
  for (let i = 0; i < updates.length; i += 10) {
    await base(NOTIFICATION_TABLE).update(updates.slice(i, i + 10));
  }

  return { success: true, count: updates.length };
}
