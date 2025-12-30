import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

/**
 * Subscription Payment Handler
 *
 * FREE/TRIAL  → ₹49 Processing Fee
 * BUSINESS    → ₹500 Subscription Fee
 *
 * Activation ONLY after Zoho webhook confirmation
 */
export const createPayment = async (req, res) => {
  try {
    const { companyId, email, companyName } = req.user || {};
    const { plan } = req.body;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!plan) {
      return res.status(400).json({ message: "Plan is required" });
    }

    if (plan === "enterprise") {
      return res.status(400).json({
        message: "Enterprise plan requires contacting sales team"
      });
    }

    /* ================= DB CHECK ================= */
    const [rows] = await db.query(
      `
      SELECT 
        id,
        zoho_customer_id,
        subscription_status,
        last_payment_link
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId]
    );

    const company = rows?.[0];

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const status = (company.subscription_status || "").toLowerCase();

    /* ================= STATE PROTECTION ================= */
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({
        message: "Subscription already active"
      });
    }

    // If already pending → reuse existing link if exists
    if (status === "pending" && company.last_payment_link) {
      return res.json({
        success: true,
        message: "Payment already initiated",
        url: company.last_payment_link
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

      customerId = data?.customer?.customer_id;

      if (!customerId) {
        throw new Error("Failed to create Zoho customer");
      }

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ================= PLAN PRICING ================= */
    const pricing = {
      free: { amount: 49, description: "PROMEET Trial Processing Fee" },
      trial: { amount: 49, description: "PROMEET Trial Processing Fee" },
      business: { amount: 500, description: "PROMEET Business Subscription" },
    };

    const selected = pricing[plan];

    if (!selected) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const amount = Number(Number(selected.amount).toFixed(2));

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    console.log(`💳 Creating Zoho Payment Link — ₹${amount} (${plan})`);

    /* ================= CREATE PAYMENT LINK ================= */
    const payload = {
      customer_id: customerId,
      currency_code: "INR",
      amount,
      description: selected.description,
      is_partial_payment: false,
      reference_id: `COMP-${companyId}-${Date.now()}`
    };

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
        subscription_status = 'pending',
        last_payment_link = ?
      WHERE id = ?
      `,
      [plan === "business" ? "business" : "trial", paymentUrl, companyId]
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
