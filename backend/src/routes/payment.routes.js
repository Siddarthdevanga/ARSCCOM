import express from "express";
import { db } from "../config/db.js";
import { getZohoToken } from "../services/zohoToken.js";
import axios from "axios";

const router = express.Router();

/**
 * PLAN MAPPING
 */
const PLANS = {
  free: {
    plan_code: "1",          // ZOHO TRIAL PLAN CODE
    type: "trial"
  },
  business: {
    plan_code: "BUSINESS_CODE",  // put Zoho plan code
    type: "paid"
  }
};

router.post("/pay", async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const [[company]] = await db.query(
      "SELECT name,email,zoho_customer_id FROM companies WHERE id=?",
      [companyId]
    );

    if (!company) return res.status(404).json({ message: "Company not found" });

    const token = await getZohoToken();

    /* ======================================================
       TRIAL PLAN → DIRECT CREATE SUBSCRIPTION
    ====================================================== */
    if (plan === "free") {
      const payload = {
        customer_id: company.zoho_customer_id,
        plan: { plan_code: PLANS.free.plan_code }
      };

      const result = await axios.post(
        `${process.env.ZOHO_API_BASE}/subscriptions`,
        payload,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );

      const sub = result.data.subscription;

      await db.query(
        `
        UPDATE companies 
        SET plan='trial',
            subscription_status='trial',
            zoho_subscription_id=?
        WHERE id=?
        `,
        [sub.subscription_id, companyId]
      );

      return res.json({
        message: "Trial started",
        url: "/dashboard"
      });
    }

    /* ======================================================
       BUSINESS → CREATE PAYMENT LINK
    ====================================================== */
    const payload = {
      customer_id: company.zoho_customer_id,
      amount: 500,
      description: "Business Plan Subscription"
    };

    const payment = await axios.post(
      `${process.env.ZOHO_API_BASE}/paymentlinks`,
      payload,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );

    return res.json({ url: payment.data.payment_link.url });

  } catch (err) {
    console.error("PAYMENT ERROR", err?.response?.data || err);
    res.status(500).json({ message: "Payment processing failed" });
  }
});

export default router;
