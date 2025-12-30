import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * ONE-TIME REPAIR UTILITY
 * ------------------------
 * Fix past companies stuck in:
 * pending / expired / none / empty
 *
 * Reads actual status from ZOHO Billing
 * and updates DB accordingly
 */

router.post("/repair-old-companies", async (req, res) => {
  try {
    let client = await zohoClient();

    // Fetch companies who are stuck / not updated
    const [companies] = await db.query(`
      SELECT 
        id,
        name,
        zoho_customer_id,
        subscription_status,
        plan
      FROM companies
      WHERE 
        subscription_status IN ('pending','none','expired','')
        OR subscription_status IS NULL
        OR plan IS NULL
    `);

    if (!companies.length) {
      return res.json({
        success: true,
        message: "No broken companies found",
      });
    }

    let fixed = [];
    let skipped = [];

    for (const c of companies) {
      if (!c.zoho_customer_id) {
        skipped.push({ id: c.id, reason: "No zoho_customer_id" });
        continue;
      }

      try {
        /* ================= GET CUSTOMER ================= */
        const { data: custRes } = await client.get(
          `/customers/${c.zoho_customer_id}`
        );

        const cust = custRes?.customer;
        const status = (cust?.status || "").toLowerCase();

        /**
         * ================= CHECK PAYMENTS =================
         */
        let paid = false;

        try {
          const { data: payRes } = await client.get(
            `/payments?customer_id=${c.zoho_customer_id}`
          );

          const payments = payRes?.payments || [];

          paid = payments.some(
            (p) =>
              (p.status || "").toLowerCase() === "success" ||
              (p.payment_status || "").toLowerCase() === "paid"
          );
        } catch {
          console.log("Payments fetch failed for", c.name);
        }

        /**
         * ================= CHECK SUBSCRIPTIONS =================
         */
        let subStatus = null;

        try {
          const { data: subRes } = await client.get(
            `/subscriptions?customer_id=${c.zoho_customer_id}`
          );

          const subs = subRes?.subscriptions || [];

          if (subs.length) {
            subStatus = (subs[0].status || "").toLowerCase();
          }
        } catch {
          console.log("Subscription fetch failed for", c.name);
        }

        /**
         * ================= DECISION LOGIC =================
         */

        let newPlan = c.plan;
        let newStatus = c.subscription_status;

        // If payment happened → Active Business
        if (paid) {
          newPlan = "business";
          newStatus = "active";
        }

        // If subscription trial exists
        if (subStatus === "trial") {
          newPlan = "trial";
          newStatus = "trial";
        }

        // If subscription active
        if (subStatus === "active" || subStatus === "live") {
          newPlan = "business";
          newStatus = "active";
        }

        // If nothing useful found → skip
        if (!newStatus || newStatus === c.subscription_status) {
          skipped.push({ id: c.id, name: c.name, reason: "No change" });
          continue;
        }

        /* ================= UPDATE DB ================= */
        await db.query(
          `
            UPDATE companies
            SET 
              plan = ?,
              subscription_status = ?,
              updated_at = NOW()
            WHERE id=?
          `,
          [newPlan, newStatus, c.id]
        );

        fixed.push({
          id: c.id,
          name: c.name,
          newPlan,
          newStatus,
        });

      } catch (err) {
        console.log("Repair failed for company:", c.name, err?.response?.data || err);
        skipped.push({ id: c.id, name: c.name, reason: "Zoho error" });
      }
    }

    return res.json({
      success: true,
      message: "Repair completed",
      fixed,
      skipped
    });

  } catch (err) {
    console.error("REPAIR ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Repair failed",
    });
  }
});

export default router;
