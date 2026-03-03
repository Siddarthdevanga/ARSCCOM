import jwt from "jsonwebtoken";
import * as service from "../services/superadmin.service.js";

const JWT_EXPIRY = "12h";

/* ======================================================
   FORGOT PASSWORD
   POST /api/superadmin/forgot-password
====================================================== */
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    await service.forgotPassword(email);
    return res.status(200).json({ success: true, message: "If the email exists, a reset code has been sent" });
  } catch (err) {
    console.error("SUPERADMIN FORGOT PASSWORD ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   RESET PASSWORD
   POST /api/superadmin/reset-password
====================================================== */
export const resetPassword = async (req, res) => {
  try {
    const email    = req.body?.email?.trim().toLowerCase();
    const code     = req.body?.code?.trim();
    const password = req.body?.password?.trim();

    if (!email || !code || !password) {
      return res.status(400).json({ success: false, message: "Email, code and password are required" });
    }

    await service.resetPassword({ email, code, password });
    return res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("SUPERADMIN RESET PASSWORD ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   LOGIN
   POST /api/superadmin/login
====================================================== */
export const login = async (req, res) => {
  try {
    const email    = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password?.trim();

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await service.superAdminLogin({ email, password });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: "superadmin" },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, name: user.name, role: "superadmin" },
    });
  } catch (err) {
    console.error("SUPERADMIN LOGIN ERROR:", err.message);
    return res.status(401).json({ success: false, message: err.message || "Login failed" });
  }
};

/* ======================================================
   DASHBOARD
   GET /api/superadmin/dashboard
====================================================== */
export const dashboard = async (req, res) => {
  try {
    const companies = await service.getDashboard();
    return res.status(200).json({ success: true, companies });
  } catch (err) {
    console.error("SUPERADMIN DASHBOARD ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load dashboard" });
  }
};

/* ======================================================
   COMPANY DETAIL
   GET /api/superadmin/companies/:id
====================================================== */
export const companyDetail = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    const company = await service.getCompanyDetail(companyId);
    return res.status(200).json({ success: true, company });
  } catch (err) {
    console.error("SUPERADMIN COMPANY DETAIL ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   COMPANY USERS
   GET /api/superadmin/companies/:id/users
====================================================== */
export const companyUsers = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    const users = await service.getCompanyUsers(companyId);
    return res.status(200).json({ success: true, users });
  } catch (err) {
    console.error("SUPERADMIN COMPANY USERS ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE COMPANY
   PATCH /api/superadmin/companies/:id/update
   body: { name?, newCompanyId?, userEmail?, newUserEmail? }
====================================================== */
export const updateCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    const { name, newCompanyId, userEmail, newUserEmail } = req.body;

    if (!name && !newCompanyId && !(userEmail && newUserEmail)) {
      return res.status(400).json({ success: false, message: "At least one field to update is required" });
    }

    if (newCompanyId && isNaN(parseInt(newCompanyId))) {
      return res.status(400).json({ success: false, message: "Invalid new company ID" });
    }

    if ((userEmail && !newUserEmail) || (!userEmail && newUserEmail)) {
      return res.status(400).json({ success: false, message: "Both userEmail and newUserEmail are required to update email" });
    }

    await service.updateCompany(companyId, { name, newCompanyId, userEmail, newUserEmail });
    return res.status(200).json({ success: true, message: "Company updated successfully" });
  } catch (err) {
    console.error("SUPERADMIN UPDATE COMPANY ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE PLAN
   PATCH /api/superadmin/companies/:id/plan
   body: { plan: "trial" | "business" | "enterprise" }
====================================================== */
export const updatePlan = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const { plan }  = req.body;

    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (!plan)             return res.status(400).json({ success: false, message: "plan is required" });

    await service.updatePlan(companyId, plan.toLowerCase());
    return res.status(200).json({ success: true, message: `Plan updated to ${plan}` });
  } catch (err) {
    console.error("SUPERADMIN UPDATE PLAN ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE SUBSCRIPTION STATUS
   PATCH /api/superadmin/companies/:id/status
   body: { status: "pending" | "trial" | "active" | "cancelled" | "expired" }
====================================================== */
export const updateStatus = async (req, res) => {
  try {
    const companyId  = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (!status)           return res.status(400).json({ success: false, message: "status is required" });

    await service.updateSubscriptionStatus(companyId, status.toLowerCase());
    return res.status(200).json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    console.error("SUPERADMIN UPDATE STATUS ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   EXTEND TRIAL
   PATCH /api/superadmin/companies/:id/extend-trial
   body: { trial_ends_at: "2025-12-31" }
====================================================== */
export const extendTrial = async (req, res) => {
  try {
    const companyId        = parseInt(req.params.id);
    const { trial_ends_at } = req.body;

    if (isNaN(companyId))  return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (!trial_ends_at)    return res.status(400).json({ success: false, message: "trial_ends_at is required" });

    await service.extendTrial(companyId, trial_ends_at);
    return res.status(200).json({ success: true, message: `Trial extended to ${trial_ends_at}` });
  } catch (err) {
    console.error("SUPERADMIN EXTEND TRIAL ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE SUBSCRIPTION DATES
   PATCH /api/superadmin/companies/:id/subscription-dates
   body: { subscription_ends_at: "2025-12-31", subscription_start?: "2025-01-01" }
====================================================== */
export const updateSubscriptionDates = async (req, res) => {
  try {
    const companyId                              = parseInt(req.params.id);
    const { subscription_ends_at, subscription_start } = req.body;

    if (isNaN(companyId))       return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (!subscription_ends_at)  return res.status(400).json({ success: false, message: "subscription_ends_at is required" });

    await service.updateSubscriptionDates(companyId, { subscription_ends_at, subscription_start });
    return res.status(200).json({ success: true, message: "Subscription dates updated" });
  } catch (err) {
    console.error("SUPERADMIN UPDATE DATES ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   FORCE CANCEL
   POST /api/superadmin/companies/:id/force-cancel
====================================================== */
export const forceCancel = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.forceCancel(companyId);
    return res.status(200).json({ success: true, message: "Subscription force cancelled" });
  } catch (err) {
    console.error("SUPERADMIN FORCE CANCEL ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   SUSPEND / UNSUSPEND
   POST /api/superadmin/companies/:id/suspend
   POST /api/superadmin/companies/:id/unsuspend
====================================================== */
export const suspendCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.setSuspension(companyId, true);
    return res.status(200).json({ success: true, message: "Company suspended" });
  } catch (err) {
    console.error("SUPERADMIN SUSPEND ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const unsuspendCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.setSuspension(companyId, false);
    return res.status(200).json({ success: true, message: "Company unsuspended" });
  } catch (err) {
    console.error("SUPERADMIN UNSUSPEND ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   DELETE COMPANY
   DELETE /api/superadmin/companies/:id
====================================================== */
export const deleteCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.deleteCompany(companyId);
    return res.status(200).json({ success: true, message: "Company and all related data permanently deleted" });
  } catch (err) {
    console.error("SUPERADMIN DELETE COMPANY ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};
