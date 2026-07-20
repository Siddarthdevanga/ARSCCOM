import express from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
  getSettings,
  updateCompanySettings,
  updateCompanyLogo,
  updateUserProfile,
  changePassword
} from "../controllers/settings.controller.js";

const router = express.Router();

/* ======================================================
   SAFE ASYNC WRAPPER
   Prevents Node crash from unhandled async errors
====================================================== */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error("❌ SETTINGS ROUTE ERROR:", err);
    next(err);
  });

/* ======================================================
   MULTER ERROR HANDLER
   Without this, a rejected upload (too large, wrong type)
   falls through to the generic 500 handler with no clear
   message — the frontend then shows a vague failure.
====================================================== */
const handleLogoUpload = (req, res, next) => {
  upload.single("logo")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === "LIMIT_FILE_SIZE"
        ? "Logo must be under 5MB"
        : `Upload error: ${err.message}`;
      return res.status(400).json({ success: false, message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message || "File upload failed" });
    }
    next();
  });
};

/* ======================================================
   GET SETTINGS
   GET /api/settings
   --------------------------------------------------------
   Returns current company + user data
   - Company: name, logo, whatsapp_url, rooms, plan, status
   - User: email, name, phone
====================================================== */
router.get(
  "/",
  authenticate,
  asyncHandler(getSettings)
);

/* ======================================================
   UPDATE COMPANY SETTINGS
   PUT /api/settings/company
   --------------------------------------------------------
   Updates:
   - Company name
   - WhatsApp URL (optional, validated)
   
   Body: { name, whatsappUrl }
====================================================== */
router.put(
  "/company",
  authenticate,
  asyncHandler(updateCompanySettings)
);

/* ======================================================
   UPDATE COMPANY LOGO
   PUT /api/settings/company/logo
   --------------------------------------------------------
   Uploads new logo to S3
   Updates logo_url in database
   
   Form-data: logo (file)
====================================================== */
router.put(
  "/company/logo",
  authenticate,
  handleLogoUpload,
  asyncHandler(updateCompanyLogo)
);

/* ======================================================
   UPDATE USER PROFILE
   PUT /api/settings/profile
   --------------------------------------------------------
   Updates:
   - User name
   - User phone
   
   Email is READ ONLY (security)
   
   Body: { name, phone }
====================================================== */
router.put(
  "/profile",
  authenticate,
  asyncHandler(updateUserProfile)
);

/* ======================================================
   CHANGE PASSWORD
   PUT /api/settings/password
   --------------------------------------------------------
   Validates current password
   Updates to new password
   Sends confirmation email
   
   Body: { currentPassword, newPassword }
====================================================== */
router.put(
  "/password",
  authenticate,
  asyncHandler(changePassword)
);

export default router;
