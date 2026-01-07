import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

const WEBHOOK_KEY = "PROMEET_SUPER_SECRET";

/* =====================================================
   ZOHO PAYMENT PUSH WEBHOOK
===================================================== */
router.post("/push", async (req, res) => {
  try {
    console.log("📩 Incoming Zoho Push Payload:", req.body);
    console.log("📦 typeof req.body:", typeof req.body);

    /* ================================
       SECURITY CHECK
    ================================= */
    const incomingKey = req.headers["x-webhook-key"];
    if (!incomingKey || incomingKey !== WEBHOOK_KEY) {
      console.log("🚫 Unauthorized webhook access");
      return res.status(401).json({ success: false });
    }

    let event_type =
      (req.body?.event_type || req.body?.eventType || "").toLowerCase();

    let customerStr = req.body?.customer || "";
    let paymentStr = req.body?.payment || "";

    // if Zoho sent full raw string body
    if (typeof req.body === "string") {
      customerStr = req.body;
      paymentStr = req.body;
    }

    /* ================================
       EXTRACT CUSTOMER ID (Guaranteed)
    ================================= */
    let customerId = null;

    // 1️⃣ direct JSON parse attempt
    try {
      if (typeof customerStr === "string") {
        const parsed = JSON.parse(customerStr);
        customerId = parsed?.customer_id || null;
      } else if (typeof customerStr === "object") {
        customerId = customerStr?.customer_id || null;
      }
    } catch {}

    // 2️⃣ Regex fallback (works even if JSON.parse fails)
    if (!customerId) {
      const raw = JSON.stringify(req.body);
      const match = raw.match(/customer_id["']?\s*[:=]\s*["']?(\d{6,})/);
      if (match) customerId = match[1];
    }

    console.log("🧾 Final Extracted Customer ID:", customerId);

    if (!customerId) {
      console.log("❌ Customer ID missing — stopping");
      return res.status(400).json({ success: false, message: "customer_id missing" });
    }

    /* ================================
       PAYMENT STATUS
    ================================= */
    let paymentStatus = null;

    try {
      if (typeof paymentStr === "string") {
        const parsed = JSON.parse(paymentStr);
        paymentStatus =
          parsed?.payment_status?.toLowerCase() ||
          parsed?.status?.toLowerCase() ||
          null;
      }
    } catch {}

    console.log("💳 Payment Status:", paymentStatus);
    console.log("📢 Event:", event_type);

    /* ================================
       FETCH COMPANY
    ================================= */
    const [[company]] = await db.query(
      `SELECT id, plan FROM companies WHERE zoho_customer_id=? LIMIT 1`,
      [customerId]
    );

    if (!company) {
      console.log("❌ Company not found → ignoring");
      return res.json({ success: true });
    }

    const plan = (company.plan || "trial").toLowerCase();
    console.log("🏷 PLAN:", plan);

    /* ================================
       SUCCESS → ACTIVATE
    ================================= */
    if (
      event_type === "payment_success" ||
      paymentStatus === "paid" ||
      paymentStatus === "success"
    ) {
      console.log("🎯 PAYMENT SUCCESS — Activating subscription...");

      const now = new Date();
      const nowSQL = now.toISOString().slice(0, 19).replace("T", " ");

      const days = plan === "trial" ? 15 : 30;

      const end = new Date(now.getTime() + days * 86400000);
      const endSQL = end.toISOString().slice(0, 19).replace("T", " ");

      if (plan === "trial") {
        await db.query(
          `
          UPDATE companies
          SET 
            subscription_status='active',
            trial_ends_at=?,
            last_payment_created_at=?,
            updated_at=NOW()
          WHERE id=?
        `,
          [endSQL, nowSQL, company.id]
        );
      } else {
        await db.query(
          `
          UPDATE companies
          SET 
            subscription_status='active',
            subscription_ends_at=?,
            last_payment_created_at=?,
            updated_at=NOW()
          WHERE id=?
        `,
          [endSQL, nowSQL, company.id]
        );
      }

      console.log("🎉 Subscription Activated Successfully");
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("❌ ZOHO PUSH ERROR", err);
    res.status(500).json({ success: false });
  }
});

export default router;
