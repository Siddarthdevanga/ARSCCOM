import express from "express";
import { createPendingSignup } from "../services/razorpay.service.js";

const router = express.Router();

/* ======================================================
   POST /api/razorpay/pending-signup
   --------------------------------------------------------
   Public — called by the landing-page popup before redirecting to
   the Razorpay payment link. Stores Name/Email/Phone so the webhook
   (which only ever gets a phone number back from Razorpay) can look
   the submission up and create the account with a real name/email.
====================================================== */
router.post("/pending-signup", async (req, res) => {
  try {
    const { name, email, phone } = req.body || {};
    const result = await createPendingSignup({ name, email, phone });

    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err?.message || "Failed to save details",
    });
  }
});

export default router;
