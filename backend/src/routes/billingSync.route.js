import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/**
 * =====================================================
 * ZOHO BILLING WEBHOOK HANDLER
 * Handles:
 *  payment_success
 *  subscription events
 * =====================================================
 */
router.post("/zoho/webhook", async (req, res) => {
  try {
    console.log("📩 Incoming Zoho Push Payload:", req.body);

    let { event_type, payment, customer } = req.body;

    // Normalize
    event_type = (event_type || "").toLowerCase();

    // 🔍 Zoho sometimes sends JSON as string → Parse safely
    if (typeof payment === "string") {
      try {
        payment = JSON.parse(payment);
      } catch {
        console.log("⚠ Failed to parse payment JSON string");
      }
    }

    if (typeof customer === "string") {
      try {
        customer = JSON.parse(customer);
      } catch {
        console.log("⚠ Failed to parse customer JSON string");
      }
    }

    // Extract Important Fields
    const customerId =
      customer?.customer_id ||
      req.body?.customer_id ||
      null;

    const paymentStatus =
      payment?.payment_status?.toLowerCase() ||
      req.body?.payment_status?.toLowerCase() ||
      null;

    if (!customerId) {
      console.log("❌ Customer ID missing");
      return res.status(400).json({ success: false });
    }

    console.log("🧾 Customer ID:", customerId);
    console.log("💳 Payment Status:", paymentStatus);
    console.log("📢 Event:", event_type);

    // ================= FETCH COMPANY =================
    const [[company]] = await db.query(
      `
      SELECT
        id,
        plan,
        subscription_status
      FROM companies
      WHERE zoho_customer_id = ?
      LIMIT 1
      `,
      [customerId]
    );

    if (!company) {
      console.log("❌ No matching company found");
      return res.json({ success: true });
    }

    const companyId = company.id;
    let plan = (company.plan || "trial").toLowerCase();

    // ================= ONLY ACT ON SUCCESS =================
    if (
      event_type === "payment_success" ||
      paymentStatus === "paid" ||
      paymentStatus === "success"
    ) {
      console.log("🎯 Payment success received");

      const paidDate = new Date();
      const mysqlPaidDate = paidDate.toISOString().slice(0, 19).replace("T", " ");

      let durationDays = 0;

      if (plan === "trial") durationDays = 15;
      else durationDays = 30; // business + enterprise

      const endsOn = new Date(
        paidDate.getTime() + durationDays * 24 * 60 * 60 * 1000
      );
      const mysqlEnds = endsOn.toISOString().slice(0, 19).replace("T", " ");

      console.log("💰 Paid At:", mysqlPaidDate);
      console.log("📅 Ends At:", mysqlEnds);

      if (plan === "trial") {
        await db.query(
          `
          UPDATE companies
          SET 
            subscription_status='active',
            plan='trial',
            last_payment_created_at=?,
            trial_ends_at=?,
            updated_at = NOW()
          WHERE id=?
        `,
          [mysqlPaidDate, mysqlEnds, companyId]
        );
      } else {
        await db.query(
          `
          UPDATE companies
          SET 
            subscription_status='active',
            plan='business', -- enterprise treated same validity
            last_payment_created_at=?,
            subscription_ends_at=?,
            updated_at = NOW()
          WHERE id=?
        `,
          [mysqlPaidDate, mysqlEnds, companyId]
        );
      }

      console.log("🎉 Subscription Activated & Validity Applied");
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ ZOHO WEBHOOK ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;

