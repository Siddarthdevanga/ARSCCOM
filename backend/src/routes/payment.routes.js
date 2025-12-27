import express from "express";
import { db } from "../config/db.js";

import {
  createCustomer,
  createTrial,
  createBusinessSubscription
} from "../services/zohoBilling.service.js";

const router = express.Router();

/**
 * Subscription without login
 * Requires: companyId + plan
 */
router.post("/subscribe", async (req, res) => {
  try {
    const { companyId, plan } = req.body;

    if (!companyId || !plan) {
      return res.status(400).json({
        message: "companyId and plan are required"
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        message: "Invalid plan"
      });
    }

    // ---------------- GET COMPANY ----------------
    const [[company]] = await db.query(
      `SELECT id, name, email,
              zoho_customer_id,
              zoho_subscription_id,
              subscription_status
       FROM companies
       WHERE id = ?
       LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyName = company.name;
    const email = company.email;

    // ---------------- CREATE CUSTOMER IF NEEDED ----------------
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

    // ---------------- TRIAL ----------------
    if (plan === "free") {
      if (company.subscription_status === "trial") {
        return res.json({
          success: true,
          message: "Trial already active",
          redirect: "/login"
        });
      }

      subscriptionId = await createTrial(customerId);

      await db.query(
        `UPDATE companies 
         SET subscription_status='trial',
             plan='trial',
             zoho_subscription_id=?
         WHERE id=?`,
        [subscriptionId, companyId]
      );

      return res.json({
        success: true,
        message: "Trial Activated",
        redirect: "/login"
      });
    }

    // ---------------- BUSINESS PLAN ----------------
    const result = await createBusinessSubscription(customerId);

    subscriptionId = result.subscriptionId;
    redirectUrl = result.hostedPageUrl;

    await db.query(
      `UPDATE companies 
       SET subscription_status='pending',
           plan='business',
           zoho_subscription_id=?
       WHERE id=?`,
      [subscriptionId, companyId]
    );

    return res.json({
      success: true,
      message: "Redirect to Zoho Payment",
      url: redirectUrl
    });

  } catch (err) {
    console.error("SUBSCRIPTION ERROR:", err?.response?.data || err);

    res.status(500).json({
      success: false,
      message: "Subscription failed"
    });
  }
});

export default router;
