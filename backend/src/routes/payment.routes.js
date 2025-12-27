import express from "express";
import { db } from "../config/db.js";

import {
  createCustomer,
  createTrial,
  createBusinessSubscription
} from "../services/zohoBilling.service.js";

const router = express.Router();


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

    const normalizedEmail = email.trim().toLowerCase();


    /* =====================================================
       STEP 1: GET USER → COMPANY ID
    ===================================================== */
    const [[user]] = await db.query(
      `
      SELECT id, company_id 
      FROM users 
      WHERE email = ? 
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found for this email",
      });
    }


    /* =====================================================
       STEP 2: GET COMPANY
    ===================================================== */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        name,
        zoho_customer_id,
        zoho_subscription_id,
        subscription_status
      FROM companies
      WHERE id = ?
      LIMIT 1
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


    /* =====================================================
       STEP 3: CHECK / CREATE ZOHO CUSTOMER
    ===================================================== */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");
      customerId = await createCustomer(companyName, normalizedEmail);

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }


    /* =====================================================
       STEP 4: TRIAL PLAN
    ===================================================== */
    if (plan === "free") {
      if (company.subscription_status === "trial") {
        return res.json({
          success: true,
          message: "Trial already active",
          redirect: "/login",
        });
      }

      console.log("🎟 Creating TRIAL subscription...");
      const subscriptionId = await createTrial(customerId);

      await db.query(
        `
        UPDATE companies 
        SET 
          subscription_status='trial',
          plan='trial',
          zoho_subscription_id=?
        WHERE id=?
        `,
        [subscriptionId, companyId]
      );

      return res.json({
        success: true,
        message: "Trial Activated",
        redirect: "/login",
      });
    }


    /* =====================================================
       STEP 5: BUSINESS (PAID)
    ===================================================== */
    console.log("💳 Creating BUSINESS subscription...");
    const result = await createBusinessSubscription(customerId);

    await db.query(
      `
      UPDATE companies 
      SET 
        subscription_status='pending',
        plan='business',
        zoho_subscription_id=?
      WHERE id=?
      `,
      [result.subscriptionId, companyId]
    );

    return res.json({
      success: true,
      message: "Redirect to Zoho Payment",
      url: result.hostedPageUrl,
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message: "Subscription failed, please try again later",
    });
  }
});

export default router;
