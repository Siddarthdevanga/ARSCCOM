import express from "express";
import { db } from "../config/db.js";

import {
  createCustomer,
  createTrial,
  createBusinessSubscription
} from "../services/zohoBilling.service.js";

const router = express.Router();

/**
 * Subscribe based on EMAIL + PLAN
 */
router.post("/subscribe", async (req, res) => {
  try {
    const { email, plan } = req.body;

    /* ================= VALIDATION ================= */
    if (!email || !plan) {
      return res.status(400).json({
        success: false,
        message: "email and plan are required"
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected"
      });
    }

    /* ================= GET COMPANY ================= */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        name,
        email,
        zoho_customer_id,
        zoho_subscription_id,
        subscription_status
      FROM companies
      WHERE email = ?
      LIMIT 1
      `,
      [email.toLowerCase()]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found for this email"
      });
    }

    const companyId = company.id;
    const companyName = company.name;

    /* ================= CHECK / CREATE CUSTOMER ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");
      customerId = await createCustomer(companyName, email);

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    let subscriptionId = null;
    let redirectUrl = null;

    /* ================= TRIAL ================= */
    if (plan === "free") {
      if (company.subscription_status === "trial") {
        return res.json({
          success: true,
          message: "Trial already active",
          redirect: "/login"
        });
      }

      console.log("🎟 Creating TRIAL subscription...");
      subscriptionId = await createTrial(customerId);

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
        redirect: "/login"
      });
    }

    /* ================= BUSINESS (PAID) ================= */
    console.log("💳 Creating BUSINESS subscription...");
    const result = await createBusinessSubscription(customerId);

    subscriptionId = result.subscriptionId;
    redirectUrl = result.hostedPageUrl;

    await db.query(
      `
      UPDATE companies 
      SET 
        subscription_status='pending',
        plan='business',
        zoho_subscription_id=?
      WHERE id=?
      `,
      [subscriptionId, companyId]
    );

    return res.json({
      success: true,
      message: "Redirect to Zoho Payment",
      url: redirectUrl
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message: "Subscription failed, please try again later"
    });
  }
});

export default router;
