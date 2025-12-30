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
   AUTH ROUTES
   Shared for Visitor + Conference Modules
====================================================== */

/* ======================================================
   REGISTER
--------------------------------------------------------
PURPOSE:
 - Creates Company
 - Creates Admin User
 - (Optional) Uploads Company Logo

REQUEST:
 - multipart/form-data
 - logo field name: "logo"

RESPONSE:
 {
   token,
   user,
   company
 }
====================================================== */
router.post(
  "/register",
  upload.single("logo"),
  register
);

/* ======================================================
   LOGIN
--------------------------------------------------------
PURPOSE:
 - Authenticates Admin / Employees
 - Returns JWT Token
 - MUST return company.subscription_status

IMPORTANT (Frontend Logic Depends On This):
 company.subscription_status must be one of:
   "active"
   "trial"
   "pending"
   "expired"
   "cancelled"
   "none"

EXPECTED RESPONSE FORMAT:
 {
   token: "",
   user: {},
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
router.post("/login", login);

/* ======================================================
   FORGOT PASSWORD
--------------------------------------------------------
PURPOSE:
 - Sends password reset OTP / link
====================================================== */
router.post("/forgot-password", forgotPassword);

/* ======================================================
   RESET PASSWORD
--------------------------------------------------------
PURPOSE:
 - Validates reset token / OTP
 - Updates user password
====================================================== */
router.post("/reset-password", resetPassword);

export default router;
