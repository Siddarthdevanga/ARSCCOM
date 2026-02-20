import { db } from "../config/db.js";

/**
 * Subscription Guard Middleware
 * - Ensures company subscription is active or in trial
 * - Lazily expires subscriptions on each request (no cron dependency)
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
      `SELECT id, subscription_status, plan, trial_ends_at, subscription_ends_at
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

    /* ================= BLOCK NON-ACTIVE STATES IMMEDIATELY ================= */
    const allowedStatuses = ["trial", "active"];
    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({
        message: "Subscription inactive",
        status
      });
    }

    /* ================= LAZY EXPIRY CHECK FOR TRIAL ================= */
    if (status === "trial" && company.trial_ends_at && now > new Date(company.trial_ends_at)) {
      await db.execute(
        `UPDATE companies SET subscription_status = 'expired', updated_at = NOW() WHERE id = ?`,
        [company.id]
      );
      return res.status(403).json({
        message: "Subscription inactive",
        status: "expired"
      });
    }

    /* ================= LAZY EXPIRY CHECK FOR BUSINESS & ENTERPRISE ================= */
    // FIX: Both business and enterprise use subscription_ends_at
    if (
      status === "active" &&
      plan !== "trial" &&
      company.subscription_ends_at &&
      now > new Date(company.subscription_ends_at)
    ) {
      await db.execute(
        `UPDATE companies SET subscription_status = 'expired', updated_at = NOW() WHERE id = ?`,
        [company.id]
      );
      return res.status(403).json({
        message: "Subscription inactive",
        status: "expired"
      });
    }

    return next();
  } catch (err) {
    console.error("❌ SUBSCRIPTION GUARD ERROR:", err);
    return res.status(500).json({
      message: "Subscription validation failed"
    });
  }
};
