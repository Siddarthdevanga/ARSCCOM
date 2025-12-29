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
   (Shared by Visitor + Conference Modules)
====================================================== */

/**
 * ======================================================
 * REGISTER
 * ------------------------------------------------------
 * PURPOSE:
 *  - Creates Company
 *  - Creates Admin User
 *  - Optionally uploads Company Logo
 *
 * REQUEST TYPE:
 *  multipart/form-data
 *
 * LOGO FIELD NAME:
 *  logo
 *
 * RESPONSE:
 *  company + user + token
 * ======================================================
 */
router.post(
  "/register",
  upload.single("logo"),
  register
);

/**
 * ======================================================
 * LOGIN
 * ------------------------------------------------------
 * PURPOSE:
 *  - Allows Admin / Employee Login
 *  - Returns JWT Token
 *  - MUST Return Company Subscription Details
 *
 * FRONTEND DEPENDS ON:
 *  company.subscription_status
 *
 * VALUES:
 *  active | trial | pending | expired | cancelled | none
 *
 * RESPONSE FORMAT (IMPORTANT):
 * {
 *   token: "",
 *   user: {},
 *   company: {
 *     id,
 *     name,
 *     slug,
 *     logo_url,
 *     subscription_status,
 *     plan
 *   }
 * }
 * ======================================================
 */
router.post("/login", login);

/**
 * ======================================================
 * FORGOT PASSWORD
 * ------------------------------------------------------
 * PURPOSE:
 *  - Sends Reset OTP / Code
 * ======================================================
 */
router.post("/forgot-password", forgotPassword);

/**
 * ======================================================
 * RESET PASSWORD
 * ------------------------------------------------------
 * PURPOSE:
 *  - Validates Reset Code
 *  - Updates Password
 * ======================================================
 */
router.post("/reset-password", resetPassword);

export default router;
