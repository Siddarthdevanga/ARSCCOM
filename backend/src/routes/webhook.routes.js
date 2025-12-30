import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* ======================================================
   ENV KEY (Make sure ZOHO_WEBHOOK_KEY exists)
====================================================== */
const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY;

console.log("🔐 Webhook Loaded — Expecting Key:", WEBHOOK_KEY);

/* ======================================================
   STATUS NORMALIZER
====================================================== */
function normalizeStatus(status) {
  if (!status) return null;
  status = status.toLowerCase();

  const map = {
    trial: "trial",
    live: "active",
    active: "active",
    success: "active",
    paid: "active",
    generated: "pending",
    pending: "pending",
    expired: "expired",
    cancelled: "cancelled",
    canceled: "cancelled"
  };

  return map[status] || null;
}

/* ======================================================
   IDEMPOTENCY
====================================================== */
async function isDuplicate(eventId) {
  if (!eventId) return false;

  const [rows] = await db.query(
    `SELECT id FROM webhook_events WHERE event_id=? LIMIT 1`,
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
    const receivedKey =
      req.headers["x-webhook-key"] ||
      req.headers["x_zoho_webhook_key"] ||
      req.headers["zoho-webhook-key"] ||
      null;

    console.log("🔐 WEBHOOK KEY RECEIVED:", receivedKey);

    if (!WEBHOOK_KEY) {
      console.log("❌ ENV ZOHO_WEBHOOK_KEY NOT SET");
      return res.status(500).json({ message: "Server key not configured" });
    }

    if (!receivedKey || receivedKey !== WEBHOOK_KEY) {
      console.log("❌ INVALID WEBHOOK KEY");
      return res.status(401).json({ message: "Invalid webhook key" });
    }

    const body = req.body || {};
    const event = body.event_type || body.event || "unknown";
    const payload = body.data || body || {};

    console.log("🔔 ZOHO WEBHOOK EVENT:", event);

    /* ---------- IDEMPOTENCY ---------- */
    const eventId =
      body.event_id ||
      payload?.payment?.payment_id ||
      payload?.subscription?.subscription_id ||
      payload?.transaction_id ||
      Date.now().toString();

    if (await isDuplicate(eventId)) {
      console.log("♻️ Duplicate webhook ignored:", eventId);
      return res.json({ message: "duplicate ignored" });
    }

    /* ======================================================
       1️⃣ PAYMENT SUCCESS HANDLER
    ======================================================= */
    if (
      event.includes("payment") ||
      event.includes("payment_collected") ||
      event.includes("payment_succeeded")
    ) {
      const payment = payload.payment || payload;
      const customer = payload.customer || {};

      const zohoCustomerId =
        customer.customer_id || payment.customer_id || null;

      if (!zohoCustomerId) {
        console.log("❌ Payment webhook missing customer id");
        return res.json({ message: "missing customer id" });
      }

      const status =
        normalizeStatus(payment.payment_status) ||
        normalizeStatus(payment.status);

      console.log("💳 PAYMENT STATUS:", status);

      if (status !== "active") {
        console.log("⚠️ Payment not successful → ignored");
        return res.json({ message: "ignored unpaid" });
      }

      console.log("💰 PAYMENT SUCCESS — CUSTOMER:", zohoCustomerId);

      const [result] = await db.query(
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

      if (!result.affectedRows) {
        console.log("❌ Company not found for payment webhook");
        return res.json({ message: "company not found" });
      }

      console.log("🎉 SUBSCRIPTION ACTIVATED VIA PAYMENT");
      return res.json({ message: "payment processed" });
    }

    /* ======================================================
       2️⃣ SUBSCRIPTION EVENTS
    ======================================================= */
    const subscription = payload.subscription || {};
    const customer = payload.customer || subscription.customer || {};

    const zohoCustomerId =
      customer.customer_id || subscription.customer_id || null;

    if (!zohoCustomerId) {
      console.log("❌ Subscription webhook missing customer id");
      return res.status(400).json({ message: "customer id missing" });
    }

    const zohoSubId = subscription.subscription_id || null;

    const statusRaw =
      subscription.status ||
      subscription.subscription_status ||
      null;

    const newStatus = normalizeStatus(statusRaw);

    if (!newStatus) {
      console.log("⚠️ Unknown status →", statusRaw);
      return res.json({ message: "ignored unknown status" });
    }

    console.log("📢 SUBSCRIPTION STATUS:", newStatus);

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE zoho_customer_id=? LIMIT 1`,
      [zohoCustomerId]
    );

    if (!company) {
      console.log("❌ Company not found for subscription webhook");
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
      [newStatus, zohoSubId, newStatus, newStatus, zohoCustomerId]
    );

    console.log(`✅ DB UPDATED — STATUS: ${newStatus}`);
    return res.json({ message: "subscription processed" });

  } catch (err) {
    console.error("❌ WEBHOOK ERROR", err);
    res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
