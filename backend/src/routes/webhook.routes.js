import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/**
 * SECURITY:
 * Protect webhook using custom header
 * Set same key in Zoho Webhook:
 *
 * Header Key  : X-WEBHOOK-KEY
 * Header Value: PROMEET_WEBHOOK_KEY   (or env)
 */
const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY || "PROMEET_WEBHOOK_KEY";

router.post("/", async (req, res) => {
  try {
    /* ================= SECURITY ================= */
    const key = req.headers["x-webhook-key"];
    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ Webhook rejected — invalid key");
      return res.status(401).json({ message: "Unauthorized webhook" });
    }

    const event = req.body?.event_type;
    const data = req.body?.data;

    if (!event || !data) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    console.log("🔔 ZOHO WEBHOOK EVENT:", event);

    const subscription = data?.subscription || {};
    const customer = data?.customer || {};

    const zohoSubId = subscription?.subscription_id || null;
    const zohoCustomerId =
      customer?.customer_id || subscription?.customer_id || null;

    const email = customer?.email;
    const companyName = customer?.display_name || "Your Company";

    /* ======================================================
       TRIAL ACTIVATED
    ====================================================== */
    if (
      event === "subscription_trial_started" ||
      subscription?.status === "trial"
    ) {
      await db.query(
        `
        UPDATE companies 
        SET 
          plan='trial',
          subscription_status='trial',
          zoho_subscription_id=?,
          zoho_customer_id=?
        WHERE zoho_customer_id=? OR email=? LIMIT 1
        `,
        [zohoSubId, zohoCustomerId, zohoCustomerId, email || ""]
      );

      console.log("✅ Trial Activated");

      // ---------------- EMAIL ----------------
      if (email) {
        await sendEmail({
          to: email,
          subject: "🎉 Your PROMEET 15-Day Trial is Activated",
          html: `
          <h2 style="color:#6c2bd9;">PROMEET Trial Activated 🎉</h2>
          <p>Hello,</p>
          <p>Your company <b>${companyName}</b> is now on a <b>15-day Free Trial</b>.</p>

          <h3>🚀 You can now:</h3>
          <ul>
            <li>Manage Visitors</li>
            <li>Book Conference Rooms</li>
            <li>Access Admin Dashboard</li>
          </ul>

          <p>
            Once your trial ends, you can upgrade anytime from your dashboard.
          </p>

          <br/>
          <p>Regards,<br/><b>PROMEET Team</b></p>

          <hr/>
          <p style="font-size:12px;color:#777">
            This is an auto-generated email. Do not reply.
          </p>
        `
        });
      }

      return res.json({ message: "Trial updated" });
    }

    /* ======================================================
       PAYMENT SUCCESS / SUBSCRIPTION ACTIVE
    ====================================================== */
    if (
      event === "subscription_activated" ||
      event === "payment_succeeded" ||
      subscription?.status === "active"
    ) {
      await db.query(
        `
        UPDATE companies 
        SET 
          subscription_status='active',
          plan='business',
          zoho_subscription_id=?,
          zoho_customer_id=?
        WHERE zoho_customer_id=? OR email=? LIMIT 1
        `,
        [zohoSubId, zohoCustomerId, zohoCustomerId, email || ""]
      );

      console.log("✅ Subscription Activated");

      // ---------------- EMAIL ----------------
      if (email) {
        await sendEmail({
          to: email,
          subject: "✅ PROMEET Subscription Activated Successfully",
          html: `
          <h2 style="color:#22aa22;">Subscription Activated ✔️</h2>

          <p>Hello,</p>
          <p>Your subscription for <b>${companyName}</b> is now <b>Active</b>.</p>

          <h3>🎯 What Happens Next?</h3>
          <ul>
            <li>Your platform access is fully unlocked</li>
            <li>No feature restrictions</li>
            <li>Business plan benefits enabled</li>
          </ul>

          <h3>📄 Important</h3>
          <p>
            Please ensure your company PAN & Billing details are updated
            in your PROMEET dashboard to avoid any invoice issues.
          </p>

          <br/>
          <p>Regards,<br/><b>PROMEET Team</b></p>

          <hr/>
          <p style="font-size:12px;color:#777">
            This is an auto-generated email. Do not reply.
          </p>
        `
        });
      }

      return res.json({ message: "Subscription activated" });
    }

    /* ======================================================
       SUBSCRIPTION CANCELLED
    ====================================================== */
    if (
      event === "subscription_cancelled" ||
      subscription?.status === "cancelled"
    ) {
      await db.query(
        `
        UPDATE companies 
        SET subscription_status='cancelled'
        WHERE zoho_subscription_id=? LIMIT 1
        `,
        [zohoSubId]
      );

      console.log("❌ Subscription Cancelled");

      // ---------------- EMAIL ----------------
      if (email) {
        await sendEmail({
          to: email,
          subject: "⚠️ PROMEET Subscription Cancelled",
          html: `
          <h2 style="color:#dd2222;">Subscription Cancelled ⚠️</h2>

          <p>Hello,</p>

          <p>
            Your PROMEET subscription for <b>${companyName}</b> has been cancelled.
          </p>

          <p>
            Platform access may be restricted. If this was a mistake,
            you can reactivate your subscription anytime.
          </p>

          <br/>
          <p>Regards,<br/><b>PROMEET Team</b></p>

          <hr/>
          <p style="font-size:12px;color:#777">
            This is an auto-generated email. Do not reply.
          </p>
        `
        });
      }

      return res.json({ message: "Subscription cancelled" });
    }

    console.log("ℹ️ Unhandled event:", event);
    res.json({ message: "No action taken" });

  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

export default router;
