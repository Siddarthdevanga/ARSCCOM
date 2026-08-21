import { db } from "../config/db.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

/* ======================================================
   ONBOARDING NURTURE CRON — runs daily at 10 AM IST
   Post-signup WhatsApp drip for every trial company (web-registered
   and Razorpay landing-page signups alike):
     Day 1  — video walkthrough of the platform
     Day 5  — benefits of adding a WhatsApp community/group link
     Day 7  — testimonial
     Day 10 — how to export visitor data (CSV) and import into a CRM
     Day 12 — nudge to upgrade to the Business plan

   Day 0 = companies.created_at (signup = trial start for both flows).
   Stops automatically once a company is no longer plan='trial' (the
   query itself excludes upgraded companies — no separate flag needed).

   Sent via the "Promeetmarketing" Gupshup app — same GUPSHUP_BOT_*
   credentials already used for the chatbot/Razorpay welcome flow,
   since that app IS Promeetmarketing (confirmed via Secrets Manager).

   Backfill-safe: if a company is already past several onboarding
   days (e.g. an existing mid-trial company when this cron first
   ships), only the single most-recent due message is sent — earlier
   ones are marked as sent without actually sending them, so nobody
   gets a burst of backdated messages.
====================================================== */

export const ONBOARDING_DAYS = [1, 5, 7, 10, 12];

export const TEMPLATE_ENV_BY_DAY = {
  1:  "GUPSHUP_ONBOARD_DAY1_TEMPLATE",
  5:  "GUPSHUP_ONBOARD_DAY5_TEMPLATE",
  7:  "GUPSHUP_ONBOARD_DAY7_TEMPLATE",
  10: "GUPSHUP_ONBOARD_DAY10_TEMPLATE",
  12: "GUPSHUP_ONBOARD_DAY12_TEMPLATE",
};

const normalizePhone = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

/**
 * Sends one onboarding-drip day's message to a single company and marks it
 * (and every earlier not-yet-sent day) as covered. Shared by the daily cron
 * and the superadmin "send now" manual override.
 */
export const sendOnboardingDay = async (company, day) => {
  const templateEnvKey = TEMPLATE_ENV_BY_DAY[day];
  const templateId = process.env[templateEnvKey] || "";
  if (!templateId) {
    throw new Error(`${templateEnvKey} is not configured`);
  }
  if (!company.phone) {
    throw new Error("Company has no phone number on file");
  }

  const phone = normalizePhone(company.phone);
  await sendWhatsAppTemplate(phone, templateId, [company.name || "there"]);

  const sentDays = (company.onboarding_nurture_sent || "").split(",").filter(Boolean);
  const newlyCovered = ONBOARDING_DAYS.filter((d) => d <= day && !sentDays.includes(String(d)));
  const updatedSentDays = [...sentDays, ...newlyCovered.map(String)];

  await db.query(
    `UPDATE companies SET onboarding_nurture_sent = ? WHERE id = ?`,
    [updatedSentDays.join(","), company.id]
  );
};

export const sendOnboardingNurtureMessages = async () => {
  try {
    const [companies] = await db.query(
      `SELECT c.id, c.name, c.created_at, c.onboarding_nurture_sent, u.phone
       FROM companies c
       INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
       WHERE c.plan = 'trial'
         AND c.subscription_status IN ('trial', 'active')
       GROUP BY c.id, u.phone`
    );

    for (const company of companies) {
      if (!company.phone) continue;

      const daysSinceStart = Math.floor(
        (Date.now() - new Date(company.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const sentDays = (company.onboarding_nurture_sent || "").split(",").filter(Boolean);

      // Find the latest onboarding day that has arrived and isn't sent yet.
      let dayToSend = null;
      for (const day of ONBOARDING_DAYS) {
        if (daysSinceStart >= day && !sentDays.includes(String(day))) {
          dayToSend = day;
        }
      }
      if (dayToSend === null) continue;

      try {
        await sendOnboardingDay(company, dayToSend);
        console.log(`[ONBOARD-NURTURE] Day ${dayToSend} sent to ${company.phone} (${company.name})`);
      } catch (e) {
        console.error(`[ONBOARD-NURTURE] Day ${dayToSend} failed for ${company.phone}:`, e.message);
        // leave unmarked — retry next run
      }
    }
  } catch (err) {
    console.error("[ONBOARD-NURTURE CRON ERROR]", err.message);
  }
};
