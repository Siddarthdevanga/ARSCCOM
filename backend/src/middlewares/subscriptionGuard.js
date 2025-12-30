import { db } from "../config/db.js";

/**
 * Subscription Guard Middleware
 * - Ensures company subscription is active or in trial
 * - Blocks pending, expired, cancelled, or unknown states
 */
export const subscriptionGuard = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized — company missing" });
    }

    /* ================= DB FETCH ================= */
    const [rows] = await db.query(
      `SELECT id, subscription_status 
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

    /* ================= VALID SUBSCRIPTION STATES ================= */
    const allowedStatuses = ["trial", "active"];

    if (allowedStatuses.includes(status)) {
      return next();
    }

    /* ================= BLOCKED STATES ================= */
    // pending  -> signed up but never paid
    // expired  -> failed payment / ended trial
    // cancelled -> user cancelled plan
    // anything else -> invalid / unknown
    return res.status(403).json({
      message: "Subscription inactive",
      status, // helpful for frontend flow handling
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION GUARD ERROR:", err);
    return res.status(500).json({
      message: "Subscription validation failed",
    });
  }
};
