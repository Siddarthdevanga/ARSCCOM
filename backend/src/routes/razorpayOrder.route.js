import express from "express";
import { createTrialOrder } from "../services/razorpay.service.js";

const router = express.Router();

/* ======================================================
   POST /api/razorpay/create-order
   --------------------------------------------------------
   Public — called by the landing-page popup right before opening
   Razorpay's embedded Checkout.js modal. Creates a Razorpay Order for
   the fixed ₹49 trial amount, stamping the visitor's email/phone onto
   it as `notes` so the payment.captured webhook can read them back
   (the webhook payload itself only carries an order_id, not notes).
====================================================== */
router.post("/create-order", async (req, res) => {
  try {
    const { email, phone } = req.body || {};
    const order = await createTrialOrder({ email, phone });

    return res.status(201).json({ success: true, ...order });
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
