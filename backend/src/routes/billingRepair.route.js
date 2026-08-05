import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * Real-Time Billing Repair
 * -----------------------------------
 * Fixes:
 *  - pending companies
 *  - missing subscription info
 *  - missing trial end
 *  - payment completed but not updated
 */
router.get("/run", async (req, res) => {
  try {
    console.log("🛠 Running REALTIME Billing Repair...");

    const [companies] = await db.query(`
      SELECT 
        id,
        name,
        subscription_status,
        plan,
        zoho_customer_id
      FROM companies
      WHERE zoho_customer_id IS NOT NULL
    `);

    console.log(`📦 Companies to verify → ${companies.length}`);

    if (!companies.length)
      return res.json({ success: true, message: "No companies found" });

    let fixed = 0;
    let client = await zohoClient();

    for (const c of companies) {
      console.log("\n--------------------------------");
      console.log(`🏢 Checking Company → ${c.name} (${c.id})`);

      const customerId = c.zoho_customer_id;
      if (!customerId) {
        console.log("❌ No Zoho Customer — Skipping");
        continue;
      }

      /* ========================
         1️⃣ GET PAYMENT LINKS
      ========================= */
      let paymentLinks = [];
      try {
        const { data } = await client.get(
          `/paymentlinks?customer_id=${customerId}`
        );
        paymentLinks = data.payment_links || [];
      } catch (e) {
        if (e?.response?.status === 401) {
          console.warn("🔄 Refreshing Token...");
          client = await zohoClient();
          const { data } = await client.get(
            `/paymentlinks?customer_id=${customerId}`
          );
          paymentLinks = data.payment_links || [];
        }
      }

      const latestLink = paymentLinks[0];

      let paid = false;

      if (latestLink) {
        console.log("💳 Payment Link Found:", latestLink.status);
        if (
          ["paid", "success", "collected"].includes(
            latestLink.status.toLowerCase()
          )
        ) {
          paid = true;
        }
      } else {
        console.log("⚠️ No payment links found");
      }

      /* ========================
         2️⃣ GET SUBSCRIPTIONS
      ========================= */
      let subscription = null;

      try {
        const { data } = await client.get(
          `/subscriptions?customer_id=${customerId}`
        );

        subscription = (data.subscriptions || [])[0] || null;
      } catch (err) {
        console.log("❌ Subscription Fetch Failed");
      }

      let status = c.subscription_status;
      let plan = c.plan;

      let trialEnds = null;
      let subEnds = null;
      let subId = null;

      if (subscription) {
        subId = subscription.subscription_id || null;
        const s = (subscription.status || "").toLowerCase();

        console.log("📜 Subscription Status →", s);

        if (s === "trial") {
          status = "trial";
          plan = "trial";
          trialEnds = subscription.trial_ends_at || null;
        }

        if (["live", "active"].includes(s)) {
          status = "active";
          plan = "business";
          subEnds = subscription.expires_at || null;
        }
      }

      // If payment success but no subscription, still activate
      if (paid && status !== "active") {
        status = "active";
        plan = "business";
      }

      /* ========================
         3️⃣ UPDATE DATABASE
      ========================= */
      // If this repair brings the company back to 'active', also clear grace
      // period state — otherwise a company repaired out of a stale grace
      // period would keep a stuck grace_period_ends_at and gracePeriodCron
      // would silently never pick it up again on its next expiry.
      const clearingGracePeriod = status === "active";

      await db.query(
        `
        UPDATE companies SET
          subscription_status = ?,
          plan = ?,
          zoho_subscription_id = ?,
          trial_ends_at = ?,
          subscription_ends_at = ?,
          last_payment_link = ?,
          last_payment_link_id = ?,
          last_payment_created_at = ?,
          grace_period_ends_at = IF(?, NULL, grace_period_ends_at),
          grace_period_day = IF(?, 0, grace_period_day),
          expired_reminder_last_sent_at = IF(?, NULL, expired_reminder_last_sent_at),
          updated_at = NOW()
        WHERE zoho_customer_id = ?
      `,
        [
          status,
          plan,
          subId,
          trialEnds,
          subEnds,
          latestLink?.url || null,
          latestLink?.payment_link_id || null,
          latestLink?.created_time || null,
          clearingGracePeriod,
          clearingGracePeriod,
          clearingGracePeriod,
          customerId
        ]
      );

      console.log("✅ DB UPDATED");
      fixed++;
    }

    res.json({
      success: true,
      message: "Realtime Billing Repair Executed",
      checked: companies.length,
      updated: fixed
    });

  } catch (err) {
    console.error("❌ BILLING REPAIR FAILED", err);
    res.status(500).json({
      success: false,
      message: "Billing repair failed",
      error: err.message
    });
  }
});

export default router;
