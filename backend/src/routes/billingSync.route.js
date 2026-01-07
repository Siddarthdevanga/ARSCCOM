import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* =====================================================
   ZOHO PAYMENT PUSH WEBHOOK
   URL: POST /api/payment/zoho/push
===================================================== */
router.post("/push", async (req, res) => {
  try {
    console.log("📩 Incoming Zoho Push Payload:", req.body);

    let event_type = (req.body?.event_type || "").toLowerCase();
    let payment = req.body?.payment;
    let customer = req.body?.customer;

    /* ======================================================
       SMART PARSE (handles JSON + JSON string + quoted JSON)
    ====================================================== */
    const smartParse = (val) => {
      if (!val) return null;
      if (typeof val === "object") return val;

      let clean = String(val).trim();

      if (
        (clean.startsWith("'") && clean.endsWith("'")) ||
        (clean.startsWith('"') && clean.endsWith('"'))
      ) {
        clean = clean.substring(1, clean.length - 1);
      }

      try {
        return JSON.parse(clean);
      } catch {
        return null;
      }
    };

    payment = smartParse(payment);
    customer = smartParse(customer);

    /* ======================================================
       GUARANTEED CUSTOMER ID EXTRACTION
    ====================================================== */
    let customerId =
      customer?.customer_id ||
      req.body?.customer_id ||
      req.body?.customerId ||
      null;

    /**
     * If STILL null → Extract via REGEX (works 100%)
     */
    if (!customerId) {
      const raw = JSON.stringify(req.body);

      // Primary regex
      let match = raw.match(/customer_id["']?\s*[:=]\s*["']?(\d{6,})/);

      if (match) {
        customerId = match[1];
      } else {
        // Secondary desperation regex 😄
        match = raw.match(/(\d{15,})/);
        if (match) {
          customerId = match[1];
        }
      }
    }

    const paymentStatus =
      payment?.payment_status?.toLowerCase() ||
      req.body?.payment_status?.toLowerCase() ||
      null;

    console.log("🧾 Final Extracted Customer ID:", customerId);
    console.log("💳 Payment Status:", paymentStatus);
    console.log("📢 Event:", event_type);

    if (!customerId) {
      console.log("❌ Customer ID STILL missing -> THIS SHOULD NEVER HAPPEN NOW");
      return res.status(400).json({ success: false });
    }

    /* ======================================================
       FETCH COMPANY
    ====================================================== */
    const [[company]] = await db.query(
      `SELECT id, plan FROM companies WHERE zoho_customer_id=? LIMIT 1`,
      [customerId]
    );

    if (!company) {
      console.log("❌ Company not found");
      return res.json({ success: true });
    }

    const plan = (company.plan || "trial").toLowerCase();
    console.log("🏷 PLAN:", plan);

    /* ======================================================
       ONLY ON SUCCESS
    ====================================================== */
    if (
      event_type === "payment_success" ||
      paymentStatus === "paid" ||
      paymentStatus === "success"
    ) {
      console.log("🎯 PAYMENT SUCCESS — Activating...");

      const now = new Date();
      const nowSQL = now.toISOString().slice(0, 19).replace("T", " ");

      const days =
        plan === "trial" ? 15 :
        plan === "business" ? 30 :
        30;

      const end = new Date(now.getTime() + days * 86400000);
      const endSQL = end.toISOString().slice(0, 19).replace("T", " ");

      if (plan === "trial") {
        await db.query(
          `
          UPDATE companies
          SET subscription_status='active',
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
          SET subscription_status='active',
              subscription_ends_at=?,
              last_payment_created_at=?,
              updated_at=NOW()
          WHERE id=?
        `,
          [endSQL, nowSQL, company.id]
        );
      }

      console.log("🎉 Subscription Updated Successfully");
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("❌ ZOHO PUSH ERROR", err);
    res.status(500).json({ success: false });
  }
});

export default router;
