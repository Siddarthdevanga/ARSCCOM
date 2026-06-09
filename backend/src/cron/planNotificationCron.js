import { db } from "../config/db.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

/* ======================================================
   PLAN NOTIFICATION CRON — runs daily
   Sends WhatsApp expiry reminders at 15 / 10 / 5 / 1 day(s)
   before trial_ends_at.
   Tracks sent reminders in companies.wa_reminders_sent (CSV).
====================================================== */

const REMINDER_DAYS = [15, 10, 5, 1];

const normalizePhone = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  return d;
};

export const sendPlanReminders = async () => {
  const reminderTemplate = process.env.GUPSHUP_TRIAL_REMINDER_TEMPLATE || "";
  if (!reminderTemplate) return;

  try {
    const [companies] = await db.query(
      `SELECT c.id, c.name, c.trial_ends_at, c.wa_reminders_sent,
              u.phone
       FROM companies c
       INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
       WHERE c.subscription_status = 'active'
         AND c.plan = 'trial'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at > NOW()
       GROUP BY c.id, u.phone`
    );

    for (const company of companies) {
      if (!company.phone) continue;

      const daysLeft = Math.ceil(
        (new Date(company.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
      );

      if (!REMINDER_DAYS.includes(daysLeft)) continue;

      const sentDays = (company.wa_reminders_sent || "").split(",").filter(Boolean).map(Number);
      if (sentDays.includes(daysLeft)) continue;

      const phone = normalizePhone(company.phone);
      try {
        await sendWhatsAppTemplate(phone, reminderTemplate, [company.name, String(daysLeft)]);
        console.log(`[PLAN REMINDER] ${daysLeft}d reminder sent to ${phone} (${company.name})`);
        const updated = [...sentDays, daysLeft].join(",");
        await db.query(`UPDATE companies SET wa_reminders_sent = ? WHERE id = ?`, [updated, company.id]);
      } catch (e) {
        console.error(`[PLAN REMINDER] Failed for ${phone}:`, e.message);
      }
    }
  } catch (err) {
    console.error("[PLAN REMINDER CRON ERROR]", err.message);
  }
};
