import express from "express";
import { verifyRazorpaySignature, handlePaymentCaptured } from "../services/razorpay.service.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    if (!verifyRazorpaySignature(req.rawBody, signature)) {
      console.log("❌ INVALID RAZORPAY WEBHOOK SIGNATURE");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const event = req.body?.event;
    console.log("🔥 RAZORPAY WEBHOOK HIT —", event);

    // Razorpay sends every subscribed event to this same URL (payment.failed,
    // refund.processed, etc. if "all events" is selected in their dashboard)
    // — only payment.captured should trigger account creation. The Hai
    // Visitor trial signup uses a Razorpay Payment Page (not a Payment
    // Link), which creates a standard payment rather than a payment-link
    // entity, so this listens for the standard payment-captured event.
    if (event !== "payment.captured") {
      return res.json({ received: true, ignored: event });
    }

    const result = await handlePaymentCaptured(req.body?.payload || {});
    console.log("✅ RAZORPAY WEBHOOK PROCESSED:", result);

    return res.json({ received: true, ...result });
  } catch (err) {
    console.error("❌ RAZORPAY WEBHOOK ERROR:", err);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
