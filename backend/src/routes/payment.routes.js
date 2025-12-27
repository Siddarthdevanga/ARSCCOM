import express from "express";
import { db } from "../config/db.js";

import {
  createCustomer,
  createTrial,
  createBusinessSubscription,
} from "../services/zohoBilling.service.js";

const router = express.Router();

/**
 * Subscribe using USER EMAIL + PLAN
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
      `SELECT id, name, zoho_customer_id, zoho_subscription_id, subscription_status 
       FROM companies WHERE id = ? LIMIT 1`,
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

    /* ================= CREATE CUSTOMER IF NEEDED ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");
      customerId = await createCustomer(companyName, email);

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ====================== TRIAL ======================= */
    if (plan === "free") {
      if (company.subscription_status === "trial") {
        return res.json({
          success: true,
          message: "Trial already active",
          redirect: "/login",
        });
      }

      console.log("🎟 Creating TRIAL Subscription...");
      const subscriptionId = await createTrial(customerId);

      await db.query(
        `
        UPDATE companies 
        SET subscription_status='trial',
            plan='trial',
            zoho_subscription_id=?
        WHERE id=?
        `,
        [subscriptionId, companyId]
      );

      return res.json({
        success: true,
        message: "Trial Activated Successfully",
        redirect: "/login",
      });
    }

    /* ====================== BUSINESS (TEMP DISABLED) ======================= */
    console.log("💳 Business Plan Requested (BLOCKED)");

    return res.status(501).json({
      success: false,
      message:
        "Business plan integration is in progress. Please proceed with Free Trial.",
    });
  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message: err?.message || "Subscription failed",
    });
  }
});

export default router;
