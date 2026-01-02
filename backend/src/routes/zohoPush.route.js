import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY || "PROMEET_SUPER_SECRET";

router.post("/zoho/push", async (req, res) => {
  try {
    const key = req.headers["x-webhook-key"];

    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ Invalid webhook key");
      return res.status(401).json({ message: "Invalid webhook key" });
    }

    console.log("📩 Incoming Zoho Push Payload:", req.body);

    const body = req.body || {};
    const customerId =
      body?.customer?.customer_id ||
      body?.customer_id ||
      body?.payment?.customer_id ||
      null;

    if (!customerId) {
      console.log("❌ Customer ID missing");
      return res.status(400).json({ message: "customer id missing" });
    }

    const status =
      body?.payment?.payment_status?.toLowerCase() ||
      body?.payment?.status?.toLowerCase() ||
      null;

    if (!status) {
      return res.json({ message: "no status found" });
    }

    if (status !== "paid" && status !== "success") {
      console.log("⚠ Payment not successful");
      return res.json({ message: "ignored - not paid" });
    }

    console.log("🎉 PAYMENT SUCCESS FOR CUSTOMER:", customerId);

    const [result] = await db.query(
      `
      UPDATE companies
      SET subscription_status='active',
          plan='business',
          updated_at = NOW()
      WHERE zoho_customer_id=?
      `,
      [customerId]
    );

    if (!result.affectedRows) {
      console.log("❌ Company not found");
      return res.json({ message: "company not found" });
    }

    console.log("✅ Company subscription updated");
    res.json({ success: true, message: "payment processed" });

  } catch (err) {
    console.error("❌ PUSH ERROR", err);
    res.status(500).json({ message: "failed" });
  }
});

export default router;
