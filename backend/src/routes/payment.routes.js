import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

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

    /* FIND USER */
    const [[user]] = await db.query(
      `SELECT id, company_id FROM users WHERE email=? LIMIT 1`,
      [cleanEmail]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    /* FIND COMPANY */
    const [[company]] = await db.query(
      `SELECT id, name, subscription_status, zoho_customer_id 
       FROM companies WHERE id=? LIMIT 1`,
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

    const client = await zohoClient();

    /* ENSURE CUSTOMER IN ZOHO */
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

    /* PRICING */
    const pricing = {
      free: {
        amount: 49.0,
        description: "PROMEET Trial Processing Fee"
      },
      business: {
        amount: 500.0,
        description: "PROMEET Business Subscription"
      }
    };

    const { amount, description } = pricing[plan];

    console.log(`💳 Creating Payment Link (${plan}) → ₹${amount}`);

    /* =========================
       CREATE PAYMENT LINK
       (STRICT — ONLY THESE FIELDS)
    ========================== */
    const { data } = await client.post("/paymentlinks", {
      customer_id: customerId,
      currency_code: "INR",
      amount: amount,
      description
    });

    const paymentUrl = data?.payment_link?.url;

    if (!paymentUrl) throw new Error("No payment link returned");

    /* UPDATE STATUS */
    await db.query(
      `UPDATE companies 
       SET subscription_status='pending',
           plan=? 
       WHERE id=?`,
      [plan === "business" ? "business" : "trial", companyId]
    );

    return res.json({
      success: true,
      message: "Payment link created",
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
