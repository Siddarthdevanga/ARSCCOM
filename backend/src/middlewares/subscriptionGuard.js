export const subscriptionGuard = (req, res, next) => {
  const company = req.company;

  if (!company) {
    return res.status(401).json({ message: "Company not found" });
  }

  if (!["trial", "active"].includes(company.subscription_status)) {
    return res
      .status(403)
      .json({ message: "Subscription Required" });
  }

  next();
};
