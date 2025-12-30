import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

/**
 * Subscription Payment Handler
 * FREE/TRIAL  → ₹49 Processing Fee
 * BUSINESS    → ₹500 Subscription Fee
 *
 * Subscription is activated ONLY by Zoho webhook after payment success.
 */
router.post("/subscribe", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    const email = req.user?.email;
    const companyId = req.user?.companyId;

    /* ================= VALIDATION ================= */
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Plan is required",
      });
    }

    if (!email || !companyId) {
      return res.status(401).json({
        success: false,
        message: "User authentication failed",
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }

    /* ================= FETCH COMPANY ================= */
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
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const companyName = company.name;
    const status = (company.subscription_status || "").toLowerCase();

    /* ================= SUBSCRIPTION STATE GUARD ================= */
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({
        success: false,
        message: "Subscription already active",
      });
    }

    /**
     * CASE 1: Already pending + valid payment link exists
     * → Reuse existing link (prevents duplicate billing links)
     */
    if (status === "pending" && company.last_payment_link) {
      return res.json({
        success: true,
        message: "Payment already initiated",
        url: company.last_payment_link,
      });
    }

    /**
     * CASE 2: Pending but NO link
     * or first-time subscription
     * → Create new Zoho payment link
     */
    let client = await zohoClient();

    /* ================= ENSURE ZOHO CUSTOMER EXISTS ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");

      const { data } = await client.post("/customers", {
        display_name: companyName,
        company_name: companyName,
        email,
      });

      customerId = data?.customer?.customer_id;
      if (!customerId) throw new Error("Zoho failed to create customer");

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ================= PRICING ================= */
    const pricing = {
      free: { amount: 49, description: "PROMEET Trial Processing Fee" },
      business: { amount: 500, description: "PROMEET Business Subscription" },
    };

    const price = pricing[plan];
    const amount = Number(Number(price.amount).toFixed(2));

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    console.log(`💳 Creating Payment Link → ₹${amount} (${plan})`);

    const payload = {
      customer_id: customerId,
      currency_code: "INR",
      amount, // number
      description: price.description,
      is_partial_payment: false,
      reference_id: `COMP-${companyId}-${Date.now()}`,
    };

    let data;

    try {
      ({ data } = await client.post("/paymentlinks", payload));
    } catch (err) {
      // Token expired — regenerate and retry automatically
      if (err?.response?.status === 401) {
        console.warn("🔄 Zoho token expired — retrying…");
        client = await zohoClient();
        ({ data } = await client.post("/paymentlinks", payload));
      } else throw err;
    }

    const paymentUrl = data?.payment_link?.url;
    if (!paymentUrl) throw new Error("Zoho failed to return payment link");

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
      [plan === "business" ? "business" : "trial", paymentUrl, companyId]
    );

    return res.json({
      success: true,
      message: "Payment link generated successfully",
      url: paymentUrl,
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
