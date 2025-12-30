import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * =====================================================
 *  BILLING SYNC REPAIR
 *  Use when webhook fails OR to sync past customers
 * =====================================================
 */
router.get("/run", async (req, res) => {
  try {
    console.log("🚀 Running Billing Sync Repair...");

    const [companies] = await db.query(`
      SELECT 
        id,
        name,
        zoho_customer_id,
        subscription_status,
        zoho_subscription_id,
        last_payment_link_id
      FROM companies
      WHERE 
        zoho_customer_id IS NOT NULL
        AND (subscription_status IS NULL 
          OR subscription_status IN ('pending','trial','unknown',''))
    `);

    if (!companies.length) {
      return res.json({
        success: true,
        message: "No pending companies to repair",
        companiesChecked: 0
      });
    }

    console.log(`🏢 Companies To Check: ${companies.length}`);

    const client = await zohoClient();
    let repaired = 0;

    for (const c of companies) {
      console.log("\n--------------------------------------");
      console.log(`🏢 Checking Company → ${c.name} (${c.id})`);

      const customerId = c.zoho_customer_id;

      if (!customerId) {
        console.log("❌ Skipping — No Customer ID");
        continue;
      }

      /* ======================================================
         1️⃣ CHECK PAYMENT LINKS
      ======================================================= */
      let paymentStatus = null;

      try {
        const { data } = await client.get(
          `/paymentlinks?customer_id=${customerId}`
        );

        const links = data?.payment_links || [];

        if (links.length) {
          const latest = links[0];
          console.log(
            `💳 Payment Link Found: ${latest.status} (${latest.payment_link_id})`
          );

          if (
            ["paid", "success"].includes(
              (latest.payment_status || "").toLowerCase()
            ) ||
            ["paid", "success"].includes(latest.status?.toLowerCase())
          ) {
            paymentStatus = "paid";
          }
        }
      } catch (err) {
        console.log("⚠ Error fetching payment links");
      }

      /* ======================================================
         2️⃣ CHECK SUBSCRIPTION
      ======================================================= */
      let subscriptionStatus = null;
      let zohoSubId = null;
      let trialEnd = null;

      try {
        const { data } = await client.get(
          `/customers/${customerId}/subscriptions`
        );

        const subs = data?.subscriptions || [];

        if (subs.length) {
          const sub = subs[0];
          subscriptionStatus = (sub.status || "").toLowerCase();
          zohoSubId = sub.subscription_id;
          trialEnd = sub.trial_ends_at;

          console.log(
            `📢 Subscription → ${subscriptionStatus} (${zohoSubId})`
          );
        }
      } catch (err) {
        console.log("⚠ Error fetching subscription");
      }

      /* ======================================================
         DECIDE FINAL STATE
      ======================================================= */
      let finalStatus = c.subscription_status;

      if (paymentStatus === "paid") finalStatus = "active";
      else if (subscriptionStatus === "live" || subscriptionStatus === "active")
        finalStatus = "active";
      else if (subscriptionStatus === "trial") finalStatus = "trial";
      else if (subscriptionStatus === "expired") finalStatus = "expired";

      if (finalStatus === c.subscription_status) {
        console.log("ℹ No Change Needed");
        continue;
      }

      /* ======================================================
         UPDATE DB
      ======================================================= */
      await db.query(
        `
        UPDATE companies 
        SET 
          subscription_status=?,
          plan = CASE 
            WHEN ?='active' THEN 'business'
            WHEN ?='trial' THEN 'trial'
            ELSE plan 
          END,
          zoho_subscription_id=?,
          trial_ends_at=?,
          updated_at = NOW()
        WHERE id=?
      `,
        [
          finalStatus,
          finalStatus,
          finalStatus,
          zohoSubId,
          trialEnd,
          c.id
        ]
      );

      repaired++;
      console.log(`✅ DB FIXED → ${finalStatus}`);
    }

    return res.json({
      success: true,
      message: "Billing Sync Completed",
      companiesChecked: companies.length,
      repaired
    });

  } catch (err) {
    console.error("❌ BILLING SYNC FAILED", err);
    res.status(500).json({
      success: false,
      message: "Billing repair failed"
    });
  }
});

export default router;
