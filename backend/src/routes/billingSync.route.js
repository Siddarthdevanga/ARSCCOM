import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* =====================================================
   ULTRA SAFE SMART PARSER
===================================================== */
const smartParse = (val) => {
  if (!val) return null;

  // Already JSON
  if (typeof val === "object") return val;

  let str = String(val).trim();

  // Remove wrapping quotes if present
  if (
    (str.startsWith("'") && str.endsWith("'")) ||
    (str.startsWith('"') && str.endsWith('"'))
  ) {
    str = str.substring(1, str.length - 1);
  }

  // Fix escaped JSON
  str = str.replace(/\\"/g, '"');

  try {
    return JSON.parse(str);
  } catch (e) {
    console.log("⚠ smartParse failed:", e?.message, "→", str);
    return null;
  }
};

/* =====================================================
   ZOHO PAYMENT PUSH WEBHOOK
===================================================== */
router.post("/push", async (req, res) => {
  try {
    console.log("📩 Incoming Zoho Push Payload:", req.body);

    const event_type = (req.body?.event_type || "").toLowerCase();

    let payment = smartParse(req.body?.payment);
    let customer = smartParse(req.body?.customer);

    /* ======================================================
       EXTRACT CUSTOMER ID (Guaranteed)
    ====================================================== */
    let customerId =
      customer?.customer_id ||
      req.body?.customer_id ||
      req.body?.customerId ||
      null;

    if (!customerId) {
      const raw = JSON.stringify(req.body);

      // Strict Zoho pattern
      let match = raw.match(/customer_id["']?\s*[:=]\s*["']?(\d{10,})/);
      if (match) customerId = match[1];

      // Last fallback
      if (!customerId) {
        match = raw.match(/(\d{15,})/);
        if (match) customerId = match[1];
      }
    }

    /* ======================================================
       PAYMENT STATUS
    ====================================================== */
    const paymentStatus =
      payment?.payment_status?.toLowerCase() ||
      req.body?.payment_status?.toLowerCase() ||
      null;

    console.log("🧾 Final Extracted Customer ID:", customerId);
    console.log("💳 Payment Status:", paymentStatus);
    console.log("📢 Event:", event_type);

    if (!customerId) {
      console.log("❌ Customer ID STILL missing — investigate payload!");
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
      console.log("❌ Company not found → ignoring");
      return res.json({ success: true });
    }

    const plan = (company.plan || "trial").toLowerCase();
    console.log("🏷 PLAN:", plan);

    /* ======================================================
       ONLY PROCESS SUCCESS
    ====================================================== */
    if (
      event_type === "payment_success" ||
      paymentStatus === "paid" ||
      paymentStatus === "success"
    ) {
      console.log("🎯 PAYMENT SUCCESS — Activating...");

      const now = new Date();
      const nowSQL = now.toISOString().slice(0, 19).replace("T", " ");

      const days = plan === "trial" ? 15 : 30;

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
