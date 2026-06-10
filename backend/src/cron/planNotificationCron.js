import { db } from "../config/db.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

/* ======================================================
   PLAN NOTIFICATION CRON — runs daily at 9 AM IST
   Trial:    reminders at 15 / 10 / 5 / 1 day(s) before trial_ends_at
   Business: reminders at 10 / 5 / 3 / 1 day(s) before subscription_ends_at
   Tracks sent reminders in companies.wa_reminders_sent (CSV).
====================================================== */

const TRIAL_REMINDER_DAYS    = [15, 10, 5, 1];
const BUSINESS_REMINDER_DAYS = [10, 5, 3, 1];

const normalizePhone = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

const sendReminder = async (company, template, daysLeft) => {
  const phone = normalizePhone(company.phone);
  try {
    await sendWhatsAppTemplate(phone, template, [company.name, String(daysLeft)]);
    console.log(`[PLAN REMINDER] ${daysLeft}d reminder sent to ${phone} (${company.name})`);
    const sentDays = (company.wa_reminders_sent || "").split(",").filter(Boolean);
    sentDays.push(String(daysLeft));
    await db.query(`UPDATE companies SET wa_reminders_sent = ? WHERE id = ?`, [sentDays.join(","), company.id]);
  } catch (e) {
    console.error(`[PLAN REMINDER] Failed for ${phone}:`, e.message);
  }
};

export const sendPlanReminders = async () => {
  const trialTemplate    = process.env.GUPSHUP_TRIAL_REMINDER_TEMPLATE    || "";
  const businessTemplate = process.env.GUPSHUP_BUSINESS_REMINDER_TEMPLATE || "";

  try {
    // ── Trial reminders (15/10/5/1 days) ──────────────────
    if (trialTemplate) {
      const [companies] = await db.query(
        `SELECT c.id, c.name, c.trial_ends_at, c.wa_reminders_sent, u.phone
         FROM companies c
         INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
         WHERE c.subscription_status = 'active' AND c.plan = 'trial'
           AND c.trial_ends_at IS NOT NULL AND c.trial_ends_at > NOW()
         GROUP BY c.id, u.phone`
      );
      for (const company of companies) {
        if (!company.phone) continue;
        const daysLeft = Math.ceil((new Date(company.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
        if (!TRIAL_REMINDER_DAYS.includes(daysLeft)) continue;
        const sentDays = (company.wa_reminders_sent || "").split(",").filter(Boolean);
        if (sentDays.includes(String(daysLeft))) continue;
        await sendReminder(company, trialTemplate, daysLeft);
      }
    }

    // ── Business reminders (10/5/3/1 days) ────────────────
    if (businessTemplate) {
      const [companies] = await db.query(
        `SELECT c.id, c.name, c.subscription_ends_at, c.wa_reminders_sent, u.phone
         FROM companies c
         INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
         WHERE c.subscription_status = 'active' AND c.plan = 'business'
           AND c.subscription_ends_at IS NOT NULL AND c.subscription_ends_at > NOW()
         GROUP BY c.id, u.phone`
      );
      for (const company of companies) {
        if (!company.phone) continue;
        const daysLeft = Math.ceil((new Date(company.subscription_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
        if (!BUSINESS_REMINDER_DAYS.includes(daysLeft)) continue;
        const sentDays = (company.wa_reminders_sent || "").split(",").filter(Boolean);
        if (sentDays.includes(String(daysLeft))) continue;
        await sendReminder(company, businessTemplate, daysLeft);
      }
    }
  } catch (err) {
    console.error("[PLAN REMINDER CRON ERROR]", err.message);
  }
};
