import express from "express";
import { createTrialOrder } from "../services/razorpay.service.js";

const router = express.Router();

/* ======================================================
   POST /api/razorpay/create-order
   --------------------------------------------------------
   Public — called by the landing-page popup right before opening
   Razorpay's embedded Checkout.js modal. One-time ₹49 Order — no
   recurring mandate, no auto-conversion. A trial customer from this
   path must manually pick a plan (Business/Enterprise) after their
   15 days.
====================================================== */
router.post("/create-order", async (req, res) => {
  try {
    const { email, phone } = req.body || {};
    const order = await createTrialOrder({ email, phone });

    return res.status(201).json({ success: true, mode: "order", ...order });
  } catch (err) {
    if (err.code === "ALREADY_REGISTERED") {
      return res.status(409).json({ success: false, code: "already_registered", message: err.message });
    }
    console.error("[RAZORPAY] create-order failed:", err.response?.data || err.message);
    return res.status(400).json({
      success: false,
      message: err?.response?.data?.error?.description || err?.message || "Failed to start payment",
    });
  }
});

export default router;
