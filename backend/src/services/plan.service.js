import { db } from "../config/db.js";

export const getPlanUsage = async (companyId) => {
  const [[company]] = await db.execute(
    `
    SELECT plan, trial_ends_at, subscription_ends_at
    FROM companies
    WHERE id = ?
    `,
    [companyId]
  );

  if (!company) throw new Error("Company not found");

  const PLAN = (company.plan || "TRIAL").toUpperCase();

  // BUSINESS / ENTERPRISE
  if (PLAN !== "TRIAL") {
    return {
      plan: PLAN,
      limit: "UNLIMITED",
      used: null,
      remaining: null,
      trialEndsAt: null
    };
  }

  // TRIAL USERS
  const [[countRow]] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM visitors
      WHERE company_id = ?
    `,
    [companyId]
  );

  return {
    plan: "TRIAL",
    limit: 100,
    used: countRow.total,
    remaining: Math.max(0, 100 - countRow.total),
    trialEndsAt: company.trial_ends_at
  };
};
