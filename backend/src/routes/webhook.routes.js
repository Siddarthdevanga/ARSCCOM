import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY || "PROMEET_WEBHOOK_KEY";

/* =========================================
   HEADERS SUPPORTED (Zoho variants)
========================================= */
const HEADER_KEYS = [
  "x-webhook-key",
  "x_zoho_webhook_key",
  "zoho-webhook-key",
  "x-zoho-webhook-signature"
];

function getWebhookKey(req) {
  for (const k of HEADER_KEYS) {
    if (req.headers[k]) return req.headers[k];
  }

  // allow ?key=TEST only for temporary testing
  if (req.query?.key) return req.query.key;

  return null;
}

/* =========================================
   STATUS NORMALIZER
========================================= */
function normalizeStatus(status) {
  if (!status) return null;
  status = status.toLowerCase();

  const map = {
    trial: "trial",
    live: "active",
    active: "active",
    success: "active",
    succeeded: "active",
    paid: "active",
    completed: "active",
    generated: "pending",
    created: "pending",
    expired: "expired",
    cancelled: "cancelled",
    canceled: "cancelled",
    failed: "failed"
  };

  return map[status] || null;
}

/* =========================================
   IDEMPOTENCY
========================================= */
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

/* =========================================
   WEBHOOK ROUTE
========================================= */
router.post("/", async (req, res) => {
  try {
    /* -------- SECURITY -------- */
    const key = getWebhookKey(req);

    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ INVALID WEBHOOK KEY RECEIVED →", key);
      return res.status(401).json({ message: "Invalid webhook key" });
    }

    /* -------- RAW LOG -------- */
    console.log("📩 RAW ZOHO WEBHOOK ======================");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=========================================");

    const body = req.body || {};
    const event =
      body.event_type ||
      body.event ||
      body.action ||
      "unknown";

    const payload = body.data || body || {};

    console.log("🔔 ZOHO EVENT:", event);

    /* -------- IDEMPOTENCY -------- */
    const eventId =
      body.event_id ||
      payload?.payment?.payment_id ||
      payload?.subscription?.subscription_id ||
      payload?.transaction_id ||
      `${event}-${Date.now()}`;

    if (await isDuplicate(eventId)) {
      console.log("♻️ DUPLICATE IGNORED:", eventId);
      return res.json({ message: "duplicate ignored" });
    }

    /* ======================================================
       1️⃣ PAYMENT EVENTS (Payment Link Success)
    ======================================================= */
    if (
      event.includes("payment") ||
      event.includes("payment_collected") ||
      event.includes("payment_succeeded") ||
      event.includes("payment_link") ||
      event.includes("paid")
    ) {
      const payment = payload.payment || payload;
      const customer = payload.customer || {};

      const zohoCustomerId =
        customer.customer_id ||
        payment.customer_id ||
        null;

      if (!zohoCustomerId) {
        console.log("❌ PAYMENT → Missing customer id");
        return res.json({ message: "missing customer id" });
      }

      const status =
        normalizeStatus(payment.payment_status) ||
        normalizeStatus(payment.status) ||
        "active";

      if (status !== "active") {
        console.log("⚠️ PAYMENT NOT SUCCESS — Ignored");
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
        console.log("❌ PAYMENT → Company not found");
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
      customer.customer_id ||
      subscription.customer_id ||
      null;

    if (!zohoCustomerId) {
      console.log("❌ SUBSCRIPTION → missing customer id");
      return res.json({ message: "customer id missing" });
    }

    const zohoSubId = subscription.subscription_id || null;

    const statusRaw =
      subscription.status ||
      subscription.subscription_status ||
      null;

    const newStatus = normalizeStatus(statusRaw);

    if (!newStatus) {
      console.log("⚠️ UNKNOWN STATUS →", statusRaw);
      return res.json({ message: "ignored unknown status" });
    }

    console.log("📢 SUBSCRIPTION STATUS CHANGE →", newStatus);

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE zoho_customer_id=? LIMIT 1`,
      [zohoCustomerId]
    );

    if (!company) {
      console.log("❌ SUBSCRIPTION → company not found");
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

    console.log(`✅ DB UPDATED → ${newStatus}`);

    return res.json({ message: "subscription processed" });

  } catch (err) {
    console.error("❌ WEBHOOK ERROR", err);
    res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
