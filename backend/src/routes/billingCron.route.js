import express from "express";
import cron from "node-cron";
import axios from "axios";
import { db } from "../config/db.js";
import { getZohoAccessToken } from "../services/zohoToken.service.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */

const normalizeStatus = (status) => {
  if (!status) return null;
  return {
    generated: "pending",
    created: "pending",
    initiated: "pending",
    success: "paid",
    paid: "paid",
    failure: "failed",
    failed: "failed",
    expired: "expired",
    cancelled: "expired",
    canceled: "expired",
  }[status.toLowerCase()] || status.toLowerCase();
};

const toMysqlDate = (d) =>
  new Date(d).toISOString().slice(0, 19).replace("T", " ");

const safeSendEmail = async (to, subject, html) => {
  if (!to || !subject || !html) return;
  try {
    await sendEmail(to, subject, html);
    console.log(`📧 Email sent → ${to}`);
  } catch (err) {
    console.error("❌ Email failed:", err.message);
  }
};

/* ======================================================
   EMAIL TEMPLATES (SHORT + SAFE)
====================================================== */

const emailTemplates = {
  activated: (name, plan, endsAt) => ({
    subject: "🎉 PROMEET Subscription Activated",
    html: `
      <p>Hi <b>${name}</b>,</p>
      <p>Your <b>${plan.toUpperCase()}</b> plan is now active.</p>
      <p><b>Valid till:</b> ${new Date(endsAt).toDateString()}</p>
      <p><a href="${process.env.FRONTEND_URL}">Open Dashboard</a></p>
    `,
  }),

  upgraded: (name, from, to, endsAt) => ({
    subject: "🚀 PROMEET Plan Upgraded",
    html: `
      <p>Hi <b>${name}</b>,</p>
      <p>Your plan was upgraded from <b>${from}</b> → <b>${to}</b></p>
      <p>Valid till: ${new Date(endsAt).toDateString()}</p>
    `,
  }),

  expiring: (name, days) => ({
    subject: `⚠️ PROMEET expires in ${days} day(s)`,
    html: `<p>Your subscription expires in <b>${days} days</b>.</p>`,
  }),

  expired: (name) => ({
    subject: "🔴 PROMEET Subscription Expired",
    html: `<p>Your subscription has expired. Please renew.</p>`,
  }),
};

/* ======================================================
   MAIN CRON
====================================================== */

async function repairBilling() {
  console.log("⏳ BILLING CRON STARTED");

  const [companies] = await db.query(`
    SELECT
      c.id,
      c.name,
      c.plan,
      c.subscription_status,
      c.subscription_ends_at,
      c.trial_ends_at,
      c.last_payment_link_id,
      c.pending_upgrade_plan,
      (SELECT u.email FROM users u WHERE u.company_id = c.id LIMIT 1) AS company_email
    FROM companies c
    WHERE c.last_payment_link_id IS NOT NULL
  `);

  if (!companies.length) {
    console.log("✅ Nothing to process");
    return;
  }

  const token = await getZohoAccessToken();
  if (!token) {
    console.error("❌ Zoho token missing");
    return;
  }

  for (const c of companies) {
    console.log(`\n🏢 ${c.name} (${c.id})`);

    try {
      const { data } = await axios.get(
        `https://www.zohoapis.in/billing/v1/paymentlinks/${c.last_payment_link_id}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );

      const status = normalizeStatus(data?.payment_link?.status);
      console.log("💳 Zoho Status:", status);

      if (status === "paid") {
        const paidAt =
          data.payment_link.paid_at ||
          data.payment_link.updated_time ||
          new Date();

        const plan = c.pending_upgrade_plan || c.plan;
        const duration = plan === "business" ? 30 : 15;

        const endsAt = new Date(
          new Date(paidAt).getTime() + duration * 86400000
        );

        await db.query(
          `
          UPDATE companies
          SET
            subscription_status='active',
            plan=?,
            pending_upgrade_plan=NULL,
            subscription_ends_at=?,
            trial_ends_at=NULL,
            updated_at=NOW()
          WHERE id=?
        `,
          [plan, toMysqlDate(endsAt), c.id]
        );

        const mail = c.pending_upgrade_plan
          ? emailTemplates.upgraded(c.name, c.plan, plan, endsAt)
          : emailTemplates.activated(c.name, plan, endsAt);

        await safeSendEmail(c.company_email, mail.subject, mail.html);
      }
    } catch (err) {
      console.error("❌ Company error:", err.message);
    }
  }

  await checkExpiry();
  console.log("✅ BILLING CRON FINISHED\n");
}

/* ======================================================
   EXPIRY CHECK
====================================================== */

async function checkExpiry() {
  const now = new Date();

  // Expiring in 3 days
  const [expiring] = await db.query(`
    SELECT id,name,subscription_ends_at,
    (SELECT email FROM users WHERE company_id=companies.id LIMIT 1) email
    FROM companies
    WHERE subscription_status='active'
    AND subscription_ends_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)
  `);

  for (const c of expiring) {
    const days = Math.ceil(
      (new Date(c.subscription_ends_at) - now) / 86400000
    );
    const mail = emailTemplates.expiring(c.name, days);
    await safeSendEmail(c.email, mail.subject, mail.html);
  }

  // Expired
  const [expired] = await db.query(`
    SELECT id,name,
    (SELECT email FROM users WHERE company_id=companies.id LIMIT 1) email
    FROM companies
    WHERE subscription_status='active'
    AND subscription_ends_at < NOW()
  `);

  for (const c of expired) {
    await db.query(
      `UPDATE companies SET subscription_status='expired', updated_at=NOW() WHERE id=?`,
      [c.id]
    );

    const mail = emailTemplates.expired(c.name);
    await safeSendEmail(c.email, mail.subject, mail.html);
  }
}

/* ======================================================
   SCHEDULE + MANUAL TRIGGER
====================================================== */

cron.schedule("*/3 * * * *", repairBilling);

router.get("/run", async (req, res) => {
  await repairBilling();
  res.json({ success: true, message: "Billing cron executed" });
});

export default router;
