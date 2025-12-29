import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

/**
 * Handles Subscription Payment Flow
 * FREE/TRIAL  -> Paid Processing Fee ₹49 -> Zoho Checkout
 * BUSINESS    -> Paid ₹500 -> Zoho Checkout
 * ACTIVATION  -> Only via Webhook
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

    const client = await zohoClient();

    /* =====================================================
       FETCH COMPANY
    ===================================================== */
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

    // Prevent duplicate purchase
    if (["trial", "active"].includes(company.subscription_status)) {
      return res.status(403).json({
        message: "Subscription already active"
      });
    }

    /* =====================================================
       ENSURE ZOHO CUSTOMER
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
       PLAN → AMOUNT MAP
    ===================================================== */
    let amount = 0;
    let description = "";

    if (plan === "free" || plan === "trial") {
      amount = 4900; // ₹49 (Zoho in paise)
      description = "PROMEET Trial Processing Fee";
    } else if (plan === "business") {
      amount = 50000; // ₹500
      description = "PROMEET Business Subscription";
    } else {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    /* =====================================================
       CREATE PAYMENT LINK
    ===================================================== */
    console.log("💳 Creating Zoho Payment Link...");

    const { data } = await client.post("/paymentlinks", {
      customer_id: customerId,
      amount,
      currency_code: "INR",
      description
    });

    const paymentUrl = data?.payment_link?.url;

    if (!paymentUrl) {
      throw new Error("Failed to generate Zoho payment link");
    }

    /* =====================================================
       UPDATE DB → PENDING STATUS
       FINAL STATUS WILL BE SET BY WEBHOOK
    ===================================================== */
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
      message: "Payment link created successfully",
      url: paymentUrl
    });

  } catch (err) {
    console.error("❌ PAYMENT ERROR:", err?.response?.data || err);

    return res.status(500).json({
      message:
        err?.response?.data?.message ||
        "Payment initialization failed"
    });
  }
};

