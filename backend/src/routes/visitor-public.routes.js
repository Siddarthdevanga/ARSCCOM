import express from "express";
import { db } from "../config/db.js";
import { saveVisitor } from "../services/visitor.service.js";
import multer from "multer";
import QRCode from "qrcode";

const router = express.Router();

/* ================= MULTER CONFIGURATION ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

/* ================= CONSTANTS ================= */
const ERROR_MESSAGES = {
  INVALID_SLUG: "Invalid visitor registration link",
  COMPANY_NOT_FOUND: "Company not found",
  MISSING_FIELDS: "Missing required fields",
  INVALID_EMAIL: "Invalid email address",
  INVALID_PHONE: "Invalid phone number",
  PHOTO_REQUIRED: "Visitor photo is required",
  PLAN_EXCEEDED: "Visitor limit exceeded. Please contact administrator",
  SERVER_ERROR: "Server error occurred"
};

/* ================= UTILITY FUNCTIONS ================= */
const normalizeSlug = (value) => String(value || "").trim().toLowerCase();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
};

/* ================= DATABASE HELPERS ================= */
/**
 * Fetches company by slug with plan validation
 */
const getCompanyBySlug = async (slug) => {
  const [[company]] = await db.query(
    `SELECT 
      id, name, slug, logo_url, 
      plan, subscription_status, 
      trial_ends_at, subscription_ends_at
     FROM companies 
     WHERE slug = ? 
     LIMIT 1`,
    [slug]
  );
  return company;
};

/**
 * Validates company plan and limits
 */
const validateVisitorPlan = async (company) => {
  if (!company) {
    throw new Error(ERROR_MESSAGES.COMPANY_NOT_FOUND);
  }

  const plan = (company.plan || "TRIAL").toUpperCase();
  const status = (company.subscription_status || "PENDING").toUpperCase();
  const now = new Date();

  // Check subscription status
  if (!["ACTIVE", "TRIAL"].includes(status)) {
    throw new Error(ERROR_MESSAGES.PLAN_EXCEEDED);
  }

  // Handle TRIAL plan
  if (plan === "TRIAL") {
    if (!company.trial_ends_at || new Date(company.trial_ends_at) < now) {
      throw new Error(ERROR_MESSAGES.PLAN_EXCEEDED);
    }

    // Check visitor limit for trial (100 visitors)
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM visitors WHERE company_id = ?`,
      [company.id]
    );

    if (total >= 100) {
      throw new Error(ERROR_MESSAGES.PLAN_EXCEEDED);
    }
  }

  // Handle BUSINESS/ENTERPRISE plans
  if (["BUSINESS", "ENTERPRISE"].includes(plan)) {
    if (!company.subscription_ends_at || new Date(company.subscription_ends_at) < now) {
      throw new Error(ERROR_MESSAGES.PLAN_EXCEEDED);
    }
  }

  return true;
};

/* ================= ROUTE HANDLERS ================= */

/**
 * GET /visitor/:slug/info - Get company info and QR code
 */
router.get("/visitor/:slug/info", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ 
        success: false,
        message: ERROR_MESSAGES.INVALID_SLUG 
      });
    }

    // Validate plan
    try {
      await validateVisitorPlan(company);
    } catch (error) {
      return res.status(403).json({ 
        success: false,
        message: error.message 
      });
    }

    // Generate QR code for the registration URL
    const registrationUrl = `${process.env.FRONTEND_URL}/visitor/${slug}`;
    const qrCodeDataUrl = await QRCode.toDataURL(registrationUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#3c007a",
        light: "#ffffff"
      }
    });

    res.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logo_url
      },
      qrCode: qrCodeDataUrl,
      registrationUrl
    });
  } catch (error) {
    console.error("[PUBLIC][VISITOR_INFO]", error);
    res.status(500).json({ 
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR 
    });
  }
});

/**
 * GET /visitor/:slug/validate - Validate company and plan
 */
router.get("/visitor/:slug/validate", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ 
        success: false,
        message: ERROR_MESSAGES.INVALID_SLUG 
      });
    }

    // Validate plan
    try {
      await validateVisitorPlan(company);
    } catch (error) {
      return res.status(403).json({ 
        success: false,
        message: error.message,
        planExpired: true
      });
    }

    res.json({
      success: true,
      company: {
        name: company.name,
        logo_url: company.logo_url
      }
    });
  } catch (error) {
    console.error("[PUBLIC][VALIDATE]", error);
    res.status(500).json({ 
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR 
    });
  }
});

/**
 * POST /visitor/:slug/register - Register a new visitor
 */
router.post("/visitor/:slug/register", upload.single("photo"), async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ 
        success: false,
        message: ERROR_MESSAGES.INVALID_SLUG 
      });
    }

    // Validate plan
    try {
      await validateVisitorPlan(company);
    } catch (error) {
      return res.status(403).json({ 
        success: false,
        message: error.message 
      });
    }

    // Validate required fields
    const {
      name,
      phone,
      email,
      fromCompany,
      department,
      designation,
      address,
      city,
      state,
      postalCode,
      country,
      personToMeet,
      purpose,
      belongings,
      idType,
      idNumber
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Visitor name is required" 
      });
    }

    if (!phone?.trim() || !isValidPhone(phone)) {
      return res.status(400).json({ 
        success: false,
        message: ERROR_MESSAGES.INVALID_PHONE 
      });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: ERROR_MESSAGES.INVALID_EMAIL 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: ERROR_MESSAGES.PHOTO_REQUIRED 
      });
    }

    // Prepare visitor data
    const visitorData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? normalizeEmail(email) : null,
      fromCompany: fromCompany?.trim() || null,
      department: department?.trim() || null,
      designation: designation?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      postalCode: postalCode?.trim() || null,
      country: country?.trim() || null,
      personToMeet: personToMeet?.trim() || null,
      purpose: purpose?.trim() || null,
      belongings: belongings || null,
      idType: idType?.trim() || null,
      idNumber: idNumber?.trim() || null
    };

    // Convert multer file to expected format
    const file = {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype
    };

    // Save visitor using existing service
    const visitor = await saveVisitor(company.id, visitorData, file);

    res.json({
      success: true,
      message: "Visitor registered successfully",
      visitor: {
        id: visitor.id,
        visitorCode: visitor.visitorCode,
        name: visitor.name,
        phone: visitor.phone,
        email: visitor.email,
        photoUrl: visitor.photoUrl,
        checkIn: visitor.checkInIST
      }
    });
  } catch (error) {
    console.error("[PUBLIC][REGISTER_VISITOR]", error);
    
    // Handle specific error messages
    if (error.message.includes("Trial") || error.message.includes("limit")) {
      return res.status(403).json({ 
        success: false,
        message: error.message 
      });
    }

    res.status(500).json({ 
      success: false,
      message: error.message || ERROR_MESSAGES.SERVER_ERROR 
    });
  }
});

/**
 * GET /visitor/:slug/stats - Get visitor statistics (optional)
 */
router.get("/visitor/:slug/stats", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ 
        success: false,
        message: ERROR_MESSAGES.INVALID_SLUG 
      });
    }

    // Get today's visitor count
    const [[todayStats]] = await db.query(
      `SELECT COUNT(*) AS total 
       FROM visitors 
       WHERE company_id = ? 
       AND DATE(check_in) = CURDATE()`,
      [company.id]
    );

    // Get total visitor count
    const [[totalStats]] = await db.query(
      `SELECT COUNT(*) AS total 
       FROM visitors 
       WHERE company_id = ?`,
      [company.id]
    );

    res.json({
      success: true,
      stats: {
        today: todayStats.total,
        total: totalStats.total
      }
    });
  } catch (error) {
    console.error("[PUBLIC][VISITOR_STATS]", error);
    res.status(500).json({ 
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR 
    });
  }
});

/**
 * GET /visitor/qr/:slug - Generate QR code image (PNG)
 */
router.get("/visitor/qr/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).send("Company not found");
    }

    const registrationUrl = `${process.env.FRONTEND_URL}/visitor/${slug}`;
    
    // Generate QR code as buffer
    const qrCodeBuffer = await QRCode.toBuffer(registrationUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#3c007a",
        light: "#ffffff"
      }
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="visitor-qr-${slug}.png"`);
    res.send(qrCodeBuffer);
  } catch (error) {
    console.error("[PUBLIC][QR_IMAGE]", error);
    res.status(500).send("Failed to generate QR code");
  }
});

export default router;
