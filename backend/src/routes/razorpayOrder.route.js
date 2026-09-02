import express from "express";
import { createTrialSubscription } from "../services/razorpayTrialSubscription.service.js";

const router = express.Router();

/* ======================================================
   POST /api/razorpay/create-order
   --------------------------------------------------------
   Public — called by the landing-page popup right before opening
   Razorpay's embedded Checkout.js modal. Despite the URL (kept as-is so
   the frontend needed no route change), this now authorizes a real
   Razorpay Subscription against the trial-origin Business Monthly plan
   — mandate + ₹49 collected now, real ₹500/mo billing delayed 15 days
   via start_at. Fully replaces the old one-time Orders-API trial.
====================================================== */
router.post("/create-order", async (req, res) => {
  try {
    const { email, phone } = req.body || {};
    const subscription = await createTrialSubscription({ email, phone });

    return res.status(201).json({ success: true, mode: "subscription", ...subscription });
  } catch (err) {
    if (err.code === "ALREADY_REGISTERED") {
      return res.status(409).json({ success: false, code: "already_registered", message: err.message });
    }
    console.error("[RAZORPAY-TRIAL] create-order failed:", err.response?.data || err.message);
    return res.status(400).json({
      success: false,
      message: err?.response?.data?.error?.description || err?.message || "Failed to start payment",
    });
  }
});

export default router;
