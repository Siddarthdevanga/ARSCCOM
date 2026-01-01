import express from "express";
import cron from "node-cron";
import axios from "axios";
import { db } from "../config/db.js";
import { getZohoAccessToken } from "../services/zohoToken.service.js";

const router = express.Router();

/**
 * Normalize Zoho payment / sub status
 */
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

/**
 * MAIN CRON JOB — runs every 3 mins
 */
async function repairBilling() {
  console.log("⏳ CRON: Checking pending subscription companies...");

  const [companies] = await db.query(
    `
      SELECT id, name, zoho_customer_id, last_payment_link_id 
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
    const { id, name, zoho_customer_id, last_payment_link_id } = company;

    console.log(`\n🏢 Checking Company → ${name} (${id})`);

    if (!last_payment_link_id) {
      console.log("⚠ No payment link ID → skip");
      continue;
    }

    try {
      /**
       * 1️⃣ CHECK PAYMENT LINK STATUS
       */
      const payRes = await axios.get(
        `https://www.zohoapis.in/billing/v1/paymentlinks/${last_payment_link_id}`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` }
        }
      );

      const payment = payRes?.data?.payment_link;
      if (!payment) {
        console.log("⚠ Payment record not found in Zoho");
        continue;
      }

      const status = normalizeStatus(payment.status);
      console.log("🔍 Zoho Payment Status:", status);

      /**
       * 2️⃣ IF PAID — ACTIVATE + FETCH SUBSCRIPTION
       */
      if (status === "paid") {
        console.log("🎯 Payment Success — Fetch Subscription");

        const subRes = await axios.get(
          `https://www.zohoapis.in/billing/v1/subscriptions?customer_id=${zoho_customer_id}`,
          {
            headers: { Authorization: `Zoho-oauthtoken ${token}` }
          }
        );

        const sub = subRes?.data?.subscriptions?.[0];

        if (!sub) {
          console.log("⚠ Paid but NO active subscription in Zoho → activating basic");

          await db.query(
            `
              UPDATE companies
              SET subscription_status='active',
                  plan='business',
                  updated_at = NOW()
              WHERE id=?
            `,
            [id]
          );

          continue;
        }

        const subscriptionId = sub.subscription_id;
        const expiry =
          sub.expires_at || sub.current_term_ends_at || null;

        console.log("📌 Subscription ID:", subscriptionId);
        console.log("📅 Expiry:", expiry);

        await db.query(
          `
            UPDATE companies
            SET 
              subscription_status='active',
              plan='business',
              zoho_subscription_id=?,
              subscription_ends_at=?,
              updated_at = NOW()
            WHERE id=?
          `,
          [subscriptionId, expiry, id]
        );

        console.log("🎉 USER ACTIVATED WITH SUBSCRIPTION");
        continue;
      }

      /**
       * 3️⃣ EXPIRED — MARK FAILED
       */
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
      console.error("❌ CRON ERROR FOR COMPANY", name, err?.response?.data || err);
    }
  }

  console.log("\n✅ CRON Billing Repair Completed\n");
}

/**
 * RUN CRON — Every 3 mins
 */
cron.schedule("*/3 * * * *", () => {
  repairBilling();
});

/**
 * Manual Trigger (for testing in Postman)
 */
router.get("/run", async (req, res) => {
  await repairBilling();
  res.json({ success: true, message: "Billing cron executed manually" });
});

export default router;
