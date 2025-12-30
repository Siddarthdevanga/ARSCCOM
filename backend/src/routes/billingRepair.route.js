import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * BILLING REPAIR TOOL
 * ----------------------------------------------------
 * Fixes OLD customers whose records were not updated.
 *
 * WHAT IT DOES:
 * 1️⃣ Finds companies with:
 *      subscription_status = 'pending'
 *      OR zoho_customer_id present but inactive
 * 2️⃣ Checks Zoho Billing for:
 *      - Payment Status
 *      - Subscription Status
 * 3️⃣ If PAID → Marks ACTIVE in DB
 * 4️⃣ Logs EVERYTHING
 *
 * SAFE TO RUN MULTIPLE TIMES
 */

router.get("/repair", async (req, res) => {
  try {
    console.log("======================================================");
    console.log("🛠️  STARTING BILLING REPAIR JOB");
    console.log("======================================================");

    let client = await zohoClient();

    /** FETCH TARGET COMPANIES */
    const [companies] = await db.query(
      `
      SELECT 
        id,
        name,
        zoho_customer_id,
        subscription_status,
        plan
      FROM companies
      WHERE 
        (subscription_status = 'pending'
        OR subscription_status IS NULL
        OR subscription_status = '')
        AND zoho_customer_id IS NOT NULL
      `
    );

    if (!companies.length) {
      console.log("✅ No companies need repair");
      return res.json({ message: "No repair needed", repaired: 0 });
    }

    console.log(`🔍 Found ${companies.length} companies to verify...\n`);

    let repaired = 0;

    for (const company of companies) {
      try {
        console.log(
          `------------------------------------------------------`
        );
        console.log(
          `🏢 Checking Company: ${company.name} (ID: ${company.id})`
        );
        console.log(`👤 Zoho Customer ID: ${company.zoho_customer_id}`);

        /** FETCH CUSTOMER SUBSCRIPTIONS */
        const { data: subRes } = await client.get(
          `/subscriptions?customer_id=${company.zoho_customer_id}`
        );

        const subs = subRes?.subscriptions || [];

        if (!subs.length) {
          console.log("⚠️ No subscription found for this customer");
          continue;
        }

        const sub = subs[0];
        const status = (sub.status || "").toLowerCase();

        console.log(`📌 Zoho Subscription Status: ${status}`);

        /** IF SUB IS TRIAL / ACTIVE → FIX DB */
        if (status === "trial" || status === "active" || status === "live") {
          await db.query(
            `
            UPDATE companies 
            SET 
              subscription_status = ?,
              zoho_subscription_id = ?,
              plan = CASE
                WHEN ? = 'trial' THEN 'trial'
                ELSE 'business'
              END,
              updated_at = NOW()
            WHERE id=?
          `,
            [
              status === "trial" ? "trial" : "active",
              sub.subscription_id,
              status,
              company.id
            ]
          );

          console.log("🎉 FIXED → Subscription marked ACTIVE in database");
          repaired++;
          continue;
        }

        console.log("❌ Not paid yet — no DB update");

      } catch (err) {
        console.log("❌ ERROR checking company:", company.name);
        console.log(err?.response?.data || err);
      }
    }

    console.log("\n======================================================");
    console.log(`🏁 REPAIR COMPLETED — FIXED: ${repaired} companies`);
    console.log("======================================================");

    return res.json({
      success: true,
      repaired
    });

  } catch (err) {
    console.error("❌ BILLING REPAIR FAILED", err);
    return res.status(500).json({
      success: false,
      message: "Billing repair failed"
    });
  }
});

export default router;
