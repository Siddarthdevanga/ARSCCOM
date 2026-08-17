import express from "express";
import { upload } from "../middlewares/upload.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  register,
  login,
  completeRegistration,
  forgotPassword,
  resetPassword,
  logout,
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
    if (data?.company?.subscription_status === "expired") {
      return originalJson({
        ...data,
        redirect: "/subscription",
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
   - Company (with optional WhatsApp URL)
   - Admin User
   - Uploads Logo (required)
   
   Expected Fields:
   - companyName (required)
   - email (required)
   - phone (required)
   - password (required)
   - whatsappUrl (optional) - Format: https://wa.me/... or https://api.whatsapp.com/...
   - logo (file, required)
   
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
   - User { id, email }
   - Company { 
       id, 
       name, 
       slug, 
       logo_url,
       whatsapp_url (optional),
       subscription_status,
       plan 
     }
   
   subscription_status expected values:
   "pending" | "trial" | "active" | "expired" | "cancelled"
====================================================== */
router.post(
  "/login",
  checkSubscriptionStatus,
  asyncHandler(login)
);

/* ======================================================
   COMPLETE REGISTRATION
   --------------------------------------------------------
   For companies created via the Razorpay payment-link flow —
   sets a real password, company name, logo and WhatsApp URL.
   Protected: requires the auth cookie set by /login.
====================================================== */
router.post(
  "/complete-registration",
  authenticate,
  upload.single("logo"),
  asyncHandler(completeRegistration)
);

/* ======================================================
   FORGOT PASSWORD
   --------------------------------------------------------
   Returns:
   - Always success message (no email leak)
   - Sends reset code internally
   
   Rate limiting:
   - 30 seconds cooldown between requests
====================================================== */
router.post("/forgot-password", asyncHandler(forgotPassword));

/* ======================================================
   RESET PASSWORD
   --------------------------------------------------------
   Validates:
   - Email
   - OTP Code (6-character hex)
   - New Password (min 8 characters)
   
   Updates:
   - Password hash
   - Clears reset tokens
====================================================== */
router.post("/reset-password", asyncHandler(resetPassword));

router.post("/logout", asyncHandler(logout));

export default router;
