import express from "express";
import cron from "node-cron";
import axios from "axios";
import { db } from "../config/db.js";
import { getZohoAccessToken } from "../services/zohoToken.service.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   STATUS NORMALIZER
====================================================== */
function normalizeStatus(status) {
  if (!status) return null;

  const map = {
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
  };

  return map[String(status).toLowerCase()] || status.toLowerCase();
}

/* ======================================================
   EMAIL TEMPLATES
====================================================== */
const emailTemplates = {
  subscriptionActivated: (company, plan, expiresAt) => ({
    subject: "🎉 Your PROMEET Subscription is Now Active!",
    html: `
      <p>Dear <b>${company}</b> Team,</p>
      <p>Your <b>${plan.toUpperCase()}</b> plan is now active.</p>
      <p><b>Valid until:</b> ${new Date(expiresAt).toDateString()}</p>
      <p>
        <a href="${process.env.FRONTEND_URL || "https://promeet.zodopt.com"}">
          Access Dashboard
        </a>
      </p>
    `,
  }),

  upgradeCompleted: (company, fromPlan, toPlan, expiresAt) => ({
    subject: "🚀 PROMEET Plan Upgrade Successful",
    html: `
      <p>Dear <b>${company}</b> Team,</p>
      <p>Your plan has been upgraded:</p>
      <p><b>${fromPlan.toUpperCase()}</b> → <b>${toPlan.toUpperCase()}</b></p>
      <p><b>Valid until:</b> ${new Date(expiresAt).toDateString()}</p>
    `,
  }),

  subscriptionExpiring: (company, plan, expiresAt, daysLeft) => ({
    subject: `⚠️ PROMEET Subscription Expires in ${daysLeft} Day${daysLeft === 1 ? "" : "s"}`,
    html: `
      <p>Dear <b>${company}</b> Team,</p>
      <p>Your <b>${plan.toUpperCase()}</b> plan expires on:</p>
      <p><b>${new Date(expiresAt).toDateString()}</b></p>
      <p>Please renew to avoid service interruption.</p>
    `,
  }),

  subscriptionExpired: (company, plan, expiredAt) => ({
    subject: "🔴 PROMEET Subscription Expired",
    html: `
      <p>Dear <b>${company}</b> Team,</p>
      <p>Your <b>${plan.toUpperCase()}</b> subscription expired on:</p>
      <p><b>${new Date(expiredAt).toDateString()}</b></p>
      <p>Please renew to regain access.</p>
    `,
  }),
};

/* ======================================================
   MAIN BILLING CRON
====================================================== */
async function repairBilling() {
  console.log("⏳ CRON: Billing repair started");

  const [companies] = await db.query(`
    SELECT
      c.id,
      c.name,
      c.plan,
      c.zoho_customer_id,
      c.last_payment_link_id,
      c.pending_upgrade_plan,
      c.subscription_ends_at,
      c.trial_ends_at,
      c.subscription_status,
      (
        SELECT u.email
        FROM users u
        WHERE u.company_id = c.id
        ORDER BY u.id ASC
        LIMIT 1
      ) AS company_email
    FROM companies c
    WHERE
      c.zoho_customer_id IS NOT NULL
      AND c.last_payment_link_id IS NOT NULL
      AND (
        c.subscription_status IN ('pending','trial')
        OR c.pending_upgrade_plan IS NOT NULL
        OR (
          c.subscription_status = 'active'
          AND (
            (c.plan = 'trial' AND c.trial_ends_at IS NULL)
            OR
            (c.plan = 'business' AND c.subscription_ends_at IS NULL)
          )
        )
      )
  `);

  if (!companies.length) {
    console.log("✅ No companies require billing repair");
    return;
  }

  const token = await getZohoAccessToken();
  if (!token) {
    console.error("❌ Zoho access token missing");
    return;
  }

  for (const company of companies) {
    const {
      id,
      name,
      plan,
      last_payment_link_id,
      pending_upgrade_plan,
      company_email,
    } = company;

    try {
      console.log(`🏢 Processing ${name}`);

      const { data } = await axios.get(
        `https://www.zohoapis.in/billing/v1/paymentlinks/${last_payment_link_id}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );

      const payment = data?.payment_link;
      if (!payment) continue;

      const status = normalizeStatus(payment.status);
      console.log("💳 Zoho payment status:", status);

      /* ================= PAYMENT SUCCESS ================= */
      if (status === "paid") {
        const paidAt =
          payment.paid_at ||
          payment.updated_time ||
          payment.created_time ||
          new Date().toISOString();

        const paidDate = new Date(paidAt);
        const mysqlPaid = paidDate.toISOString().slice(0, 19).replace("T", " ");

        const activePlan = pending_upgrade_plan || plan;
        const durationDays = activePlan === "business" ? 30 : 15;

        const endDate = new Date(paidDate.getTime() + durationDays * 86400000);
        const mysqlEnd = endDate.toISOString().slice(0, 19).replace("T", " ");

        await db.query(
          `
          UPDATE companies
          SET
            subscription_status = 'active',
            plan = ?,
            pending_upgrade_plan = NULL,
            last_payment_created_at = ?,
            ${activePlan === "business" ? "subscription_ends_at" : "trial_ends_at"} = ?,
            updated_at = NOW()
          WHERE id = ?
        `,
          [activePlan, mysqlPaid, mysqlEnd, id]
        );

        if (company_email) {
          const mail = pending_upgrade_plan
            ? emailTemplates.upgradeCompleted(name, plan, activePlan, mysqlEnd)
            : emailTemplates.subscriptionActivated(name, activePlan, mysqlEnd);

          await sendEmail(company_email, mail.subject, mail.html);
        }

        continue;
      }

      /* ================= FAILED / EXPIRED ================= */
      if (status === "expired" || status === "failed") {
        await db.query(
          `
          UPDATE companies
          SET
            pending_upgrade_plan = NULL,
            subscription_status = 'pending',
            updated_at = NOW()
          WHERE id = ?
        `,
          [id]
        );
      }
    } catch (err) {
      console.error(`❌ Billing cron error for ${name}:`, err.message);
    }
  }

  await checkExpiringSubscriptions();
  console.log("✅ Billing cron completed");
}

/* ======================================================
   EXPIRY CHECKS
====================================================== */
async function checkExpiringSubscriptions() {
  const now = new Date();
  const warnDate = new Date(now.getTime() + 3 * 86400000);
  const mysqlWarn = warnDate.toISOString().slice(0, 19).replace("T", " ");

  /* ================= EXPIRING SOON ================= */
  const [expiring] = await db.query(
    `
    SELECT
      c.id,
      c.name,
      c.plan,
      c.subscription_ends_at,
      c.trial_ends_at,
      (
        SELECT u.email
        FROM users u
        WHERE u.company_id = c.id
        LIMIT 1
      ) AS company_email
    FROM companies c
    WHERE c.subscription_status = 'active'
    AND (
      (c.plan='business' AND c.subscription_ends_at BETWEEN NOW() AND ?)
      OR
      (c.plan='trial' AND c.trial_ends_at BETWEEN NOW() AND ?)
    )
  `,
    [mysqlWarn, mysqlWarn]
  );

  for (const c of expiring) {
    if (!c.company_email) continue;

    const expiresAt =
      c.plan === "business" ? c.subscription_ends_at : c.trial_ends_at;

    const daysLeft = Math.ceil((new Date(expiresAt) - now) / 86400000);

    const mail = emailTemplates.subscriptionExpiring(
      c.name,
      c.plan,
      expiresAt,
      daysLeft
    );

    await sendEmail(c.company_email, mail.subject, mail.html);
  }

  /* ================= EXPIRED ================= */
  const [expired] = await db.query(`
    SELECT
      c.id,
      c.name,
      c.plan,
      c.subscription_ends_at,
      c.trial_ends_at,
      (
        SELECT u.email
        FROM users u
        WHERE u.company_id = c.id
        LIMIT 1
      ) AS company_email
    FROM companies c
    WHERE c.subscription_status = 'active'
    AND (
      (c.plan='business' AND c.subscription_ends_at < NOW())
      OR
      (c.plan='trial' AND c.trial_ends_at < NOW())
    )
  `);

  for (const c of expired) {
    const expiredAt =
      c.plan === "business" ? c.subscription_ends_at : c.trial_ends_at;

    await db.query(
      `UPDATE companies SET subscription_status='expired', updated_at=NOW() WHERE id=?`,
      [c.id]
    );

    if (c.company_email) {
      const mail = emailTemplates.subscriptionExpired(
        c.name,
        c.plan,
        expiredAt
      );
      await sendEmail(c.company_email, mail.subject, mail.html);
    }
  }
}

/* ======================================================
   CRON SCHEDULE
====================================================== */
cron.schedule("*/3 * * * *", repairBilling);

/* ======================================================
   MANUAL TRIGGER (POSTMAN)
====================================================== */
router.get("/run", async (req, res) => {
  await repairBilling();
  res.json({ success: true, message: "Billing cron executed manually" });
});

export default router;

