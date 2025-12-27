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
 * plan = free      => create trial
 * plan = business  => create paid subscription
 */

router.post("/subscribe", async (req, res) => {
  try {
    const { companyId, email, companyName, plan } = req.body;

    if (!companyId || !email || !companyName || !plan) {
      return res.status(400).json({ message: "Missing data" });
    }

    // CHECK IF CUSTOMER EXISTS
    const [[company]] = await db.query(
      `SELECT zoho_customer_id FROM companies WHERE id=?`,
      [companyId]
    );

    let customerId = company?.zoho_customer_id;

    //CREATE CUSTOMER IF NOT EXISTS
    if (!customerId) {
      customerId = await createCustomer(companyName, email);
      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    let subscriptionId = null;

    if (plan === "free") {
      subscriptionId = await createTrial(customerId);
    } else if (plan === "business") {
      subscriptionId = await createBusinessSubscription(customerId);
    }

    await db.query(
      `UPDATE companies SET zoho_subscription_id=? WHERE id=?`,
      [subscriptionId, companyId]
    );

    return res.json({
      success: true,
      message: "Subscription initiated",
      subscriptionId
    });

  } catch (err) {
    console.error("PAYMENT ERROR:", err);
    res.status(500).json({ message: "Subscription failed" });
  }
});

export default router;
