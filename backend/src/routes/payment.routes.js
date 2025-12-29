import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * Subscribe using EMAIL + PLAN
 * FREE  -> ₹49 Processing Fee
 * BUSINESS -> ₹500
 * Activation happens via Zoho Webhook
 */
router.post("/subscribe", async (req, res) => {
  try {
    const { email, plan } = req.body;

    if (!email || !plan) {
      return res.status(400).json({
        success: false,
        message: "email and plan are required",
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }

    /* ================= FIND USER ================= */
    const [[user]] = await db.query(
      `SELECT id, company_id FROM users WHERE email = ? LIMIT 1`,
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found for this email",
      });
    }

    /* ================= FIND COMPANY ================= */
    const [[company]] = await db.query(
      `SELECT id, name, subscription_status, zoho_customer_id
       FROM companies WHERE id = ? LIMIT 1`,
      [user.company_id]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Prevent duplicate paid/trial active users
    if (["trial", "active"].includes(company.subscription_status)) {
      return res.status(403).json({
        success: false,
        message: "Subscription already active",
      });
    }

    const companyId = company.id;
    const companyName = company.name;

    const client = await zohoClient();

    /* ======================================================
       ENSURE ZOHO CUSTOMER
    ====================================================== */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");

      const { data } = await client.post("/customers", {
        display_name: companyName,
        company_name: companyName,
        email,
      });

      customerId = data.customer.customer_id;

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ======================================================
       AMOUNT & DESCRIPTION
    ====================================================== */
    let amount = 0;
    let description = "";

    if (plan === "free") {
      amount = 4900; // ₹49
      description = "PROMEET Trial Processing Fee";
    } else if (plan === "business") {
      amount = 50000; // ₹500
      description = "PROMEET Business Subscription";
    }

    /* ======================================================
       CREATE PAYMENT LINK
    ====================================================== */
    console.log("💳 Creating Zoho Payment Link...");

    const { data } = await client.post("/paymentlinks", {
      customer_id: customerId,
      amount,
      currency_code: "INR",
      description,
    });

    const paymentUrl = data?.payment_link?.url;

    if (!paymentUrl) {
      throw new Error("Failed to generate payment link");
    }

    /* ======================================================
       MARK COMPANY AS PENDING
       Final activation happens via webhook
    ====================================================== */
    await db.query(
      `
      UPDATE companies
      SET subscription_status='pending',
          plan = ?
      WHERE id=?
      `,
      [plan === "business" ? "business" : "trial", companyId]
    );

    return res.json({
      success: true,
      message: "Payment link created",
      url: paymentUrl,
    });
  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR:", err?.response?.data || err);

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
