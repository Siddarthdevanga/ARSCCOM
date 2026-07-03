import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* =====================================================
   CONSTANTS
===================================================== */
const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY;
if (!WEBHOOK_KEY) {
  console.error("❌ CRITICAL: ZOHO_WEBHOOK_KEY env var not set — all webhook push requests will be rejected");
}
const SUCCESS_EVENTS = ["payment_success", "subscription_activated"];
const SUCCESS_STATUSES = ["paid", "success", "completed"];

/* =====================================================
   PLAN DURATION HELPER
===================================================== */
function getPlanDuration(plan) {
  if (!plan) return 30;
  const p = plan.toLowerCase();
  if (p === "trial") return 15;
  return 30; // business & enterprise both get 30 days
}

/* =====================================================
   ZOHO PAYMENT PUSH WEBHOOK
   URL → /api/webhook/zoho/push
===================================================== */
router.post("/push", async (req, res) => {
  try {
    console.log("📩 ZOHO WEBHOOK RECEIVED");

    /* ================================
       SECURITY CHECK
    ================================= */
    const incomingKey = req.headers["x-webhook-key"];
    if (!incomingKey || incomingKey !== WEBHOOK_KEY) {
      console.warn("🚫 Invalid webhook key");
      return res.status(401).json({ success: false });
    }

    /* ================================
       NORMALIZE EVENT TYPE
    ================================= */
    const eventType =
      (req.body?.event_type || req.body?.eventType || "").toLowerCase();

    /* ================================
       EXTRACT CUSTOMER ID (ROBUST)
    ================================= */
    let customerId = null;

    const extractCustomerId = (source) => {
      if (!source) return null;

      if (typeof source === "string") {
        try {
          return JSON.parse(source)?.customer_id || null;
        } catch {
          const match = source.match(/customer_id["']?\s*[:=]\s*["']?(\d{6,})/);
          return match?.[1] || null;
        }
      }

      if (typeof source === "object") {
        return source.customer_id || null;
      }

      return null;
    };

    customerId =
      extractCustomerId(req.body?.customer) ||
      extractCustomerId(req.body) ||
      null;

    console.log("🧾 Customer ID:", customerId);

    if (!customerId) {
      console.error("❌ customer_id missing");
      return res.status(400).json({ success: false, message: "customer_id missing" });
    }

    /* ================================
       PAYMENT STATUS
    ================================= */
    let paymentStatus = null;

    try {
      const payment =
        typeof req.body?.payment === "string"
          ? JSON.parse(req.body.payment)
          : req.body?.payment;

      paymentStatus =
        payment?.payment_status?.toLowerCase() ||
        payment?.status?.toLowerCase() ||
        null;
    } catch {}

    console.log("💳 Payment Status:", paymentStatus);
    console.log("📢 Event Type:", eventType);

    /* ================================
       FETCH COMPANY
    ================================= */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        plan,
        subscription_status,
        pending_upgrade_plan
      FROM companies
      WHERE zoho_customer_id = ?
      LIMIT 1
      `,
      [customerId]
    );

    if (!company) {
      console.warn("⚠️ Company not found — ignoring webhook");
      return res.json({ success: true });
    }

    console.log("🏢 Company ID:", company.id);
    console.log("📋 Current Plan:", company.plan);
    console.log("📊 Current Status:", company.subscription_status);
    if (company.pending_upgrade_plan) {
      console.log("🔄 Pending Upgrade:", company.pending_upgrade_plan);
    }

    /* ================================
       PREVENT DOUBLE ACTIVATION
    ================================= */
    if (company.subscription_status === "active" && !company.pending_upgrade_plan) {
      console.log("🔁 Subscription already active and no pending upgrade — skipping");
      return res.json({ success: true });
    }

    /* ================================
       SUCCESS CHECK
    ================================= */
    const isSuccess =
      SUCCESS_EVENTS.includes(eventType) ||
      SUCCESS_STATUSES.includes(paymentStatus);

    if (!isSuccess) {
      console.log("ℹ️ Payment not successful — ignoring");
      return res.json({ success: true });
    }

    /* ================================
       DETERMINE PLAN TO ACTIVATE
       FIX: Preserve existing plan (especially enterprise)
    ================================= */
    const planToActivate = company.pending_upgrade_plan || company.plan || "trial";
    console.log("🎯 Plan to Activate:", planToActivate);

    /* ================================
       CALCULATE EXPIRY
       FIX: trial = 15 days, business & enterprise = 30 days
    ================================= */
    const now = new Date();
    const nowSQL = now.toISOString().slice(0, 19).replace("T", " ");
    const durationDays = getPlanDuration(planToActivate);
    const end = new Date(now.getTime() + durationDays * 86400000);
    const endSQL = end.toISOString().slice(0, 19).replace("T", " ");

    console.log("💰 Payment Date:", nowSQL);
    console.log("📅 Expires On:", endSQL);
    console.log("📆 Duration:", durationDays, "days");

    /* ================================
       ACTIVATE SUBSCRIPTION
    ================================= */
    console.log("✨ Activating subscription...");

    if (planToActivate.toLowerCase() === "trial") {
      // Trial — uses trial_ends_at
      await db.query(
        `UPDATE companies SET
          subscription_status = 'active',
          plan = 'trial',
          pending_upgrade_plan = NULL,
          trial_ends_at = ?,
          last_payment_created_at = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [endSQL, nowSQL, company.id]
      );
    } else {
      // FIX: Business AND Enterprise both use subscription_ends_at with 30 days
      await db.query(
        `UPDATE companies SET
          subscription_status = 'active',
          plan = ?,
          pending_upgrade_plan = NULL,
          subscription_ends_at = ?,
          last_payment_created_at = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [planToActivate, endSQL, nowSQL, company.id]
      );
    }

    if (company.pending_upgrade_plan) {
      console.log(`🎉 UPGRADE COMPLETED: ${company.plan} → ${planToActivate}`);
    } else {
      console.log("🎉 SUBSCRIPTION ACTIVATED:", planToActivate);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ ZOHO WEBHOOK ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
