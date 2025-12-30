import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY;

/**
 * Extract Zoho Customer ID safely from ANY payload format
 */
function extractCustomerId(body) {
  return (
    body?.data?.customer?.customer_id ||
    body?.data?.subscription?.customer_id ||
    body?.data?.payment?.customer_id ||
    body?.customer?.customer_id ||
    body?.customer_id ||
    body?.subscription?.customer_id ||
    body?.payment?.customer_id ||
    body?.entity_customer_id || // some events use entity_
    body?.entity_id ||           // fallback
    null
  );
}

/**
 * Extract Zoho Subscription ID
 */
function extractSubscriptionId(body) {
  return (
    body?.data?.subscription?.subscription_id ||
    body?.subscription?.subscription_id ||
    body?.subscription_id ||
    null
  );
}

/**
 * Normalize Zoho payment / subscription status
 */
function normalizeStatus(status) {
  if (!status) return null;
  status = status.toLowerCase();

  const map = {
    success: "active",
    paid: "active",
    active: "active",
    live: "active",
    trial: "trial",
    created: "trial",
    generated: "pending",
    expired: "expired",
    cancelled: "cancelled",
    canceled: "cancelled",
    failed: "failed"
  };

  return map[status] || status;
}

router.post("/", async (req, res) => {
  try {
    /* ---------- SECURITY ---------- */
    const key =
      req.headers["x-webhook-key"] ||
      req.headers["x_zoho_webhook_key"] ||
      req.headers["zoho-webhook-key"];

    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ INVALID WEBHOOK KEY RECEIVED");
      return res.status(401).json({ message: "Invalid webhook key" });
    }

    console.log("🔥 ZOHO WEBHOOK HIT");
    console.log("📩 FULL PAYLOAD ===============");
    console.dir(req.body, { depth: 10 });
    console.log("================================");

    const body = req.body || {};
    const event = body.event_type || body.event || "unknown";

    console.log("🔔 EVENT:", event);

    /* ---------- Extract IDs ---------- */
    const customerId = extractCustomerId(body);
    const subscriptionId = extractSubscriptionId(body);

    console.log("👤 Extracted Customer ID:", customerId);
    console.log("🧾 Extracted Subscription ID:", subscriptionId);

    if (!customerId) {
      console.log("❌ Customer ID missing in Zoho payload");
      return res.json({
        message: "Webhook received but customer id missing",
        debug: true
      });
    }

    /* ---------- Determine Status ---------- */
    const payment = body?.data?.payment || body?.payment || {};
    const subscription = body?.data?.subscription || body?.subscription || {};

    const statusRaw =
      payment.payment_status ||
      payment.status ||
      subscription.status ||
      subscription.subscription_status ||
      null;

    const status = normalizeStatus(statusRaw);

    console.log("🏷 RAW STATUS:", statusRaw);
    console.log("🏷 NORMALIZED STATUS:", status);

    /* ---------- DB UPDATE ---------- */
    if (!status) {
      console.log("⚠️ Unknown status - ignoring");
      return res.json({ message: "ignored unknown status" });
    }

    const mappedPlan =
      status === "active" ? "business" :
      status === "trial" ? "trial" :
      undefined;

    const [result] = await db.query(
      `
      UPDATE companies SET
        subscription_status=?,
        plan = COALESCE(?, plan),
        zoho_subscription_id = COALESCE(?, zoho_subscription_id),
        updated_at = NOW()
      WHERE zoho_customer_id=?
      `,
      [status, mappedPlan, subscriptionId, customerId]
    );

    if (!result.affectedRows) {
      console.log("❌ No company found for customer:", customerId);
      return res.json({ message: "company not found" });
    }

    console.log("✅ DATABASE UPDATED SUCCESSFULLY");

    return res.json({ success: true, status });

  } catch (err) {
    console.error("❌ WEBHOOK ERROR", err);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
