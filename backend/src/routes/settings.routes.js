import express from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
  getSettings,
  updateCompanySettings,
  updateCompanyLogo,
  updateUserProfile,
  changePassword,
  getVisitorFormFields,
  updateVisitorFormFields,
  getPurposeCategories,
  createPurposeCategory,
  updatePurposeCategory,
  deletePurposeCategory,
  reorderPurposeCategories,
  createPurposeSubcategory,
  updatePurposeSubcategory,
  deletePurposeSubcategory,
  reorderPurposeSubcategories,
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
  createCustomFieldOption,
  updateCustomFieldOption,
  deleteCustomFieldOption,
  reorderCustomFieldOptions,
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
   - Visitor code prefix (optional, exactly 3 letters A-Z)

   Body: { name, whatsappUrl, codePrefix }
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

/* ======================================================
   VISITOR FORM FIELDS — Form Builder
   GET /api/settings/visitor-fields
   PUT /api/settings/visitor-fields
   --------------------------------------------------------
   Per-company toggle state for optional visitor registration
   fields. Name, WhatsApp Number, and Photo are always
   collected and aren't part of this set.

   Body (PUT): { fields: { <fieldKey>: boolean, ... } }
====================================================== */
router.get(
  "/visitor-fields",
  authenticate,
  asyncHandler(getVisitorFormFields)
);

router.put(
  "/visitor-fields",
  authenticate,
  asyncHandler(updateVisitorFormFields)
);

/* ======================================================
   PURPOSE OF VISIT — CATEGORIES & SUB-CATEGORIES
   --------------------------------------------------------
   Company-defined Purpose of Visit picker. Empty list = the
   registration form keeps the plain free-text Purpose field.
====================================================== */
router.get("/purpose-categories", authenticate, asyncHandler(getPurposeCategories));
router.post("/purpose-categories", authenticate, asyncHandler(createPurposeCategory));
router.put("/purpose-categories/reorder", authenticate, asyncHandler(reorderPurposeCategories));
router.put("/purpose-categories/:id", authenticate, asyncHandler(updatePurposeCategory));
router.delete("/purpose-categories/:id", authenticate, asyncHandler(deletePurposeCategory));

router.post("/purpose-categories/:categoryId/subcategories", authenticate, asyncHandler(createPurposeSubcategory));
router.put("/purpose-categories/:categoryId/subcategories/reorder", authenticate, asyncHandler(reorderPurposeSubcategories));
router.put("/purpose-subcategories/:id", authenticate, asyncHandler(updatePurposeSubcategory));
router.delete("/purpose-subcategories/:id", authenticate, asyncHandler(deletePurposeSubcategory));

/* ======================================================
   CUSTOM FIELDS
   --------------------------------------------------------
   Company-defined custom fields (max 5): text, number, or
   dropdown, optionally required. Dropdown fields have their
   own company-scoped options list.
====================================================== */
router.get("/custom-fields", authenticate, asyncHandler(getCustomFields));
router.post("/custom-fields", authenticate, asyncHandler(createCustomField));
router.put("/custom-fields/reorder", authenticate, asyncHandler(reorderCustomFields));
router.put("/custom-fields/:id", authenticate, asyncHandler(updateCustomField));
router.delete("/custom-fields/:id", authenticate, asyncHandler(deleteCustomField));

router.post("/custom-fields/:fieldId/options", authenticate, asyncHandler(createCustomFieldOption));
router.put("/custom-fields/:fieldId/options/reorder", authenticate, asyncHandler(reorderCustomFieldOptions));
router.put("/custom-field-options/:id", authenticate, asyncHandler(updateCustomFieldOption));
router.delete("/custom-field-options/:id", authenticate, asyncHandler(deleteCustomFieldOption));

export default router;
