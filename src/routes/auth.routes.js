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
====================================================== */

/**
 * Register company (multipart/form-data with logo)
 */
router.post(
  "/register",
  upload.single("logo"),
  register
);

/**
 * Login
 */
router.post("/login", login);

/**
 * Forgot password – send reset code
 */
router.post("/forgot-password", forgotPassword);

/**
 * Reset password – verify code & update password
 */
router.post("/reset-password", resetPassword);

export default router;
