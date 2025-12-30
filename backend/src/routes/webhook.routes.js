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
This email was automatically sent from the PROMEET Billing Platform.
If you did not perform this action, please contact your administrator.
</p>`;

/* ======================================================
   STATUS NORMALIZER
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
   IDEMPOTENCY HELPER
====================================================== */
async function isAlreadyProcessed(eventId) {
  if (!eventId) return false;

  const [rows] = await db.query(
    `SELECT id FROM webhook_events WHERE event_id = ? LIMIT 1`,
    [eventId]
  );

  if (rows.length) return true;

  await db.query(
    `INSERT INTO webhook_events (event_id, created_at) VALUES (?, NOW())`,
    [eventId]
  );

  return false;
}

/* ======================================================
   WEBHOOK
====================================================== */
router.post("/", async (req, res) => {
  try {
    /* ---------- SECURITY ---------- */
    const key =
      req.headers["x-webhook-key"] ||
      req.headers["x_zoho_webhook_key"] ||
      req.headers["zoho-webhook-key"] ||
      null;

    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ INVALID WEBHOOK KEY");
      return res.status(401).json({ message: "Unauthorized webhook" });
    }

    const event = req.body?.event_type || req.body?.event || "unknown";
    const payload = req.body?.data || req.body;

    if (!payload) return res.status(400).json({ message: "Invalid payload" });

    const eventId =
      req.body?.event_id ||
      payload?.payment?.payment_id ||
      payload?.subscription?.subscription_id ||
      null;

    if (await isAlreadyProcessed(eventId)) {
      console.log("♻️ Duplicate webhook ignored:", eventId);
      return res.json({ message: "duplicate ignored" });
    }

    console.log("🔔 ZOHO EVENT RECEIVED:", event);

    /* ======================================================
       1️⃣ PAYMENT SUCCESS
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
        console.log("❌ Missing customer id in payment webhook");
        return res.json({ message: "ignored" });
      }

      console.log("💰 PAYMENT SUCCESS FOR:", zohoCustomerId);

      await db.query(
        `
        UPDATE companies
        SET 
          subscription_status='active',
          plan='business',
          updated_at = NOW()
        WHERE zoho_customer_id=?
        `,
        [zohoCustomerId]
      );

      return res.json({ message: "Payment processed" });
    }

    /* ======================================================
       2️⃣ SUBSCRIPTION EVENTS
    ======================================================= */
    const subscription = payload.subscription || {};
    const customer = payload.customer || subscription.customer || {};

    const zohoCustomerId =
      customer.customer_id ||
      subscription.customer_id ||
      null;

    if (!zohoCustomerId) {
      console.log("❌ No customer id");
      return res.status(400).json({ message: "No customer id" });
    }

    const subId = subscription.subscription_id || null;
    const receivedStatus =
      subscription.status ||
      subscription.subscription_status ||
      null;

    const newStatus = mapStatus(receivedStatus);

    if (!newStatus) {
      console.log("⚠️ Unknown status:", receivedStatus);
      return res.json({ message: "ignored unknown status" });
    }

    const [[company]] = await db.query(
      `SELECT id, subscription_status FROM companies WHERE zoho_customer_id=? LIMIT 1`,
      [zohoCustomerId]
    );

    if (!company) {
      console.log("❌ Company not found");
      return res.json({ message: "company not found" });
    }

    await db.query(
      `
      UPDATE companies SET
        subscription_status=?,
        zoho_subscription_id=?,
        plan = CASE 
          WHEN ? = 'trial' THEN 'trial'
          WHEN ? = 'active' THEN 'business'
          ELSE plan
        END,
        updated_at = NOW()
      WHERE zoho_customer_id=?
      `,
      [newStatus, subId, newStatus, newStatus, zohoCustomerId]
    );

    console.log("✅ COMPANY STATUS UPDATED:", newStatus, "SUB:", subId);

    return res.json({ message: "Subscription processed" });

  } catch (err) {
    console.error("❌ WEBHOOK ERROR", err);
    res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
