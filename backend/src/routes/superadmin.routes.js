import express from "express";
import { authenticateSuperAdmin } from "../middlewares/superadmin.middleware.js";
import * as ctrl from "../controllers/superadmin.controller.js";

const router = express.Router();

/* ======================================================
   PUBLIC — no auth
====================================================== */

// POST /api/superadmin/login
router.post("/login", ctrl.login);

// POST /api/superadmin/forgot-password
router.post("/forgot-password", ctrl.forgotPassword);

// POST /api/superadmin/reset-password
router.post("/reset-password", ctrl.resetPassword);

/* ======================================================
   PROTECTED — superadmin JWT required
====================================================== */
router.use(authenticateSuperAdmin);

// GET  /api/superadmin/dashboard
router.get("/dashboard", ctrl.dashboard);

// GET  /api/superadmin/companies/:id
router.get("/companies/:id", ctrl.companyDetail);

// PATCH /api/superadmin/companies/:id/plan
router.patch("/companies/:id/plan", ctrl.updatePlan);

// PATCH /api/superadmin/companies/:id/status
router.patch("/companies/:id/status", ctrl.updateStatus);

// PATCH /api/superadmin/companies/:id/extend-trial
router.patch("/companies/:id/extend-trial", ctrl.extendTrial);

// PATCH /api/superadmin/companies/:id/subscription-dates
router.patch("/companies/:id/subscription-dates", ctrl.updateSubscriptionDates);

// POST  /api/superadmin/companies/:id/force-cancel
router.post("/companies/:id/force-cancel", ctrl.forceCancel);

// POST  /api/superadmin/companies/:id/suspend
router.post("/companies/:id/suspend", ctrl.suspendCompany);

// POST  /api/superadmin/companies/:id/unsuspend
router.post("/companies/:id/unsuspend", ctrl.unsuspendCompany);

// DELETE /api/superadmin/companies/:id
router.delete("/companies/:id", ctrl.deleteCompany);

export default router;
