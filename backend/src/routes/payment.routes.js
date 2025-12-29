import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

const router = express.Router();

/**
 * FREE PLAN : ₹49 Payment Link
 * BUSINESS  : ₹500 Payment Link
 */
router.post("/subscribe", async (req, res) => {
  try {
    const { email, plan } = req.body;

    if (!email || !plan)
      return res.status(400).json({ success:false, message:"Email & plan required" });

    if (!["free","business"].includes(plan))
      return res.status(400).json({ success:false, message:"Invalid plan" });

    const cleanEmail = email.toLowerCase();

    /* ---------- USER ---------- */
    const [[user]] = await db.query(
      `SELECT id, company_id FROM users WHERE email=? LIMIT 1`,
      [cleanEmail]
    );

    if (!user)
      return res.status(404).json({ success:false, message:"User not found" });

    /* ---------- COMPANY ---------- */
    const [[company]] = await db.query(
      `SELECT id,name,subscription_status,zoho_customer_id 
       FROM companies WHERE id=? LIMIT 1`,
      [user.company_id]
    );

    if (!company)
      return res.status(404).json({ success:false, message:"Company not found" });

    if (["trial","active"].includes(company.subscription_status)) {
      return res.status(403).json({
        success:false,
        message:"Subscription already active"
      });
    }

    const client = await zohoClient();

    /* ---------- ENSURE ZOHO CUSTOMER ---------- */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      const { data } = await client.post("/customers", {
        display_name: company.name,
        company_name: company.name,
        email: cleanEmail
      });

      customerId = data.customer.customer_id;

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, company.id]
      );
    }

    /* ---------- AMOUNT ---------- */
    const pricing = {
      free: { amount: 49.00, description:"PROMEET Trial Processing Fee" },
      business: { amount: 500.00, description:"PROMEET Business Subscription" }
    };

    const { amount, description } = pricing[plan];

    console.log(`💳 Creating Payment Link for ${plan.toUpperCase()} — ₹${amount}`);

    /* ---------- CREATE PAYMENT LINK (CORRECT FORMAT) ---------- */
    const { data } = await client.post("/paymentlinks", {
      customer_id: customerId,
      customer_name: company.name,
      currency_code: "INR",
      amount,               // very important: 49.00 not 4900
      description
    });

    const paymentUrl = data?.payment_link?.url;

    if (!paymentUrl) throw new Error("Zoho did not return payment URL");

    /* ---------- UPDATE STATUS ---------- */
    await db.query(
      `
      UPDATE companies 
      SET subscription_status='pending',
          plan = ?
      WHERE id=?
      `,
      [plan === "business" ? "business" : "trial", company.id]
    );

    return res.json({
      success:true,
      message:"Payment link generated",
      url: paymentUrl
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR →", err?.response?.data || err);

    return res.status(500).json({
      success:false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Subscription failed"
    });
  }
});

export default router;
