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
   PUBLIC — NO AUTH
====================================================== */
router.get("/public/code/:visitorCode", getPublicVisitorPass);

/* ======================================================
   CREATE VISITOR
====================================================== */
router.post("/", authenticate, upload.single("photo"), createVisitor);

/* ======================================================
   DASHBOARD
====================================================== */
router.get("/dashboard", authenticate, getVisitorDashboard);

/* ======================================================
   VISITOR PASS (ADMIN)
====================================================== */
router.get("/code/:visitorCode", authenticate, getVisitorPass);

/* ======================================================
   ADMIN — UPDATE VISIT STATUS (Accept / Decline)
====================================================== */
router.patch("/:visitorCode/visit-status", authenticate, updateVisitStatus);

/* ======================================================
   RESEND VISITOR PASS EMAIL
====================================================== */
router.post("/:visitorCode/resend", authenticate, resendVisitorPass);

/* ======================================================
   CHECKOUT
====================================================== */
router.post("/:visitorCode/checkout", authenticate, checkoutVisitor);

export default router;
