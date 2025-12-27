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
 * business → Zoho Hosted Payment Page
 */

async function handleSubscribe(req, res) {
  try {
    const { companyId, email, companyName, plan } = req.body;

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

    const [[company]] = await db.query(
      `SELECT id, zoho_customer_id, zoho_subscription_id, subscription_status
       FROM companies WHERE id=? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    let customerId = company?.zoho_customer_id;

    if (!customerId) {
      customerId = await createCustomer(companyName, email);
      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    let subscriptionId;
    let redirectUrl = null;

    if (plan === "free") {
      if (company.subscription_status === "trial") {
        return res.json({
          success: true,
          message: "Trial already active",
          zoho_customer_id: customerId,
          zoho_subscription_id: company.zoho_subscription_id
        });
      }

      subscriptionId = await createTrial(customerId);
    }

    if (plan === "business") {
      const result = await createBusinessSubscription(customerId);
      subscriptionId = result.subscriptionId;
      redirectUrl = result.hostedPageUrl;
    }

    await db.query(
      `UPDATE companies 
       SET zoho_subscription_id=?, subscription_status=?
       WHERE id=?`,
      [
        subscriptionId,
        plan === "free" ? "trial" : "pending",
        companyId
      ]
    );

    return res.json({
      success: true,
      message: plan === "free"
        ? "Trial Activated Successfully"
        : "Business Subscription Initiated",
      zoho_customer_id: customerId,
      zoho_subscription_id: subscriptionId,
      url: redirectUrl
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message: "Subscription failed, please try again later"
    });
  }
}

/* REAL ROUTE */
router.post("/subscribe", handleSubscribe);

/* COMPATIBILITY ROUTE (Fixes your 404) */
router.post("/pay", handleSubscribe);

export default router;
