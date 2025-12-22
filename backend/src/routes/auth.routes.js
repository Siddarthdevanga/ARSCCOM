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
 * Company Registration
 * - Creates company
 * - Creates admin user
 * - Accepts multipart/form-data
 * - Logo field name: "logo"
 */
router.post(
  "/register",
  upload.single("logo"),
  register
);

/**
 * Login (Admin / Company User)
 * - Returns JWT with companyId
 * - Returns company object (id, name, slug, logo_url)
 * - Used by Conference Dashboard
 */
router.post("/login", login);

/**
 * Forgot Password
 * - Sends reset code
 * - Used by all modules
 */
router.post("/forgot-password", forgotPassword);

/**
 * Reset Password
 * - Verifies reset code
 * - Updates password
 */
router.post("/reset-password", resetPassword);

export default router;
