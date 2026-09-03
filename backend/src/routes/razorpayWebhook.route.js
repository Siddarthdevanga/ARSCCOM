import express from "express";
import { verifyRazorpaySignature, handlePaymentCaptured } from "../services/razorpay.service.js";
import { handleSubscriptionWebhookEvent } from "../services/razorpaySubscription.service.js";
import { handleSubscriptionAuthenticated } from "../services/razorpayTrialSubscription.service.js";

const router = express.Router();

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.activated",
  "subscription.charged",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
]);

router.post("/", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    // Same webhook URL/secret handles the one-time trial Order (landing
    // page), Path B's trial mandate, and Business/Enterprise Subscriptions
    // — same Razorpay account, one less secret to manage.
    if (!verifyRazorpaySignature(req.rawBody, signature)) {
      console.log("❌ INVALID RAZORPAY WEBHOOK SIGNATURE");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const event = req.body?.event;
    console.log("🔥 RAZORPAY WEBHOOK HIT —", event);

    // Landing-page popup's one-time ₹49 trial Order — no mandate, no
    // auto-conversion. Only path that still creates an account off this
    // event (Path B's account already exists before its own webhook fires).
    if (event === "payment.captured") {
      const result = await handlePaymentCaptured(req.body?.payload || {});
      console.log("✅ RAZORPAY PAYMENT WEBHOOK PROCESSED:", result);
      return res.json({ received: true, ...result });
    }

    // Path B — a web-registered company's trial mandate (authorized but
    // not yet billing; real ₹500 conversion happens later via
    // subscription.activated/charged below).
    if (event === "subscription.authenticated") {
      const result = await handleSubscriptionAuthenticated(req.body?.payload || {});
      console.log("✅ RAZORPAY TRIAL WEBHOOK PROCESSED:", result);
      return res.json({ received: true, ...result });
    }

    if (SUBSCRIPTION_EVENTS.has(event)) {
      const result = await handleSubscriptionWebhookEvent(event, req.body?.payload || {});
      console.log("✅ RAZORPAY SUBSCRIPTION WEBHOOK PROCESSED:", result);
      return res.json({ received: true, ...result });
    }

    // Razorpay sends every subscribed event to this same URL if "all
    // events" is selected in their dashboard — anything else is ignored.
    return res.json({ received: true, ignored: event });
  } catch (err) {
    console.error("❌ RAZORPAY WEBHOOK ERROR:", err);
    return res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
