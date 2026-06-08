import { db } from "../config/db.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

/* ======================================================
   DEMO APPOINTMENT REMINDER CRON
   Runs every minute — sends WhatsApp reminder 1 hour
   before each demo appointment.
   Requires: demo_appointments.reminder_sent TINYINT(1) DEFAULT 0
====================================================== */

export const sendDemoReminders = async () => {
  const reminderTemplate = process.env.GUPSHUP_DEMO_REMINDER_TEMPLATE || "";
  if (!reminderTemplate) return; // template not configured yet, skip silently

  try {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const lo     = new Date(nowIST.getTime() + 57 * 60_000);  // +57 min
    const hi     = new Date(nowIST.getTime() + 63 * 60_000);  // +63 min

    const fmtDT = (d) => {
      const Y = d.getFullYear();
      const M = String(d.getMonth() + 1).padStart(2, "0");
      const D = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      return `${Y}-${M}-${D} ${h}:${m}:${s}`;
    };

    const [appointments] = await db.query(
      `SELECT id, name, phone, app_date, app_time
       FROM demo_appointments
       WHERE (reminder_sent = 0 OR reminder_sent IS NULL)
         AND CAST(CONCAT(app_date, ' ', app_time) AS DATETIME) BETWEEN ? AND ?`,
      [fmtDT(lo), fmtDT(hi)]
    );

    for (const appt of appointments) {
      const dateStr = appt.app_date instanceof Date
        ? appt.app_date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        : String(appt.app_date).split("T")[0];

      const prettyDate = new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });

      const [hh, mm] = String(appt.app_time).split(":").map(Number);
      const period   = hh >= 12 ? "PM" : "AM";
      const hour     = hh % 12 || 12;
      const prettyTime = `${hour}:${String(mm).padStart(2, "0")} ${period}`;

      try {
        await sendWhatsAppTemplate(
          appt.phone,
          reminderTemplate,
          [appt.name || "there", prettyDate, prettyTime]
        );
        console.log(`[DEMO REMINDER] Sent to ${appt.phone} for ${dateStr} ${appt.app_time}`);
      } catch (e) {
        console.error(`[DEMO REMINDER] Failed for ${appt.phone}:`, e.message);
      }

      await db.query(`UPDATE demo_appointments SET reminder_sent = 1 WHERE id = ?`, [appt.id]);
    }
  } catch (err) {
    console.error("[DEMO REMINDER CRON ERROR]", err.message);
  }
};
