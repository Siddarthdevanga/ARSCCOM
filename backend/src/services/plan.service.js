import { db } from "../config/db.js";

export const getPlanUsage = async (companyId) => {
  const [[company]] = await db.execute(
    `
    SELECT plan, trial_ends_at, subscription_ends_at,
           grace_period_ends_at, grace_period_day
    FROM companies
    WHERE id = ?
    `,
    [companyId]
  );

  if (!company) throw new Error("Company not found");

  const PLAN = (company.plan || "TRIAL").toUpperCase();

  // Check if in grace period
  const inGracePeriod = company.grace_period_ends_at &&
                        new Date(company.grace_period_ends_at) > new Date();

  // Calculate grace period days remaining
  let gracePeriodDaysRemaining = 0;
  if (inGracePeriod) {
    const endsAt = new Date(company.grace_period_ends_at);
    const now = new Date();
    gracePeriodDaysRemaining = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
  }

  // BUSINESS / ENTERPRISE
  if (PLAN !== "TRIAL") {
    return {
      plan: PLAN,
      limit: "UNLIMITED",
      used: null,
      remaining: null,
      trialEndsAt: null,
      inGracePeriod,
      gracePeriodDay: company.grace_period_day || 0,
      gracePeriodDaysRemaining,
      gracePeriodEndsAt: inGracePeriod ? company.grace_period_ends_at : null,
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
    trialEndsAt: company.trial_ends_at,
    inGracePeriod,
    gracePeriodDay: company.grace_period_day || 0,
    gracePeriodDaysRemaining,
    gracePeriodEndsAt: inGracePeriod ? company.grace_period_ends_at : null,
  };
};
