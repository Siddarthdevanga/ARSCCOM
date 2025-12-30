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
        success: false,
        message: "Unauthorized"
      });
    }

    const [[company]] = await db.query(
      `
      SELECT 
        plan,
        subscription_status,
        zoho_customer_id,
        subscription_expires_at,
        last_payment_at
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    return res.json({
      success: true,
      plan: company.plan || "free",
      status: company.subscription_status || "inactive",
      zohoCustomerId: company.zoho_customer_id || null,
      expiresOn: company.subscription_expires_at || null,
      lastPaidOn: company.last_payment_at || null
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION FETCH ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription"
    });
  }
});

export default router;
