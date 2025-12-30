import express from "express";
import { upload } from "../middlewares/upload.middleware.js";
import {
  register,
  login,
  forgotPassword,
  resetPassword
} from "../controllers/auth.controller.js";

/* ======================================================
   SAFE ASYNC WRAPPER
   Prevents Node crash from unhandled async errors
====================================================== */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const router = express.Router();

/* ======================================================
   ROUTE: REGISTER
--------------------------------------------------------
PURPOSE:
 - Creates Company
 - Creates Admin User
 - Optional Logo Upload

REQUEST:
 - multipart/form-data
 - logo field name: "logo"

SUCCESS RESPONSE:
 {
   token,
   user,
   company: {
     id,
     name,
     slug,
     logo_url,
     plan,
     subscription_status
   }
}

NOTES:
 - Should initialize subscription_status = "pending" or "trial"
====================================================== */
router.post(
  "/register",
  upload.single("logo"),   // handles file upload
  asyncHandler(register)
);

/* ======================================================
   ROUTE: LOGIN
--------------------------------------------------------
PURPOSE:
 - Authenticates Admin / Employees
 - Returns JWT + Subscription Context

Frontend **depends** on subscription_status values:
  "active" | "trial" | "pending" | "expired" | "cancelled" | "none"

SUCCESS RESPONSE:
 {
   token,
   user,
   company: {
     id,
     name,
     slug,
     logo_url,
     subscription_status,
     plan
   }
}
====================================================== */
router.post("/login", asyncHandler(login));

/* ======================================================
   ROUTE: FORGOT PASSWORD
--------------------------------------------------------
PURPOSE:
 - Sends Reset OTP / Link
====================================================== */
router.post("/forgot-password", asyncHandler(forgotPassword));

/* ======================================================
   ROUTE: RESET PASSWORD
--------------------------------------------------------
PURPOSE:
 - Verifies OTP / Token
 - Updates Password
====================================================== */
router.post("/reset-password", asyncHandler(resetPassword));

export default router;
