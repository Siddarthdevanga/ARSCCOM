import express from "express";
import { authenticateSuperAdmin } from "../middlewares/superadmin.middleware.js";
import * as ctrl from "../controllers/superadmin.controller.js";

const router = express.Router();

/* ======================================================
   PUBLIC — no auth required
====================================================== */
router.post("/login",           ctrl.login);
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password",  ctrl.resetPassword);

/* ======================================================
   PROTECTED — superadmin JWT required
====================================================== */
router.use(authenticateSuperAdmin);

// ── Dashboard ──────────────────────────────────────────
router.get("/dashboard", ctrl.dashboard);

// ── Company ────────────────────────────────────────────
router.get   ("/companies/:id",                   ctrl.companyDetail);
router.get   ("/companies/:id/users",             ctrl.companyUsers);
router.patch ("/companies/:id/update",            ctrl.updateCompany);
router.patch ("/companies/:id/plan",              ctrl.updatePlan);
router.patch ("/companies/:id/status",            ctrl.updateStatus);
router.patch ("/companies/:id/extend-trial",      ctrl.extendTrial);
router.patch ("/companies/:id/subscription-dates",ctrl.updateSubscriptionDates);
router.post  ("/companies/:id/force-cancel",      ctrl.forceCancel);
router.post  ("/companies/:id/suspend",           ctrl.suspendCompany);
router.post  ("/companies/:id/unsuspend",         ctrl.unsuspendCompany);
router.delete("/companies/:id",                   ctrl.deleteCompany);

export default router;
