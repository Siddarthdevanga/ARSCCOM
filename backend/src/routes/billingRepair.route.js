import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/**
 * Billing Repair
 * Fetch past customers from Zoho → Sync DB
 */
router.get("/run", async (req, res) => {
  try {
    console.log("🛠 Running Billing Repair...");

    // Example: find pending companies
    const [rows] = await db.query(
      `SELECT id, name, zoho_customer_id, subscription_status 
       FROM companies 
       WHERE subscription_status = 'pending'`
    );

    console.log("📦 Companies Found:", rows.length);

    // TODO: your zoho sync logic here...
    // loop → fetch zoho → update DB

    return res.json({
      success: true,
      message: "Billing Repair Executed",
      companiesChecked: rows.length
    });

  } catch (err) {
    console.error("❌ Billing Repair Failed", err);
    return res.status(500).json({
      success: false,
      message: "Billing Repair Failed",
      error: err.message
    });
  }
});

export default router;
