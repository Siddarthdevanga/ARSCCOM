import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * ================================
 *  SUBSCRIPTION CONTROLLER
 *
 * FREE PLAN   → ₹49 Processing Fee
 * BUSINESS    → ₹500 Subscription
 *
 * Activation will happen via Webhook
 * ================================
 */
router.post("/subscribe", async (req, res) => {
  try {
    const { email, plan } = req.body;

    if (!email || !plan) {
      return res.status(400).json({
        success: false,
        message: "Email and plan are required"
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected"
      });
    }

    const cleanEmail = email.toLowerCase();

    /* ================= FIND USER ================= */
    const [[user]] = await db.query(
      `SELECT id, company_id FROM users WHERE email=? LIMIT 1`,
      [cleanEmail]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found for this email"
      });
    }

    /* ================= FIND COMPANY ================= */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        name,
        subscription_status,
        zoho_customer_id
      FROM companies
      WHERE id=?
      LIMIT 1
      `,
      [user.company_id]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    if (["trial", "active"].includes(company.subscription_status)) {
      return res.status(403).json({
        success: false,
        message: "Subscription already active"
      });
    }

    const companyId = company.id;
    const companyName = company.name;

    /* ================= ZOHO CLIENT ================= */
    const client = await zohoClient();

    /* ================= ENSURE CUSTOMER ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");

      const { data } = await client.post("/customers", {
        display_name: companyName,
        company_name: companyName,
        email: cleanEmail
      });

      customerId = data.customer.customer_id;

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ================= AMOUNT ================= */
    const pricing = {
      free: {
        amount: "49.00",
        description: "PROMEET Trial Processing Fee"
      },
      business: {
        amount: "500.00",
        description: "PROMEET Business Subscription"
      }
    };

    const { amount, description } = pricing[plan];

    /* ================= CREATE PAYMENT LINK ================= */
    console.log(`💳 Creating Payment Link (${plan.toUpperCase()}) — ₹${amount}`);

    const { data } = await client.post("/paymentlinks", {
      customer_id: customerId,
      customer_name: companyName,
      currency_code: "INR",
      amount,              // MUST BE STRING LIKE "49.00"
      date: new Date().toISOString().split("T")[0],
      payment_mode: "online",
      description
    });

    const paymentUrl = data?.payment_link?.url;

    if (!paymentUrl) {
      throw new Error("Zoho did not return a payment link");
    }

    /* ================= SET STATUS PENDING ================= */
    await db.query(
      `
      UPDATE companies 
      SET 
        subscription_status='pending',
        plan = ?
      WHERE id=?
      `,
      [plan === "business" ? "business" : "trial", companyId]
    );

    return res.json({
      success: true,
      message: "Payment link generated",
      url: paymentUrl
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR →", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Subscription failed"
    });
  }
});

export default router;
