import express from "express";
import { authenticateSuperAdmin, requireFullSuperAdmin } from "../middlewares/superadmin.middleware.js";
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
   (either full 'superadmin' or the restricted 'superadmin_readonly' role)
====================================================== */
router.use(authenticateSuperAdmin);

// ── Landing Page Conversions — the ONLY route the read-only sub-role
//    can reach; every route below this requires full superadmin ────
router.get("/razorpay-signups", ctrl.razorpaySignups);

/* ======================================================
   FULL SUPERADMIN ONLY — everything past this point
====================================================== */
router.use(requireFullSuperAdmin);

// ── Dashboard ──────────────────────────────────────────
router.get("/dashboard", ctrl.dashboard);

// ── Sub-Admins ─────────────────────────────────────────
router.post("/sub-admins", ctrl.createSubAdmin);

// ── Razorpay Payment Source (write action) ──────────────
router.post("/razorpay-signups/:id/resend-password", ctrl.resendRazorpayPassword);

// ── WhatsApp Leads ─────────────────────────────────────
router.get ("/whatsapp-leads",                              ctrl.whatsappLeads);
router.post("/demo-appointments/:id/mark-attended",         ctrl.markDemoAttended);

// ── Video Broadcast ────────────────────────────────────
router.post("/send-video-message",  ctrl.sendVideoMessage);
router.post("/bulk-optin-leads",    ctrl.bulkOptInLeads);

// ── Company ────────────────────────────────────────────
router.get   ("/companies/:id",                   ctrl.companyDetail);
router.get   ("/companies/:id/users",             ctrl.companyUsers);
router.patch ("/companies/:id/update",            ctrl.updateCompany);
router.patch ("/companies/:id/plan",              ctrl.updatePlan);
router.patch ("/companies/:id/status",            ctrl.updateStatus);
router.patch ("/companies/:id/extend-trial",      ctrl.extendTrial);
router.patch ("/companies/:id/subscription-dates",ctrl.updateSubscriptionDates);
router.patch ("/companies/:id/grace-period",      ctrl.setGracePeriod);
router.post  ("/companies/:id/force-cancel",      ctrl.forceCancel);
router.post  ("/companies/:id/suspend",           ctrl.suspendCompany);
router.post  ("/companies/:id/unsuspend",         ctrl.unsuspendCompany);
router.delete("/companies/:id",                   ctrl.deleteCompany);

export default router;
