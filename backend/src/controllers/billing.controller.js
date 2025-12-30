import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

/**
 * Subscription Payment Handler
 *
 * FREE/TRIAL  → ₹49 Processing Fee
 * BUSINESS    → ₹500 Subscription Fee
 *
 * Subscription becomes ACTIVE only after Zoho Webhook confirmation
 */
export const createPayment = async (req, res) => {
  try {
    const { companyId, email, companyName } = req.user || {};
    const { plan } = req.body;

    /* ================= AUTH & INPUT VALIDATION ================= */
    if (!companyId || !email) {
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

    /* ================= FETCH COMPANY ================= */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        name,
        zoho_customer_id,
        subscription_status,
        last_payment_link
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const status = (company.subscription_status || "").toLowerCase();

    /* ================= BLOCK ACTIVE USERS ================= */
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({
        message: "Subscription already active"
      });
    }

    /**
     * CASE: Already pending & payment link exists
     * → Reuse existing link
     */
    if (
      status === "pending" &&
      company.last_payment_link &&
      company.last_payment_link.trim() !== ""
    ) {
      return res.json({
        success: true,
        reused: true,
        message: "Payment already initiated",
        url: company.last_payment_link
      });
    }

    /* ================= ZOHO CLIENT ================= */
    let client = await zohoClient();

    /* ================= ENSURE ZOHO CUSTOMER EXISTS ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer…");

      let response;

      try {
        response = await client.post("/customers", {
          display_name: companyName || company.name,
          company_name: companyName || company.name,
          email
        });

      } catch (err) {
        if (err?.response?.status === 401) {
          console.warn("🔄 Zoho token expired — retrying create customer…");
          client = await zohoClient();

          response = await client.post("/customers", {
            display_name: companyName || company.name,
            company_name: companyName || company.name,
            email
          });
        } else throw err;
      }

      customerId = response?.data?.customer?.customer_id;

      if (!customerId) throw new Error("Failed to create Zoho customer");

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ================= PLAN PRICING ================= */
    const pricing = {
      free: { amount: 49, description: "PROMEET Trial Processing Fee" },
      trial: { amount: 49, description: "PROMEET Trial Processing Fee" },
      business: { amount: 500, description: "PROMEET Business Subscription" }
    };

    const selected = pricing[plan];

    if (!selected) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    /**
     * 🔥 CRITICAL FIX FOR ZOHO
     * Zoho REQUIRES strict 2-decimal numeric:
     * 49.00  ✔
     * 500.00 ✔
     * 49     ❌ "Invalid value passed for Total payment Amount"
     */
    const amount = Number(selected.amount).toFixed(2); // keeps 2-decimals always

    console.log(
      `💳 Creating Zoho Payment Link → ₹${amount} (${plan}) for Company ${companyId}`
    );

    /* ================= CREATE PAYMENT LINK ================= */
    const payload = {
      customer_id: customerId,
      currency_code: "INR",
      amount: Number(amount), // ensure numeric
      description: selected.description,
      is_partial_payment: false,
      reference_id: `COMP-${companyId}-${Date.now()}`
    };

    console.log("📤 ZOHO PAYMENT PAYLOAD:", payload);

    let data;

    try {
      ({ data } = await client.post("/paymentlinks", payload));
    } catch (err) {
      if (err?.response?.status === 401) {
        console.warn("🔄 Zoho token expired — retrying payment link…");
        client = await zohoClient();
        ({ data } = await client.post("/paymentlinks", payload));
      } else {
        console.error("ZOHO PAYMENT ERROR:", err?.response?.data || err);
        throw err;
      }
    }

    const paymentUrl = data?.payment_link?.url;

    if (!paymentUrl) throw new Error("Zoho failed to return payment link");

    /* ================= UPDATE COMPANY ================= */
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
