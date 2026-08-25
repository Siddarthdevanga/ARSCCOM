import express from "express";
import { db } from "../config/db.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createTrialOrderForExistingCompany } from "../services/razorpay.service.js";
import { createSubscription } from "../services/razorpaySubscription.service.js";

const router = express.Router();

/**
 * SUBSCRIPTION PAYMENT FLOW — Razorpay (full replacement of the old Zoho
 * payment-link flow, kept at the same route/response shape the frontend
 * already calls).
 *
 * TRIAL                 → one-time ₹49 Razorpay Order (never recurring)
 * BUSINESS / ENTERPRISE → real Razorpay Subscription (auto-debit)
 *
 * Trial activates via the payment.captured webhook (razorpay.service.js).
 * Business/Enterprise activates via the subscription.activated/charged
 * webhook (razorpaySubscription.service.js) once the customer authorizes
 * the mandate in the checkout modal.
 */

router.post("/subscribe", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    const interval = req.body.interval === "annual" ? "annual" : "monthly";
    const companyId = req.user?.companyId;

    if (!plan) return res.status(400).json({ success: false, message: "Plan is required" });
    if (!["free", "business", "enterprise"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan selected" });
    }
    if (!companyId) return res.status(401).json({ success: false, message: "Authentication failed" });

    const [[company]] = await db.query(
      `SELECT subscription_status FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const status = (company.subscription_status || "").toLowerCase();
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({ success: false, message: "Subscription already active" });
    }

    if (plan === "free") {
      const order = await createTrialOrderForExistingCompany(companyId);
      return res.json({ success: true, mode: "order", ...order });
    }

    const subscription = await createSubscription({ companyId, plan, interval });
    return res.json({ success: true, mode: "subscription", ...subscription });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR →", err?.response?.data || err);
    return res.status(500).json({
      success: false,
      message: err?.response?.data?.error?.description || err?.message || "Subscription failed",
    });
  }
});

export default router;
