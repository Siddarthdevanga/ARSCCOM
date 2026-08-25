import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";
import { calcPrice } from "../constants/pricing.js";
import { emailFooter } from "../services/auth.service.js";

/* ======================================================
   RAZORPAY PRE-CHARGE REMINDER CRON — runs daily at 9:30 AM IST
   Sends a "your card will be charged in 3 days" notice for every active
   Razorpay subscription approaching its next billing date — distinct
   from the existing planNotificationCron reminders (those are framed as
   "renew now or lose access", which doesn't apply here since Razorpay
   auto-debits without any action needed).

   razorpay_charge_reminder_sent is reset to 0 every time a cycle
   activates/renews (see razorpaySubscription.service.js), so this fires
   once per cycle without needing a CSV-of-sent-dates like the older
   wa_reminders_sent column uses.
====================================================== */

const REMINDER_DAYS_BEFORE = 3;

const normalizePhone = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

const PLAN_LABELS = { business: "Business", enterprise: "Enterprise" };

export const sendChargeReminders = async () => {
  try {
    const [companies] = await db.query(
      `SELECT c.id, c.name, c.plan, c.billing_interval, c.subscription_ends_at, u.email, u.phone
       FROM companies c
       INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
       WHERE c.razorpay_subscription_id IS NOT NULL
         AND c.subscription_status = 'active'
         AND c.razorpay_charge_reminder_sent = 0
         AND c.subscription_ends_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
       GROUP BY c.id, u.email`,
      [REMINDER_DAYS_BEFORE]
    );

    for (const company of companies) {
      const pricing = calcPrice(company.plan, company.billing_interval || "monthly");
      if (!pricing) continue;

      const chargeDateLabel = new Date(company.subscription_ends_at).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      });
      const planLabel = PLAN_LABELS[company.plan] || company.plan;

      try {
        if (company.email) {
          await sendEmail({
            to: company.email,
            subject: `Hai Visitor — Upcoming charge of ₹${pricing.totalStr} on ${chargeDateLabel}`,
            html: `
              <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
                <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">H<span style="color:#FDBA74;">ai</span> Visitor</div>
                  <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">Upcoming Renewal</div>
                </div>
                <div style="padding:28px;">
                  <p style="font-size:15px;color:#262046;">Hello <b>${company.name}</b>,</p>
                  <p style="font-size:15px;color:#262046;">
                    Your <b>Hai Visitor ${planLabel}</b> subscription will renew automatically in ${REMINDER_DAYS_BEFORE} days.
                  </p>
                  <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
                    <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
                      <tr><td style="padding:4px 0;color:#6E6890;">Amount</td><td style="padding:4px 0;text-align:right;font-weight:700;">₹${pricing.totalStr}</td></tr>
                      <tr><td style="padding:4px 0;color:#6E6890;">Charge date</td><td style="padding:4px 0;text-align:right;font-weight:700;">${chargeDateLabel}</td></tr>
                    </table>
                  </div>
                  <p style="font-size:13px;color:#6E6890;">
                    No action needed — this will be charged automatically to your saved payment method. Want to make changes? You can cancel anytime from Settings.
                  </p>
                  ${emailFooter()}
                </div>
              </div>
            `,
          });
        }

        if (company.phone && process.env.GUPSHUP_CHARGE_REMINDER_TEMPLATE) {
          await sendWhatsAppTemplate(
            normalizePhone(company.phone),
            process.env.GUPSHUP_CHARGE_REMINDER_TEMPLATE,
            [company.name, `₹${pricing.totalStr}`, chargeDateLabel]
          );
        }

        await db.query(`UPDATE companies SET razorpay_charge_reminder_sent = 1 WHERE id = ?`, [company.id]);
        console.log(`[CHARGE-REMINDER] Sent to company ${company.id} (${company.name}) — ₹${pricing.totalStr} on ${chargeDateLabel}`);
      } catch (e) {
        console.error(`[CHARGE-REMINDER] Failed for company ${company.id}:`, e.message);
      }
    }
  } catch (err) {
    console.error("[CHARGE-REMINDER CRON ERROR]", err.message);
  }
};
