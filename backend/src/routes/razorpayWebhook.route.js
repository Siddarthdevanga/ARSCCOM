import express from "express";
import { verifyRazorpaySignature, handlePaymentLinkPaid } from "../services/razorpay.service.js";

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

    // Razorpay sends every subscribed event to this same URL (cancelled,
    // expired, payment.failed, etc. if "all events" is selected in their
    // dashboard) — only payment_link.paid should trigger account creation.
    if (event !== "payment_link.paid") {
      return res.json({ received: true, ignored: event });
    }

    const result = await handlePaymentLinkPaid(req.body?.payload || {});
    console.log("✅ RAZORPAY WEBHOOK PROCESSED:", result);

    return res.json({ received: true, ...result });
  } catch (err) {
    console.error("❌ RAZORPAY WEBHOOK ERROR:", err);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
