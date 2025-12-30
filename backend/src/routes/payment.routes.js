import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * Supports:
 * 1️⃣ Authenticated Users  (req.user from middleware)
 * 2️⃣ Legacy Users sending email in body
 */
router.post("/subscribe", async (req, res) => {
  try {
    let email = req.body?.email?.trim()?.toLowerCase() || null;
    const { plan } = req.body;

    /* ================= PLAN VALIDATION ================= */
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Plan is required",
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }

    /**
     * ============================================
     * CASE 1: LOGGED-IN USER (Preferred)
     * ============================================
     */
    let userId = req.user?.id;
    let companyId = req.user?.companyId;

    if (!email && req.user?.email) {
      email = req.user.email.toLowerCase();
    }

    /**
     * ============================================
     * CASE 2: Legacy Email-Based Flow
     * ============================================
     */
    if (!companyId) {
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email or authentication required",
        });
      }

      const [[user]] = await db.query(
        `SELECT id, company_id FROM users WHERE email=? LIMIT 1`,
        [email]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      userId = user.id;
      companyId = user.company_id;
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

    const status = (company.subscription_status || "").toLowerCase();

    /* ================= ACTIVE BLOCK ================= */
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({
        success: false,
        message: "Subscription already active",
      });
    }

    /* ================= REUSE EXISTING PAYMENT ================= */
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

    /* ================= ENSURE CUSTOMER ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");

      const { data } = await client.post("/customers", {
        display_name: company.name,
        company_name: company.name,
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
      free: { amount: 49.0, description: "PROMEET Trial Processing Fee" },
      business: { amount: 500.0, description: "PROMEET Business Subscription" },
    };

    const price = pricing[plan];
    const paymentAmount = Number(price.amount).toFixed(2);

    console.log(`💳 Creating Payment Link (${plan}) → ₹${paymentAmount}`);

    const payload = {
      customer_id: customerId,
      customer_name: company.name,
      currency_code: "INR",
      payment_amount: paymentAmount,
      description: price.description,
      is_partial_payment: false,
      reference_id: `COMP-${companyId}-${Date.now()}`,
    };

    let data = (await client.post("/paymentlinks", payload)).data;

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
    console.error("❌ SUBSCRIPTION ERROR", err?.response?.data || err);

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
