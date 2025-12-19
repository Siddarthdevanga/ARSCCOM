import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

import {
  createVisitor,
  getVisitorPass,        // 🔒 admin / dashboard
  getPublicVisitorPass,  // 🌐 public email / QR
  getVisitorDashboard,
  checkoutVisitor
} from "../controllers/visitor.controller.js";

const router = express.Router();

/* ======================================================
   🌐 PUBLIC VISITOR PASS (EMAIL / QR)
   GET /api/visitors/public/code/:visitorCode
   - NO AUTH
   - Read-only
====================================================== */
router.get(
  "/public/code/:visitorCode",
  getPublicVisitorPass
);

/* ======================================================
   CREATE VISITOR
   POST /api/visitors
   - Auth required
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
   VISITOR DASHBOARD (ADMIN)
   GET /api/visitors/dashboard
====================================================== */
router.get(
  "/dashboard",
  authenticate,
  getVisitorDashboard
);

/* ======================================================
   ADMIN VISITOR PASS (SECURE)
   GET /api/visitors/code/:visitorCode
   - Company-isolated
====================================================== */
router.get(
  "/code/:visitorCode",
  authenticate,
  getVisitorPass
);

/* ======================================================
   CHECKOUT VISITOR
   POST /api/visitors/:visitorCode/checkout
====================================================== */
router.post(
  "/:visitorCode/checkout",
  authenticate,
  checkoutVisitor
);

export default router;
