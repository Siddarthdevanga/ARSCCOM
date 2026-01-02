import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY || "PROMEET_SUPER_SECRET";

const normalizeStatus = (status) => {
  if (!status) return null;
  status = status.toLowerCase();

  if (["paid", "success", "successful"].includes(status)) return "active";
  if (["failed", "cancelled", "canceled", "expired"].includes(status)) return "failed";

  return null;
};

router.post("/push", async (req, res) => {
  try {
    const key =
      req.headers["x-webhook-key"] ||
      req.headers["x_zoho_webhook_key"] ||
      req.headers["zoho-webhook-key"];

    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ Invalid webhook key");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const body = req.body || {};
    const payment = body.payment || {};
    const customer = body.customer || {};

    const zohoCustomerId =
      customer.customer_id ||
      payment.customer_id ||
      null;

    if (!zohoCustomerId) {
      console.log("❌ Missing customer_id in webhook push");
      return res.json({ message: "customer id missing" });
    }

    const newStatus =
      normalizeStatus(payment.payment_status) ||
      normalizeStatus(payment.status);

    if (!newStatus) {
      console.log("⚠️ Unknown payment status →", payment.status);
      return res.json({ message: "ignored unknown state" });
    }

    console.log(`📩 Payment Push Received → ${zohoCustomerId} | ${newStatus}`);

    const [result] = await db.query(
      `
      UPDATE companies SET
        subscription_status = ?,
        plan = CASE WHEN ? = 'active' THEN 'business' ELSE plan END,
        updated_at = NOW()
      WHERE zoho_customer_id = ?
      `,
      [newStatus, newStatus, zohoCustomerId]
    );

    if (!result.affectedRows) {
      console.log("❌ Company not found for zoho push");
      return res.json({ message: "company not found" });
    }

    console.log("✅ Subscription Updated From Zoho Push");
    return res.json({ message: "received" });

  } catch (err) {
    console.error("❌ PUSH ERROR", err);
    res.status(500).json({ message: "Failed" });
  }
});

export default router;
