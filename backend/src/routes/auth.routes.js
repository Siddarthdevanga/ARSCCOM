import express from "express";
import { upload } from "../middlewares/upload.middleware.js";

import {
  register,
  login,
  forgotPassword,
  resetPassword
} from "../controllers/auth.controller.js";

const router = express.Router();

/* ======================================================
   SAFE ASYNC WRAPPER
   Prevents Node crash from unhandled async errors
====================================================== */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error("❌ ROUTE ERROR:", err);
    next(err);
  });

/* ======================================================
   REGISTER
--------------------------------------------------------
Creates:
 - Company
 - Admin User
 - Uploads Logo (optional)

Frontend expectation:
 - After success, redirect to Subscription Page
====================================================== */
router.post(
  "/register",
  upload.single("logo"),
  asyncHandler(register)
);

/* ======================================================
   LOGIN
--------------------------------------------------------
Returns:
 - JWT Token
 - User
 - Company Subscription Context

subscription_status expected values:
  "pending" | "trial" | "active" | "expired" | "cancelled"
====================================================== */
router.post("/login", asyncHandler(login));

/* ======================================================
   FORGOT PASSWORD
--------------------------------------------------------
Returns:
 - Always success message (no email leak)
 - Sends reset code internally
====================================================== */
router.post("/forgot-password", asyncHandler(forgotPassword));

/* ======================================================
   RESET PASSWORD
--------------------------------------------------------
Validates:
 - Email
 - OTP Code
 - New Password

Updates:
 - Password
====================================================== */
router.post("/reset-password", asyncHandler(resetPassword));

export default router;
