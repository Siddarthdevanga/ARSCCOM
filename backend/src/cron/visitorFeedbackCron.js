import { db } from "../config/db.js";
import { sendFeedbackWhatsApp, normalizePhone } from "../utils/whatsapp.js";

/* ======================================================
   VISITOR FEEDBACK CRON
   Runs every minute.
   Finds visitors who checked in 5 hours ago (±3 min window),
   haven't received a feedback request yet.
   Sends WhatsApp template with 3 quick-reply rating buttons.
   Marks feedback_sent = 1 after sending.

   Requires:
     visitors.feedback_sent   TINYINT(1) DEFAULT 0
     visitors.feedback_rating VARCHAR(50) NULL
     GUPSHUP_FEEDBACK_TEMPLATE  — UUID of approved template
====================================================== */

export const sendVisitorFeedback = async () => {
  const templateId = process.env.GUPSHUP_FEEDBACK_TEMPLATE;
  if (!templateId) return; // not configured yet, skip silently

  try {
    // check_in stored as UTC; NOW() is UTC on this server.
    // Window: checked in between 4h57m and 5h03m ago.
    const [visitors] = await db.query(
      `SELECT v.id, v.name, v.phone, c.name AS company_name
       FROM visitors v
       INNER JOIN companies c ON c.id = v.company_id
       WHERE (v.feedback_sent = 0 OR v.feedback_sent IS NULL)
         AND v.check_in BETWEEN
               DATE_SUB(NOW(), INTERVAL 303 MINUTE)
             AND
               DATE_SUB(NOW(), INTERVAL 297 MINUTE)`
    );

    for (const v of visitors) {
      let phone;
      try {
        phone = normalizePhone(v.phone);
      } catch {
        console.warn(`[FEEDBACK CRON] Invalid phone for visitor ${v.id}: ${v.phone}`);
        await db.query(`UPDATE visitors SET feedback_sent = 1 WHERE id = ?`, [v.id]);
        continue;
      }

      try {
        await sendFeedbackWhatsApp({
          phone:       v.phone,
          visitorName: v.name         || "there",
          companyName: v.company_name || "our office",
        });
        console.log(`[FEEDBACK CRON] Sent to ${phone} (visitor ${v.id})`);
      } catch (e) {
        console.error(`[FEEDBACK CRON] WhatsApp failed for visitor ${v.id}:`, e.message);
      }

      // Mark as sent regardless of WhatsApp success to avoid retrying every minute
      await db.query(`UPDATE visitors SET feedback_sent = 1 WHERE id = ?`, [v.id]);
    }
  } catch (err) {
    console.error("[FEEDBACK CRON ERROR]", err.message);
  }
};
