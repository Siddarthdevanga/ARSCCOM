const [rows] = await db.query(
  `SELECT id, subscription_status, plan, trial_ends_at, subscription_ends_at 
   FROM companies WHERE id = ? LIMIT 1`,
  [companyId]
);

const company = rows?.[0];
const status = company.subscription_status?.toLowerCase() ?? "unknown";
const now = new Date();

const allowedStatuses = ["trial", "active"];
if (!allowedStatuses.includes(status)) {
  return res.status(403).json({ message: "Subscription inactive", status });
}

// Check trial expiry
if (status === "trial" && company.trial_ends_at && now > new Date(company.trial_ends_at)) {
  await db.execute(`UPDATE companies SET subscription_status = 'expired' WHERE id = ?`, [company.id]);
  return res.status(403).json({ message: "Subscription inactive", status: "expired" });
}

// Check paid plan expiry (business / enterprise)
if (status === "active" && company.subscription_ends_at && now > new Date(company.subscription_ends_at)) {
  await db.execute(`UPDATE companies SET subscription_status = 'expired' WHERE id = ?`, [company.id]);
  return res.status(403).json({ message: "Subscription inactive", status: "expired" });
}

return next();
