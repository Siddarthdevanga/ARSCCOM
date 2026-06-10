import { db } from "../config/db.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

export const sendPostDemoMessages = async () => {
  const attendedTemplate = process.env.GUPSHUP_DEMO_ATTENDED_TEMPLATE || "";
  const missedTemplate   = process.env.GUPSHUP_DEMO_MISSED_TEMPLATE   || "";

  try {
    // Send attended follow-up (superadmin marked attended = 1, not yet sent)
    if (attendedTemplate) {
      const [rows] = await db.query(
        `SELECT id, name, phone FROM demo_appointments
         WHERE attended = 1 AND post_demo_sent = 0`
      );
      for (const appt of rows) {
        try {
          await sendWhatsAppTemplate(appt.phone, attendedTemplate, [appt.name || "there"]);
          console.log(`[POST DEMO] Attended msg sent to ${appt.phone}`);
        } catch (e) {
          console.error(`[POST DEMO] Attended failed for ${appt.phone}:`, e.message);
        }
        await db.query(`UPDATE demo_appointments SET post_demo_sent = 1 WHERE id = ?`, [appt.id]);
      }
    }

    // Auto-mark missed 2 hours after appointment time, send missed follow-up
    if (missedTemplate) {
      const [rows] = await db.query(
        `SELECT id, name, phone FROM demo_appointments
         WHERE attended IS NULL AND post_demo_sent = 0
           AND CAST(CONCAT(app_date, ' ', app_time) AS DATETIME) <= DATE_SUB(NOW(), INTERVAL 2 HOUR)`
      );
      for (const appt of rows) {
        try {
          await sendWhatsAppTemplate(appt.phone, missedTemplate, [appt.name || "there"]);
          console.log(`[POST DEMO] Missed msg sent to ${appt.phone}`);
        } catch (e) {
          console.error(`[POST DEMO] Missed failed for ${appt.phone}:`, e.message);
        }
        await db.query(
          `UPDATE demo_appointments SET attended = 0, post_demo_sent = 1 WHERE id = ?`,
          [appt.id]
        );
        // Reset nurture so it starts fresh from now (2 days after missed → step 1 fires)
        await db.query(
          `UPDATE whatsapp_leads SET nurture_step = 0, last_nurture_sent_at = NOW() WHERE phone = ?`,
          [appt.phone]
        );
      }
    }
  } catch (err) {
    console.error("[POST DEMO CRON ERROR]", err.message);
  }
};
