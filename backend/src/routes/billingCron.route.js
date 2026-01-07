import express from "express";
import cron from "node-cron";
import axios from "axios";
import { db } from "../config/db.js";
import { getZohoAccessToken } from "../services/zohoToken.service.js";

const router = express.Router();

/* ================= STATUS NORMALIZER ================= */
function normalizeStatus(status) {
  if (!status) return null;
  status = status.toLowerCase();

  const map = {
    generated: "pending",
    created: "pending",
    initiated: "pending",
    success: "paid",
    paid: "paid",
    failure: "failed",
    failed: "failed",
    expired: "expired",
    cancelled: "expired",
    canceled: "expired"
  };

  return map[status] || status;
}

/* ================= MAIN CRON ================= */
async function repairBilling() {
  console.log("⏳ CRON: Checking pending subscription companies...");

  const [companies] = await db.query(
    `
      SELECT id, name, plan, zoho_customer_id, last_payment_link_id 
      FROM companies 
      WHERE subscription_status IN ('pending','trial') 
      AND zoho_customer_id IS NOT NULL
    `
  );

  if (!companies.length) {
    console.log("✅ No pending companies found");
    return;
  }

  const token = await getZohoAccessToken();
  if (!token) {
    console.log("❌ Zoho Token Missing");
    return;
  }

  for (const company of companies) {
    const { id, name, plan, zoho_customer_id, last_payment_link_id } = company;

    console.log(`\n🏢 Checking Company → ${name} (${id})`);

    if (!last_payment_link_id) {
      console.log("⚠ No payment link ID → skip");
      continue;
    }

    try {
      /* ========== 1️⃣ FETCH PAYMENT STATUS ========== */
      const payRes = await axios.get(
        `https://www.zohoapis.in/billing/v1/paymentlinks/${last_payment_link_id}`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` }
        }
      );

      const payment = payRes?.data?.payment_link;
      if (!payment) {
        console.log("⚠ Payment link not found");
        continue;
      }

      const status = normalizeStatus(payment.status);
      console.log("🔍 Zoho Payment Status:", status);

      /* =====================================================
         2️⃣ PAYMENT SUCCESS → ACTIVATE + APPLY VALIDITY RULE
         TRIAL → 15 days validity from paid date
         BUSINESS → 30 days validity from paid date
      ===================================================== */
      if (status === "paid") {
        console.log("🎯 Payment Success — Activating");

        // Last paid date priority:
        let paidAt =
          payment?.paid_at ||
          payment?.updated_time ||
          payment?.created_time ||
          new Date().toISOString();

        const paidDate = new Date(paidAt);
        if (isNaN(paidDate.getTime())) {
          console.log("⚠ Invalid paid date from Zoho — using NOW");
          paidAt = new Date();
        }

        let durationDays =
          plan === "business"
            ? 30
            : 15; // trial/free = 15, business = 30

        const endsAt = new Date(
          new Date(paidAt).getTime() + durationDays * 24 * 60 * 60 * 1000
        );

        console.log("💰 Paid At:", paidAt);
        console.log("📅 Ends At:", endsAt);

        if (plan === "business") {
          await db.query(
            `
              UPDATE companies
              SET 
                subscription_status='active',
                plan='business',
                last_paid_at=?,
                subscription_ends_at=?,
                updated_at = NOW()
              WHERE id=?
            `,
            [paidAt, endsAt, id]
          );
        } else {
          await db.query(
            `
              UPDATE companies
              SET 
                subscription_status='active',
                plan='trial',
                last_paid_at=?,
                trial_ends_at=?,
                updated_at = NOW()
              WHERE id=?
            `,
            [paidAt, endsAt, id]
          );
        }

        console.log("🎉 USER ACTIVATED WITH CORRECT VALIDITY");
        continue;
      }

      /* ========== 3️⃣ FAILED / EXPIRED ========== */
      if (status === "expired" || status === "failed") {
        console.log("❌ Payment expired/failed — marking pending");

        await db.query(
          `
            UPDATE companies 
            SET subscription_status='pending',
                updated_at = NOW()
            WHERE id=?
          `,
          [id]
        );

        continue;
      }

      console.log("⏳ Still Pending — will retry...");
    } catch (err) {
      console.error(
        "❌ CRON ERROR FOR COMPANY",
        name,
        err?.response?.data || err
      );
    }
  }

  console.log("\n✅ CRON Billing Repair Completed\n");
}

/* ================= SCHEDULE CRON ================= */
cron.schedule("*/3 * * * *", () => {
  repairBilling();
});

/* ================= MANUAL TRIGGER ================= */
router.get("/run", async (req, res) => {
  await repairBilling();
  res.json({ success: true, message: "Billing cron executed manually" });
});

export default router;
