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
        grace_period_day
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
    const ZOHO_ID = company.zoho_customer_id || null;

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

      ZOHO_CUSTOMER_ID: ZOHO_ID,

      TRIAL_ENDS_ON:  company.trial_ends_at           || null,
      EXPIRES_ON:     company.subscription_ends_at     || null,
      LAST_PAID_ON:   company.last_payment_created_at  || null,

      IN_GRACE_PERIOD:              inGracePeriod,
      GRACE_PERIOD_ENDS_ON:         inGracePeriod ? company.grace_period_ends_at : null,
      GRACE_PERIOD_DAYS_REMAINING:  gracePeriodDaysRemaining,
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
