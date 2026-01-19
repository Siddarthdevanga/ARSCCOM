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
   SUBSCRIPTION CHECK MIDDLEWARE
   --------------------------------------------------------
   Checks if user's subscription is expired after login
   Redirects to subscription page if needed
====================================================== */
const checkSubscriptionStatus = (req, res, next) => {
  // This runs after login controller sets response
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Check if login was successful and subscription is expired
    if (data?.subscription_status === "expired") {
      return originalJson({
        ...data,
        redirect: "/auth/subscription",
        message: "Your subscription has expired. Please renew to continue."
      });
    }
    return originalJson(data);
  };
  
  next();
};

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
router.post(
  "/login",
  checkSubscriptionStatus,
  asyncHandler(login)
);

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
