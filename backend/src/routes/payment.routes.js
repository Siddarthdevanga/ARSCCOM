import express from "express";
import { db } from "../config/db.js";

import {
  createCustomer,
  createTrial,
  createBusinessSubscription
} from "../services/zohoBilling.service.js";

const router = express.Router();

/**
 * PLAN FLOW
 * free     → Zoho Trial Subscription
 * business → Paid subscription (Zoho Hosted Payment Page)
 */

router.post("/subscribe", async (req, res) => {
  try {
    const { companyId, email, companyName, plan } = req.body;

    /* ================= VALIDATION ================= */
    if (!companyId || !email || !companyName || !plan) {
      return res.status(400).json({
        success: false,
        message: "companyId, email, companyName and plan are required"
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected"
      });
    }

    /* ================= CHECK COMPANY ================= */
    const [[company]] = await db.query(
      `SELECT 
          id, 
          zoho_customer_id, 
          zoho_subscription_id, 
          subscription_status,
          plan 
       FROM companies 
       WHERE id = ? 
       LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    /* ================= BLOCK IF ALREADY ACTIVE ================= */
    if (company.subscription_status === "active") {
      return res.status(403).json({
        success: false,
        message: "Subscription already active"
      });
    }

    /* =====================================================
       STEP 1: CHECK / CREATE CUSTOMER
    ===================================================== */
    let customerId = company?.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer...");

      customerId = await createCustomer(companyName, email);

      await db.query(
        `UPDATE companies 
         SET zoho_customer_id=? 
         WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* =====================================================
       STEP 2: CREATE SUBSCRIPTION
    ===================================================== */
    let subscriptionId = null;
    let hostedUrl = null;

    // Prevent duplicate trials
    if (plan === "free") {
      if (company.subscription_status === "trial") {
        return res.json({
          success: true,
          message: "Trial already active",
          redirect: "/conference/dashboard",
          zoho_customer_id: customerId,
          zoho_subscription_id: company.zoho_subscription_id
        });
      }

      console.log("🎟 Creating TRIAL subscription...");

      subscriptionId = await createTrial(customerId);
    }

    if (plan === "business") {
      console.log("💳 Creating BUSINESS subscription...");

      const result = await createBusinessSubscription(customerId);

      subscriptionId = result.subscriptionId;
      hostedUrl = result.hostedPageUrl;

      if (!hostedUrl) {
        throw new Error("Zoho hosted payment URL missing");
      }
    }

    /* =====================================================
       STEP 3: SAVE STATUS
    ===================================================== */
    await db.query(
      `
      UPDATE companies 
      SET 
        zoho_subscription_id=?,
        plan=?,
        subscription_status=?
      WHERE id=?
      `,
      [
        subscriptionId,
        plan === "free" ? "trial" : "business",
        plan === "free" ? "trial" : "pending",
        companyId
      ]
    );

    /* =====================================================
       RESPONSE
    ===================================================== */
    return res.json({
      success: true,
      message:
        plan === "free"
          ? "Trial Activated Successfully"
          : "Business Subscription Initiated",
      zoho_customer_id: customerId,
      zoho_subscription_id: subscriptionId,
      url: hostedUrl || null,      // 👈 FRONTEND EXPECTS "url"
      redirect: plan === "free" ? "/conference/dashboard" : null
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Subscription failed, please try again later"
    });
  }
});

export default router;
