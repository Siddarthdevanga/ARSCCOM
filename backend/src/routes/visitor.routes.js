import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

import {
  createVisitor,
  getVisitorPass,        // Secure - Admin
  getPublicVisitorPass,  // Public via Email/QR
  getVisitorDashboard,
  checkoutVisitor
} from "../controllers/visitor.controller.js";

const router = express.Router();

/* ======================================================
   🌐 PUBLIC VISITOR PASS (NO AUTH)
   Safe public read only access
   URL used in email + QR
====================================================== */
router.get(
  "/public/code/:visitorCode",
  getPublicVisitorPass
);

/* ======================================================
   👤 CREATE VISITOR
   POST /api/visitors
   - Auth Required
   - multipart/form-data
   - photo field name = "photo"
====================================================== */
router.post(
  "/",
  authenticate,
  upload.single("photo"),
  createVisitor
);

/* ======================================================
   📊 VISITOR DASHBOARD (ADMIN)
   GET /api/visitors/dashboard
   Returns today, monthly count, plan usage etc.
====================================================== */
router.get(
  "/dashboard",
  authenticate,
  getVisitorDashboard
);

/* ======================================================
   🔒 SECURE ADMIN VISITOR PASS
   GET /api/visitors/code/:visitorCode
   - Requires auth
   - Must belong to same company
====================================================== */
router.get(
  "/code/:visitorCode",
  authenticate,
  getVisitorPass
);

/* ======================================================
   🚪 CHECKOUT VISITOR
   POST /api/visitors/:visitorCode/checkout
====================================================== */
router.post(
  "/:visitorCode/checkout",
  authenticate,
  checkoutVisitor
);

export default router;
