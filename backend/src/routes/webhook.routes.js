import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY || "PROMEET_WEBHOOK_KEY";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://www.wheelbrand.in";

/* ======================================================
   EMAIL FOOTER
====================================================== */
const emailFooter = () => `
<br/>
Regards,<br/>
<b style="color:#6c2bd9">PROMEET</b><br/>
<img src="${APP_BASE_URL}/logo.png" height="55" />
<hr/>
<p style="font-size:13px;color:#666">
This email was automatically sent from the PROMEET Subscription & Billing System.
If you did not perform this action, please contact your administrator immediately.
</p>`;

/* ======================================================
   STATUS NORMALIZER (For Subscription Events)
====================================================== */
function mapStatus(status) {
  if (!status) return null;

  status = status.toLowerCase();

  const map = {
    trial: "trial",
    live: "active",
    active: "active",
    cancelled: "cancelled",
    canceled: "cancelled",
    expired: "expired",
  };

  return map[status] || null;
}

/* ======================================================
   ZOHO WEBHOOK HANDLER
====================================================== */
router.post("/", async (req, res) => {
  try {
    /* ================= SECURITY ================= */
    const key =
      req.headers["x-webhook-key"] ||
      req.headers["x_zoho_webhook_key"] ||
      null;

    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ INVALID WEBHOOK KEY");
      return res.status(401).json({ message: "Unauthorized webhook" });
    }

    const event = req.body?.event_type || req.body?.event || "unknown";
    const payload = req.body?.data || req.body;

    if (!payload) return res.status(400).json({ message: "Invalid payload" });

    console.log("🔔 ZOHO EVENT RECEIVED:", event);

    /* ======================================================
       CASE 1: PAYMENT LINK EVENTS (Payment Success Flow)
    ======================================================= */
    if (
      event.includes("payment") ||
      event.includes("payment_succeeded") ||
      event.includes("payment_collected")
    ) {
      const payment = payload.payment || payload;
      const customer = payload.customer || {};

      const zohoCustomerId =
        customer.customer_id || payment.customer_id || null;

      if (!zohoCustomerId) {
        console.log("❌ Payment webhook missing customer id");
        return res.json({ message: "ignored - no customer id" });
      }

      const email =
        customer.email ||
        payment.customer_email ||
        null;

      const companyName =
        customer.display_name ||
        customer.customer_name ||
        "Your Company";

      console.log("💰 Payment Success Webhook for Customer:", zohoCustomerId);

      // Update subscription active after payment success
      const [result] = await db.query(
        `
        UPDATE companies
        SET subscription_status='active',
            plan='business',
            updated_at = NOW()
        WHERE zoho_customer_id=?
        `,
        [zohoCustomerId]
      );

      if (result.affectedRows === 0) {
        console.log("❌ Company not found for payment webhook");
        return res.json({ message: "company not found" });
      }

      console.log("🎉 PAYMENT SUCCESS — SUBSCRIPTION ACTIVATED");

      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: "PROMEET Subscription Activated",
            html: `
<p>Hello,</p>
<p>Your payment was successful and 
<b style="color:#6c2bd9">${companyName}</b> subscription is now <b>ACTIVE</b>.</p>
<p>You now have full unrestricted access to PROMEET.</p>
${emailFooter()}`
          });
        } catch (mailErr) {
          console.error("📧 Email failed:", mailErr);
        }
      }

      return res.json({ message: "Payment processed successfully" });
    }

    /* ======================================================
       CASE 2: SUBSCRIPTION EVENTS (Zoho Subscription Plans)
    ======================================================= */
    const subscription = payload.subscription || {};
    const customer = payload.customer || subscription.customer || {};

    const zohoSubscriptionId =
      subscription.subscription_id || subscription.id || null;

    const zohoCustomerId =
      customer.customer_id ||
      subscription.customer_id ||
      null;

    if (!zohoCustomerId) {
      console.log("❌ Missing Zoho Customer ID");
      return res.status(400).json({ message: "No customer id" });
    }

    const email =
      customer.email ||
      subscription?.customer?.email ||
      null;

    const companyName =
      customer.display_name ||
      subscription?.customer?.display_name ||
      "Your Company";

    const receivedStatus =
      subscription.status ||
      subscription.subscription_status ||
      null;

    const newStatus = mapStatus(receivedStatus);

    if (!newStatus) {
      console.log("⚠️ Unknown / ignored subscription status:", receivedStatus);
      return res.json({ message: "Ignored - unknown subscription status" });
    }

    /* ================= FETCH COMPANY ================= */
    const [[company]] = await db.query(
      `SELECT id, subscription_status, plan 
       FROM companies 
       WHERE zoho_customer_id=? 
       LIMIT 1`,
      [zohoCustomerId]
    );

    if (!company) {
      console.log("❌ Company not found for subscription webhook!");
      return res.json({ message: "Company not found" });
    }

    const oldStatus = company.subscription_status;

    if (oldStatus === newStatus) {
      console.log(`ℹ️ No change (${oldStatus}) → ignoring`);
      return res.json({ message: "No change" });
    }

    /* ================= DB UPDATE ================= */
    await db.query(
      `
      UPDATE companies SET
        subscription_status=?,
        plan = CASE 
          WHEN ? = 'trial' THEN 'trial'
          WHEN ? = 'active' THEN 'business'
          ELSE plan
        END,
        zoho_subscription_id=IFNULL(?, zoho_subscription_id),
        updated_at = NOW()
      WHERE zoho_customer_id=?
      `,
      [newStatus, newStatus, newStatus, zohoSubscriptionId, zohoCustomerId]
    );

    console.log(`✅ STATUS UPDATED: ${oldStatus} → ${newStatus}`);

    /* EMAILS SAME AS BEFORE — kept as is */
    if (!email) {
      console.log("⚠️ No email found — skipping email send");
      return res.json({ message: "Processed without email" });
    }

    // async email send
    (async () => {
      try {
        if (newStatus === "trial") {
          await sendEmail({
            to: email,
            subject: "PROMEET Trial Subscription Activated",
            html: `
<p>Hello,</p>
<p>The trial subscription for 
<b style="color:#6c2bd9">${companyName}</b> is now active.</p>
${emailFooter()}`
          });
        }

        if (newStatus === "active") {
          await sendEmail({
            to: email,
            subject: "PROMEET Subscription Activated",
            html: `
<p>Hello,</p>
<p>The business subscription for 
<b style="color:#6c2bd9">${companyName}</b> is now active.</p>
${emailFooter()}`
          });
        }

        if (["cancelled", "expired"].includes(newStatus)) {
          await sendEmail({
            to: email,
            subject: "PROMEET Subscription Status Updated",
            html: `
<p>Hello,</p>
<p>Your subscription for 
<b style="color:#6c2bd9">${companyName}</b> is now <b>${newStatus}</b>.</p>
${emailFooter()}`
          });
        }
      } catch (mailErr) {
        console.error("📧 Email failed:", mailErr);
      }
    })();

    return res.json({ message: "Webhook processed successfully" });

  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
