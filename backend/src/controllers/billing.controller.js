import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

/**
 * Subscription Payment Handler
 *
 * FREE/TRIAL  → ₹49 Processing Fee
 * BUSINESS    → ₹500 Subscription Fee
 *
 * Activation only after Zoho webhook confirmation
 */
export const createPayment = async (req, res) => {
  try {
    const { companyId, email, companyName } = req.user;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ message: "Plan is required" });
    }

    if (plan === "enterprise") {
      return res.status(400).json({
        message: "Enterprise plan requires contacting sales team"
      });
    }

    /* ================= DB CHECK ================= */
    const [[company]] = await db.query(
      `
      SELECT 
        zoho_customer_id,
        subscription_status
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Block duplicate subscriptions
    if (["trial", "active"].includes(company.subscription_status)) {
      return res.status(403).json({
        message: "Subscription already active"
      });
    }

    const client = await zohoClient();

    /* ================= ENSURE ZOHO CUSTOMER ================= */
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
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ================= PLAN PRICING ================= */
    const pricing = {
      free: {
        amount: 49.0,
        description: "PROMEET Trial Processing Fee"
      },
      trial: {
        amount: 49.0,
        description: "PROMEET Trial Processing Fee"
      },
      business: {
        amount: 500.0,
        description: "PROMEET Business Subscription"
      }
    };

    if (!pricing[plan]) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    let { amount, description } = pricing[plan];

    // Ensure numeric + max 2 decimals
    amount = Number(Number(amount).toFixed(2));

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Invalid payment amount"
      });
    }

    console.log(`💳 Creating Zoho Payment Link — ₹${amount} (${plan})`);

    const payload = {
      customer_id: customerId,
      currency_code: "INR",
      amount,              // MUST be number
      description,
      is_partial_payment: false
    };

    console.log("🔎 ZOHO PAYMENT PAYLOAD:", payload);

    /* ================= CREATE PAYMENT LINK ================= */
    const { data } = await client.post("/paymentlinks", payload);

    const paymentUrl = data?.payment_link?.url;

    if (!paymentUrl) {
      throw new Error("Zoho failed to return payment link");
    }

    /* ================= UPDATE DB ================= */
    await db.query(
      `
      UPDATE companies
      SET 
        plan = ?,
        subscription_status = 'pending'
      WHERE id = ?
      `,
      [plan === "business" ? "business" : "trial", companyId]
    );

    return res.json({
      success: true,
      message: "Payment link created successfully",
      url: paymentUrl
    });

  } catch (err) {
    console.error("❌ PAYMENT ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Payment initialization failed"
    });
  }
};



