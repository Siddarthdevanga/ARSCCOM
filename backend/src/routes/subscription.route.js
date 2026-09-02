import express from "express";
import { db } from "../config/db.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * Get Subscription Details
 */
router.get("/details", authenticate, async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        SUCCESS: false,
        MESSAGE: "Unauthorized"
      });
    }

    const [[company]] = await db.query(
      `
      SELECT
        plan,
        subscription_status,
        zoho_customer_id,
        trial_ends_at,
        subscription_ends_at,
        last_payment_created_at,
        grace_period_ends_at,
        grace_period_day,
        razorpay_auto_debit_active,
        razorpay_customer_id,
        razorpay_subscription_id,
        billing_interval,
        pending_upgrade_plan,
        pending_billing_interval
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        SUCCESS: false,
        MESSAGE: "Company not found"
      });
    }

    const PLAN   = company.plan ? company.plan.toUpperCase() : "TRIAL";
    const STATUS = company.subscription_status
      ? company.subscription_status.toUpperCase()
      : "PENDING";
    // Once a company has a Razorpay customer id, that's the one relevant to
    // whoever's actually billing them now — show it in place of any old
    // Zoho id rather than alongside it.
    const CUSTOMER_ID = company.razorpay_customer_id || company.zoho_customer_id || null;

    // Compute grace period info
    const now = new Date();
    const inGracePeriod = STATUS === "GRACE_PERIOD" &&
                          company.grace_period_ends_at &&
                          new Date(company.grace_period_ends_at) > now;

    let gracePeriodDaysRemaining = 0;
    if (inGracePeriod) {
      gracePeriodDaysRemaining = Math.max(
        0,
        Math.ceil((new Date(company.grace_period_ends_at) - now) / (1000 * 60 * 60 * 24))
      );
    }

    return res.json({
      SUCCESS: true,

      PLAN,
      STATUS,

      CUSTOMER_ID,

      TRIAL_ENDS_ON:  company.trial_ends_at           || null,
      EXPIRES_ON:     company.subscription_ends_at     || null,
      LAST_PAID_ON:   company.last_payment_created_at  || null,

      IN_GRACE_PERIOD:              inGracePeriod,
      GRACE_PERIOD_ENDS_ON:         inGracePeriod ? company.grace_period_ends_at : null,
      GRACE_PERIOD_DAYS_REMAINING:  gracePeriodDaysRemaining,

      // Verified live Razorpay auto-debit mandate (webhook-confirmed, not
      // just "an id happens to be stored") — drives whether the "Renew"
      // action is shown at all on the home dashboard.
      HAS_AUTO_DEBIT: !!company.razorpay_auto_debit_active,

      // A trial's mandate is authorized immediately but stays unconfirmed
      // (auto_debit_active only flips to 1 at the real day-15 conversion),
      // so HAS_AUTO_DEBIT alone can't signal "there's something to cancel"
      // during the trial window — this can.
      HAS_TRIAL_MANDATE: company.plan === "trial" && !!company.razorpay_subscription_id,

      // Actual current billing cycle — needed to know whether a Monthly →
      // Annual switch is still a real available option for this company.
      BILLING_INTERVAL: company.billing_interval || "monthly",

      // Set by updateSubscriptionPlan() when a plan/interval change has
      // been scheduled on an existing mandate (takes effect next cycle).
      PENDING_UPGRADE_PLAN:     company.pending_upgrade_plan || null,
      PENDING_BILLING_INTERVAL: company.pending_billing_interval || null,
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION FETCH ERROR:", err);

    return res.status(500).json({
      SUCCESS: false,
      MESSAGE: "Failed to fetch subscription"
    });
  }
});

export default router;
