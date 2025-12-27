import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/**
 * SECURITY:
 * Zoho webhooks DO NOT send signature by default
 * So we protect using a SECRET TOKEN header
 *
 * Set in Zoho:
 * Custom Header:
 * Key = X-WEBHOOK-KEY
 * Value = your-secret
 */
const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY || "PROMEET_WEBHOOK_KEY";

router.post("/", async (req, res) => {
  try {
    // ================= SECURITY CHECK =================
    const key = req.headers["x-webhook-key"];

    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ Webhook rejected — invalid key");
      return res.status(401).json({ message: "Unauthorized webhook" });
    }

    const event = req.body?.event_type;
    const data = req.body?.data;

    if (!event || !data) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    console.log("🔔 ZOHO WEBHOOK:", event);

    const subscription = data?.subscription || null;
    const customer = data?.customer || null;

    let zohoSubId = subscription?.subscription_id || null;
    let zohoCustomerId = customer?.customer_id || subscription?.customer_id || null;

    /* ======================================================
           HANDLE EVENTS
    ====================================================== */

    // -----------------------------------
    // TRIAL STARTED
    // -----------------------------------
    if (
      event === "subscription_trial_started" ||
      subscription?.status === "trial"
    ) {
      await db.query(
        `
        UPDATE companies 
        SET 
          plan='trial',
          subscription_status='trial',
          zoho_subscription_id=?,
          zoho_customer_id=?
        WHERE zoho_customer_id=? OR email=? LIMIT 1
        `,
        [
          zohoSubId,
          zohoCustomerId,
          zohoCustomerId,
          customer?.email || ""
        ]
      );

      console.log("✅ Trial Activated");
      return res.json({ message: "Trial updated" });
    }

    // -----------------------------------
    // SUBSCRIPTION ACTIVATED / PAYMENT SUCCESS
    // -----------------------------------
    if (
      event === "subscription_activated" ||
      event === "payment_succeeded" ||
      subscription?.status === "active"
    ) {
      await db.query(
        `
        UPDATE companies 
        SET 
          subscription_status='active',
          plan='business',
          zoho_subscription_id=?,
          zoho_customer_id=?
        WHERE zoho_customer_id=? OR email=? LIMIT 1
        `,
        [
          zohoSubId,
          zohoCustomerId,
          zohoCustomerId,
          customer?.email || ""
        ]
      );

      console.log("✅ Subscription Activated");
      return res.json({ message: "Subscription activated" });
    }

    // -----------------------------------
    // SUBSCRIPTION CANCELLED
    // -----------------------------------
    if (
      event === "subscription_cancelled" ||
      subscription?.status === "cancelled"
    ) {
      await db.query(
        `
        UPDATE companies 
        SET 
          subscription_status='cancelled'
        WHERE zoho_subscription_id=? LIMIT 1
        `,
        [zohoSubId]
      );

      console.log("❌ Subscription Cancelled");
      return res.json({ message: "Subscription cancelled" });
    }

    console.log("ℹ️ Unhandled event:", event);
    res.json({ message: "No action taken" });

  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

export default router;
