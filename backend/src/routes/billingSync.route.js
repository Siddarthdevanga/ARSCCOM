import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* =====================================================
   SECURITY KEY (Zoho must send this header)
===================================================== */
const WEBHOOK_KEY = "PROMEET_SUPER_SECRET";

/* =====================================================
   ZOHO PAYMENT PUSH WEBHOOK
===================================================== */
router.post("/push", async (req, res) => {
  try {
    console.log("📩 Incoming Zoho Push Payload:", req.body);

    /* ================================
       SECURITY VALIDATION
    ================================= */
    const incomingKey = req.headers["x-webhook-key"];

    if (!incomingKey || incomingKey !== WEBHOOK_KEY) {
      console.log("🚫 Unauthorized webhook access");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const event_type = (req.body?.event_type || "").toLowerCase();

    /* ================================
       ZOHO ALWAYS SENDS STRING JSON
    ================================= */
    let payment = null;
    let customer = null;

    try {
      if (req.body?.payment) {
        payment = JSON.parse(req.body.payment);
      }
    } catch (e) {
      console.log("❌ Failed to parse payment JSON:", e?.message);
    }

    try {
      if (req.body?.customer) {
        customer = JSON.parse(req.body.customer);
      }
    } catch (e) {
      console.log("❌ Failed to parse customer JSON:", e?.message);
    }

    /* ================================
       FINAL CUSTOMER ID (GUARANTEED)
    ================================= */
    const customerId =
      customer?.customer_id ||
      req.body?.customer_id ||
      req.body?.customerId ||
      null;

    console.log("🧾 Final Extracted Customer ID:", customerId);

    if (!customerId) {
      console.log("❌ Customer ID missing — stopping");
      return res.status(400).json({ success: false, message: "customer_id missing" });
    }

    /* ================================
       PAYMENT STATUS
    ================================= */
    const paymentStatus =
      payment?.payment_status?.toLowerCase() ||
      payment?.status?.toLowerCase() ||
      req.body?.payment_status?.toLowerCase() ||
      null;

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

    /* ======================================================
       PAYMENT SUCCESS → ACTIVATE
    ====================================================== */
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

    /* ======================================================
       FAILED / EXPIRED (Optional Handling)
    ====================================================== */
    else if (
      paymentStatus === "failed" ||
      paymentStatus === "failure" ||
      paymentStatus === "expired"
    ) {
      console.log("❌ PAYMENT FAILED/EXPIRED — Marking pending");

      await db.query(
        `
        UPDATE companies
        SET subscription_status='pending',
            updated_at=NOW()
        WHERE id=?
      `,
        [company.id]
      );
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("❌ ZOHO PUSH ERROR", err);
    res.status(500).json({ success: false });
  }
});

export default router;
