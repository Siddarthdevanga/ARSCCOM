import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
  createVisitor,
  getVisitorPass,
  getPublicVisitorPass,
  getVisitorDashboard,
  checkoutVisitor,
  resendVisitorPass,
  updateVisitStatus,
} from "../controllers/visitor.controller.js";

const router = express.Router();

/* ======================================================
   ROUTE ORDER MATTERS IN EXPRESS.
   Fixed/named routes MUST come before wildcard /:param
   routes to prevent shadowing. All static segment routes
   are registered first, wildcard routes last.
====================================================== */

/* ── PUBLIC — NO AUTH ── */
router.get("/public/code/:visitorCode", getPublicVisitorPass);

/* ── CREATE VISITOR ── */
router.post("/", authenticate, upload.single("photo"), createVisitor);

/* ── DASHBOARD ── */
router.get("/dashboard", authenticate, getVisitorDashboard);

/* ── VISITOR PASS (ADMIN) ── */
router.get("/code/:visitorCode", authenticate, getVisitorPass);

/* ── WILDCARD ROUTES — registered last to avoid shadowing ── */

/* Admin accept / decline visit status */
router.patch("/:visitorCode/visit-status", authenticate, updateVisitStatus);

/* Resend visitor pass email */
router.post("/:visitorCode/resend", authenticate, resendVisitorPass);

/* Checkout — POST /api/visitors/:visitorCode/checkout */
router.post("/:visitorCode/checkout", authenticate, (req, res, next) => {
  console.log(`[CHECKOUT] Received: POST /api/visitors/${req.params.visitorCode}/checkout`);
  next();
}, checkoutVisitor);

export default router;
