import { db } from "../config/db.js";

export const subscriptionGuard = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId)
      return res.status(401).json({ message: "Company not found" });

    const [[company]] = await db.query(
      `SELECT subscription_status 
       FROM companies 
       WHERE id=? LIMIT 1`,
      [companyId]
    );

    if (!company)
      return res.status(404).json({ message: "Company not found" });

    if (!["active", "trial"].includes(company.subscription_status)) {
      return res
        .status(403)
        .json({ message: "Subscription inactive. Please upgrade plan." });
    }

    next();
  } catch (err) {
    console.error("SUBSCRIPTION GUARD ERROR", err);
    res.status(500).json({ message: "Subscription validation failed" });
  }
};
