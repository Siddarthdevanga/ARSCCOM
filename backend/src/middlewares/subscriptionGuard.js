import { db } from "../config/db.js";

/**
 * Subscription Guard Middleware
 * - Ensures company subscription is active, trial, or in grace period
 * - Grace period: 10 days after subscription expiration
 * - Blocks access only after grace period ends
 * - Handles trial, business, and enterprise plan expiry
 */
export const subscriptionGuard = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized — company missing" });
    }

    /* ================= DB FETCH ================= */
    const [rows] = await db.query(
      `SELECT id, subscription_status, plan, trial_ends_at, subscription_ends_at,
              grace_period_ends_at, grace_period_day
       FROM companies
       WHERE id = ?
       LIMIT 1`,
      [companyId]
    );

    const company = rows?.[0];
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const status = company.subscription_status?.toLowerCase() ?? "unknown";
    const plan = company.plan?.toLowerCase() ?? "trial";
    const now = new Date();

    /* ================= ALLOW ACTIVE STATUSES INCLUDING GRACE PERIOD ================= */
    const allowedStatuses = ["trial", "active", "grace_period"];

    // If in grace period, check if it's still valid
    if (status === "grace_period") {
      if (company.grace_period_ends_at && now <= new Date(company.grace_period_ends_at)) {
        // Grace period is still valid - allow access
        return next();
      } else {
        // Grace period expired - block access (will be updated by cron)
        return res.status(403).json({
          message: "Your grace period has ended. Please renew your subscription to continue.",
          status: "expired",
          gracePeriodEnded: true
        });
      }
    }

    // Block non-allowed statuses
    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({
        message: "Subscription inactive",
        status
      });
    }

    /* ================= LAZY EXPIRY CHECK FOR TRIAL ================= */
    // Note: Expiry initiation is now handled by cron job
    // This is just a safety check
    if (status === "trial" && company.trial_ends_at && now > new Date(company.trial_ends_at)) {
      // Let the cron job handle grace period initiation
      // For now, allow access (cron will update status shortly)
      return next();
    }

    /* ================= LAZY EXPIRY CHECK FOR BUSINESS & ENTERPRISE ================= */
    // Note: Expiry initiation is now handled by cron job
    // This is just a safety check
    if (
      status === "active" &&
      plan !== "trial" &&
      company.subscription_ends_at &&
      now > new Date(company.subscription_ends_at)
    ) {
      // Let the cron job handle grace period initiation
      // For now, allow access (cron will update status shortly)
      return next();
    }

    return next();
  } catch (err) {
    console.error("❌ SUBSCRIPTION GUARD ERROR:", err);
    return res.status(500).json({
      message: "Subscription validation failed"
    });
  }
};
