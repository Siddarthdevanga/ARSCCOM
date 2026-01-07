import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/* =====================================================
   ZOHO PAYMENT PUSH WEBHOOK
   URL: POST /api/payment/zoho/push
===================================================== */
router.post("/push", async (req, res) => {
  try {
    console.log("📩 RAW ZOHO PAYLOAD:", req.body);

    let event_type = (req.body?.event_type || "").toLowerCase();
    let payment = req.body?.payment;
    let customer = req.body?.customer;

    /**
     * Smart Parser
     * Handles:
     * 1️⃣ Pure JSON
     * 2️⃣ String JSON
     * 3️⃣ 'JSON inside single quotes'
     */
    const smartParse = (val, label) => {
      if (!val) return null;
      if (typeof val === "object") return val;

      let clean = String(val).trim();

      // Remove wrapping ' or "
      if (
        (clean.startsWith("'") && clean.endsWith("'")) ||
        (clean.startsWith('"') && clean.endsWith('"'))
      ) {
        clean = clean.substring(1, clean.length - 1);
      }

      try {
        const parsed = JSON.parse(clean);
        console.log(`✅ Parsed ${label}:`, parsed);
        return parsed;
      } catch (e) {
        console.log(`⚠ Failed to parse ${label}`, clean, e.message);
        return null;
      }
    };

    payment = smartParse(payment, "payment");
    customer = smartParse(customer, "customer");

    /* =========================================
       FINAL FIELD EXTRACTION
    ========================================= */
    const customerId =
      customer?.customer_id ||
      req.body?.customer_id ||
      req.body?.customerId ||
      req.body?.customerID ||
      null;

    const paymentStatus =
      payment?.payment_status?.toLowerCase() ||
      req.body?.payment_status?.toLowerCase() ||
      null;

    console.log("🧾 Final Customer ID:", customerId);
    console.log("💳 Final Payment Status:", paymentStatus);
    console.log("📢 Event:", event_type);

    if (!customerId) {
      console.log("❌ Customer ID STILL missing");
      return res.status(400).json({ success: false });
    }

    /* =========================================
       FETCH COMPANY
    ========================================= */
    const [[company]] = await db.query(
      `SELECT id, plan FROM companies WHERE zoho_customer_id=? LIMIT 1`,
      [customerId]
    );

    if (!company) {
      console.log("❌ Company not found");
      return res.json({ success: true });
    }

    let plan = (company.plan || "trial").toLowerCase();

    /* =========================================
       ONLY PROCESS PAYMENT SUCCESS
    ========================================= */
    if (
      event_type === "payment_success" ||
      paymentStatus === "paid" ||
      paymentStatus === "success"
    ) {
      console.log("🎯 PAYMENT SUCCESS PROCESSING");

      const paid = new Date();
      const paidSql = paid.toISOString().slice(0, 19).replace("T", " ");

      const days = plan === "trial" ? 15 : 30;

      const end = new Date(paid.getTime() + days * 24 * 60 * 60 * 1000);
      const endSql = end.toISOString().slice(0, 19).replace("T", " ");

      if (plan === "trial") {
        await db.query(
          `
          UPDATE companies
          SET subscription_status='active',
              trial_ends_at=?,
              last_payment_created_at=?,
              updated_at=NOW()
          WHERE id=?`,
          [endSql, paidSql, company.id]
        );
      } else {
        await db.query(
          `
          UPDATE companies
          SET subscription_status='active',
              plan='business',
              subscription_ends_at=?,
              last_payment_created_at=?,
              updated_at=NOW()
          WHERE id=?`,
          [endSql, paidSql, company.id]
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


/* =====================================================
   BILLING SYNC / REPAIR
   GET /api/payment/zoho/run
===================================================== */
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

    console.log(\`🏢 Companies To Check: \${companies.length}\`);

    const client = await zohoClient();
    let repaired = 0;

    for (const c of companies) {
      console.log("--------------------------------------");
      console.log(\`🏢 Checking Company → \${c.name} (\${c.id})\`);

      if (!c.zoho_customer_id) {
        console.log("❌ Skipping — No Customer ID");
        continue;
      }

      let paymentStatus = null;

      try {
        const { data } = await client.get(
          \`/paymentlinks?customer_id=\${c.zoho_customer_id}\`
        );

        const links = data?.payment_links || [];

        if (links.length) {
          const latest = links[0];

          console.log(
            \`💳 Payment Link: \${latest.status} (\${latest.payment_link_id})\`
          );

          if (
            ["paid", "success"].includes(
              (latest.payment_status || "").toLowerCase()
            ) ||
            ["paid", "success"].includes(
              (latest.status || "").toLowerCase()
            )
          ) {
            paymentStatus = "paid";
          }
        }
      } catch {
        console.log("⚠ Error fetching payment links");
      }

      let subscriptionStatus = null;
      let zohoSubId = null;
      let trialEnd = null;

      try {
        const { data } = await client.get(
          \`/customers/\${c.zoho_customer_id}/subscriptions\`
        );

        const subs = data?.subscriptions || [];

        if (subs.length) {
          const sub = subs[0];
          subscriptionStatus = (sub.status || "").toLowerCase();
          zohoSubId = sub.subscription_id;
          trialEnd = sub.trial_ends_at;

          console.log(
            \`📢 Subscription → \${subscriptionStatus} (\${zohoSubId})\`
          );
        }
      } catch {
        console.log("⚠ Error fetching subscription");
      }

      let finalStatus = c.subscription_status;

      if (paymentStatus === "paid") finalStatus = "active";
      else if (["live", "active"].includes(subscriptionStatus))
        finalStatus = "active";
      else if (subscriptionStatus === "trial") finalStatus = "trial";
      else if (subscriptionStatus === "expired") finalStatus = "expired";

      if (finalStatus === c.subscription_status) {
        console.log("ℹ No Change Needed");
        continue;
      }

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
        WHERE id=?`,
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
      console.log(\`✅ DB FIXED → \${finalStatus}\`);
    }

    res.json({
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
