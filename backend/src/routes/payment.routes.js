import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * PAYMENT ENTRY POINT
 * -------------------
 * Plans:
 *  free/trial → ₹49 Processing Fee
 *  business   → ₹500 Subscription
 *
 * NOTE:
 * Subscription becomes ACTIVE ONLY via Zoho webhook after payment success.
 */
router.post("/subscribe", async (req, res) => {
  try {
    const { email, plan } = req.body;

    /* ================= VALIDATION ================= */
    if (!email || !plan) {
      return res.status(400).json({
        success: false,
        message: "Email and plan are required",
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    /* ================= USER ================= */
    const [[user]] = await db.query(
      `SELECT id, company_id FROM users WHERE email=? LIMIT 1`,
      [cleanEmail]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* ================= COMPANY ================= */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        name,
        subscription_status,
        zoho_customer_id,
        last_payment_link
      FROM companies
      WHERE id=? LIMIT 1
      `,
      [user.company_id]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const companyId = company.id;
    const companyName = company.name;
    const status = (company.subscription_status || "").toLowerCase();

    /* ================= ACTIVE BLOCK ================= */
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({
        success: false,
        message: "Subscription already active",
      });
    }

    /**
     * If payment already started → reuse link
     * Prevents duplicate invoices
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
        url: company.last_payment_link,
      });
    }

    /* ================= ZOHO CLIENT ================= */
    let client = await zohoClient();

    /* ================= ENSURE ZOHO CUSTOMER ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");

      let response;

      try {
        response = await client.post("/customers", {
          display_name: companyName,
          company_name: companyName,
          email: cleanEmail,
        });
      } catch (err) {
        if (err?.response?.status === 401) {
          console.warn("🔄 Zoho token expired — retrying customer create...");
          client = await zohoClient();

          response = await client.post("/customers", {
            display_name: companyName,
            company_name: companyName,
            email: cleanEmail,
          });
        } else throw err;
      }

      customerId = response?.data?.customer?.customer_id;

      if (!customerId) throw new Error("Zoho failed to create customer");

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ================= PRICING ================= */
    const pricing = {
      free: { amount: 49.0, description: "PROMEET Trial Processing Fee" },
      business: { amount: 500.0, description: "PROMEET Business Subscription" },
    };

    const price = pricing[plan];

    if (!price) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    /**
     * 🔥 CRITICAL
     * Zoho requires STRING → 2 decimal format:
     *   "49.00"
     *   "500.00"
     */
    const paymentAmount = Number(price.amount).toFixed(2);

    console.log(
      `💳 Creating Zoho Payment Link (${plan}) → ₹${paymentAmount} for Company ${companyId}`
    );

    /* ================= ZOHO PAYLOAD ================= */
    const payload = {
      customer_id: customerId,
      customer_name: companyName,
      currency_code: "INR",
      payment_amount: paymentAmount, // MUST be string
      description: price.description,
      is_partial_payment: false,
      reference_id: `COMP-${companyId}-${Date.now()}`,
    };

    console.log("📤 ZOHO PAYLOAD:", payload);

    /* ================= CREATE PAYMENT LINK ================= */
    let data;
    try {
      ({ data } = await client.post("/paymentlinks", payload));
    } catch (err) {
      if (err?.response?.status === 401) {
        console.warn("🔄 Zoho token expired — retrying...");
        client = await zohoClient();
        ({ data } = await client.post("/paymentlinks", payload));
      } else throw err;
    }

    const paymentLink = data?.payment_link?.url;

    if (!paymentLink) throw new Error("Zoho failed to return payment link");

    /* ================= UPDATE DB ================= */
    await db.query(
      `
      UPDATE companies
      SET 
        subscription_status='pending',
        plan = ?,
        last_payment_link = ?
      WHERE id=?
      `,
      [plan === "business" ? "business" : "trial", paymentLink, companyId]
    );

    return res.json({
      success: true,
      message: "Payment link generated successfully",
      url: paymentLink,
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR →", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Subscription failed",
    });
  }
});

export default router;
