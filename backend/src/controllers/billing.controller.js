import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

/**
 * Handles subscription + payment flow
 * free/trial  → Creates Trial Subscription
 * business    → Creates Payment Link (Zoho Hosted Payment)
 */
export const createPayment = async (req, res) => {
  try {
    const { companyId, email, companyName } = req.user;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ message: "Plan is required" });
    }

    // 🚫 Enterprise never hits billing
    if (plan === "enterprise") {
      return res.status(400).json({
        message: "Enterprise plan requires contacting sales team"
      });
    }

    const client = await zohoClient();

    /* =====================================================
       FETCH COMPANY
    ===================================================== */
    const [[company]] = await db.query(
      `
      SELECT 
        zoho_customer_id,
        zoho_subscription_id,
        subscription_status
      FROM companies 
      WHERE id=?
      LIMIT 1
    `,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        message: "Company not found"
      });
    }

    /* =====================================================
       CHECK / CREATE CUSTOMER
    ===================================================== */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");

      const { data } = await client.post("/customers", {
        display_name: companyName,
        company_name: companyName,
        email
      });

      customerId = data.customer.customer_id;

      await db.query(
        "UPDATE companies SET zoho_customer_id=? WHERE id=?",
        [customerId, companyId]
      );
    }

    /* =====================================================
       TRIAL PLAN
    ===================================================== */
    if (plan === "free" || plan === "trial") {
      // Prevent multiple trials
      if (company.subscription_status === "trial") {
        return res.json({
          message: "Trial already active",
          redirect: "/conference/dashboard"
        });
      }

      console.log("🎟 Activating TRIAL subscription...");

      const { data } = await client.post("/subscriptions", {
        customer_id: customerId,
        plan: { plan_code: "1" } // <-- Make sure this is your Zoho Trial Plan Code
      });

      const subId = data.subscription.subscription_id;

      await db.query(
        `
        UPDATE companies 
        SET 
          plan='trial',
          subscription_status='trial',
          zoho_subscription_id=? 
        WHERE id=?
        `,
        [subId, companyId]
      );

      return res.json({
        message: "Trial Activated Successfully",
        redirect: "/conference/dashboard",
        subscriptionId: subId
      });
    }

    /* =====================================================
       BUSINESS PLAN (PAID)
    ===================================================== */
    console.log("💳 Creating Business Payment Link...");

    const { data } = await client.post("/paymentlinks", {
      customer_id: customerId,
      amount: 50000,       // <-- ₹500.00 (Zoho takes in paise)
      currency_code: "INR",
      description: "PROMEET Business Subscription"
    });

    const paymentUrl = data.payment_link?.url;

    // Update company status
    await db.query(
      `
      UPDATE companies 
      SET 
        plan='business',
        subscription_status='pending'
      WHERE id=?
      `,
      [companyId]
    );

    return res.json({
      message: "Payment Link Created",
      url: paymentUrl
    });
  } catch (err) {
    console.error("❌ PAYMENT ERROR:", err?.response?.data || err);

    return res.status(500).json({
      message: err?.response?.data?.message || "Payment initialization failed"
    });
  }
};
