import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { subscriptionGuard } from "../middlewares/subscriptionGuard.js";
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
   - ALWAYS ACCESSIBLE
====================================================== */
router.get(
  "/public/code/:visitorCode",
  getPublicVisitorPass
);

/* ======================================================
   PROTECTED ROUTES (AUTH + SUBSCRIPTION REQUIRED)
====================================================== */
router.use(authenticate, subscriptionGuard);

/* ======================================================
   CREATE VISITOR
   POST /api/visitors
   multipart/form-data
   field: photo
====================================================== */
router.post(
  "/",
  upload.single("photo"),
  createVisitor
);

/* ======================================================
   VISITOR DASHBOARD
====================================================== */
router.get(
  "/dashboard",
  getVisitorDashboard
);

/* ======================================================
   ADMIN VISITOR PASS (Secure scoped)
====================================================== */
router.get(
  "/code/:visitorCode",
  getVisitorPass
);

/* ======================================================
   CHECKOUT VISITOR
====================================================== */
router.post(
  "/:visitorCode/checkout",
  checkoutVisitor
);

export default router;
