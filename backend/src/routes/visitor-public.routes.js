import express from "express";
import { db } from "../config/db.js";
import { saveVisitor } from "../services/visitor.service.js";
import { sendEmail } from "../utils/mailer.js";
import multer from "multer";
import QRCode from "qrcode";
import crypto from "crypto";

const router = express.Router();

/* ======================================================
   CONSTANTS
====================================================== */
const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_SECONDS = 30;
const OTP_SESSION_EXPIRY_MINUTES = 30;

/* ======================================================
   MULTER CONFIGURATION
====================================================== */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * Wraps multer in a middleware that properly surfaces errors
 * to the Express error pipeline instead of swallowing them.
 */
const handleUpload = (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Photo must be under 5 MB"
          : `Upload error: ${err.message}`;
      return res.status(400).json({ success: false, message });
    }
    if (err) {
      return res
        .status(400)
        .json({ success: false, message: err.message || "File upload failed" });
    }
    next();
  });
};

/* ======================================================
   EMAIL TEMPLATES
====================================================== */
const emailFooter = (company = {}) => `
  <br/><br/>
  Regards,<br/>
  <strong>${company.name || "ProMeet Team"}</strong><br/>
  ${
    company.logo_url
      ? `<img src="${company.logo_url}" alt="${company.name || "Company"} Logo" height="55" style="margin-top:8px;" />`
      : ""
  }
  <hr style="margin-top:20px;" />
  <p style="font-size:13px;color:#666;margin-top:15px;line-height:1.5;">
    This email was automatically sent from the Conference Room Booking Platform.<br/>
    If you did not perform this action, please contact your administrator immediately.
  </p>
`;

const otpEmailHtml = (otp, company) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color:#6c2bd9;">${company.name} – Visitor Verification</h2>
    <p style="font-size:16px;">Your verification code is:</p>
    <div style="background:#f7f7f7;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
      <h1 style="letter-spacing:8px;color:#6c2bd9;margin:0;font-size:36px;">${otp}</h1>
    </div>
    <p style="color:#666;">
      This OTP is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
    </p>
    <p style="color:#999;font-size:12px;margin-top:30px;">
      If you didn't request this code, please ignore this email.
    </p>
    ${emailFooter(company)}
  </div>
`;

/* ======================================================
   UTILITIES
====================================================== */
const normalizeSlug = (v) => String(v || "").trim().toLowerCase();
const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const hashOTP = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

/* ======================================================
   COMPANY FETCH
====================================================== */
const getCompanyBySlug = async (slug) => {
  const [[company]] = await db.query(
    `SELECT id, name, slug, logo_url, whatsapp_url
     FROM companies
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );
  return company || null;
};

/* ======================================================
   SEND OTP EMAIL
====================================================== */
const sendOtpMail = async (email, otp, company) => {
  await sendEmail({
    to: email,
    subject: `Your Visitor Verification Code – ${company.name}`,
    html: otpEmailHtml(otp, company),
  });
};

/* ======================================================
   GET COMPANY INFO & QR CODE
   GET /visitor/:slug/info
====================================================== */
router.get("/visitor/:slug/info", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid registration link" });
    }

    const publicUrl = `${process.env.FRONTEND_URL}/visitor/${slug}`;

    const qrCode = await QRCode.toDataURL(publicUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#3c007a", light: "#ffffff" },
    });

    return res.json({
      success: true,
      company: {
        name: company.name,
        logo_url: company.logo_url,
        whatsapp_url: company.whatsapp_url || null,
      },
      qrCode,
      publicUrl,
    });
  } catch (err) {
    console.error("[VISITOR][INFO]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ======================================================
   DOWNLOAD QR CODE AS PNG
   GET /visitor/qr/:slug
====================================================== */
router.get("/visitor/qr/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).send("Company not found");
    }

    const publicUrl = `${process.env.FRONTEND_URL}/visitor/${slug}`;

    const qrBuffer = await QRCode.toBuffer(publicUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#3c007a", light: "#ffffff" },
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="visitor-qr-${slug}.png"`
    );
    return res.send(qrBuffer);
  } catch (err) {
    console.error("[VISITOR][QR_DOWNLOAD]", err);
    return res.status(500).send("Failed to generate QR code");
  }
});

/* ======================================================
   SEND OTP
   POST /visitor/:slug/otp/send
====================================================== */
router.post("/visitor/:slug/otp/send", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid email address required" });
    }

    const company = await getCompanyBySlug(slug);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid registration link" });
    }

    // Resend throttle check
    const [[last]] = await db.query(
      `SELECT otp_last_sent_at
       FROM visitor_otp
       WHERE email = ? AND company_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [email, company.id]
    );

    if (last?.otp_last_sent_at) {
      const elapsedSeconds =
        (Date.now() - new Date(last.otp_last_sent_at).getTime()) / 1000;

      if (elapsedSeconds < OTP_RESEND_SECONDS) {
        const waitSeconds = Math.ceil(OTP_RESEND_SECONDS - elapsedSeconds);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSeconds} second${waitSeconds !== 1 ? "s" : ""} before requesting a new OTP`,
          retryAfter: waitSeconds,
        });
      }
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    await db.query(
      `INSERT INTO visitor_otp
         (company_id, email, otp_hash, otp_expires_at, otp_last_sent_at, verified)
       VALUES
         (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW(), 0)`,
      [company.id, email, otpHash, OTP_EXPIRY_MINUTES]
    );

    await sendOtpMail(email, otp, company);

    return res.json({
      success: true,
      message: "OTP sent successfully",
      resendAfter: OTP_RESEND_SECONDS,
    });
  } catch (err) {
    console.error("[VISITOR][OTP_SEND]", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send OTP. Please try again." });
  }
});

/* ======================================================
   VERIFY OTP
   POST /visitor/:slug/otp/verify
====================================================== */
router.post("/visitor/:slug/otp/verify", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid email address required" });
    }

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a valid 6-digit OTP" });
    }

    const company = await getCompanyBySlug(slug);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid registration link" });
    }

    const otpHash = hashOTP(otp);

    const [[otpRecord]] = await db.query(
      `SELECT id, otp_hash, otp_expires_at
       FROM visitor_otp
       WHERE email = ? AND company_id = ? AND verified = 0
       ORDER BY id DESC
       LIMIT 1`,
      [email, company.id]
    );

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "No active OTP found. Please request a new one.",
      });
    }

    if (new Date(otpRecord.otp_expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (otpHash !== otpRecord.otp_hash) {
      return res.status(400).json({
        success: false,
        message: "Incorrect OTP. Please check and try again.",
      });
    }

    // Issue session token
    const sessionToken = crypto.randomBytes(32).toString("hex");

    await db.query(
      `UPDATE visitor_otp
       SET verified = 1,
           otp_session_token = ?,
           verified_at = NOW()
       WHERE id = ?`,
      [sessionToken, otpRecord.id]
    );

    return res.json({
      success: true,
      otpToken: sessionToken,
      message: "OTP verified successfully",
    });
  } catch (err) {
    console.error("[VISITOR][OTP_VERIFY]", err);
    return res
      .status(500)
      .json({ success: false, message: "Verification failed. Please try again." });
  }
});

/* ======================================================
   REGISTER VISITOR
   POST /visitor/:slug/register
====================================================== */
router.post("/visitor/:slug/register", handleUpload, async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    /* ── 1. Auth header check ── */
    const otpToken = (req.headers["otp-token"] || "").trim();
    if (!otpToken) {
      return res.status(401).json({
        success: false,
        message: "OTP verification required",
      });
    }

    /* ── 2. Session lookup with expiry window ── */
    const [[otpSession]] = await db.query(
      `SELECT id, company_id, email
       FROM visitor_otp
       WHERE otp_session_token = ?
         AND verified = 1
         AND verified_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
       LIMIT 1`,
      [otpToken, OTP_SESSION_EXPIRY_MINUTES]
    );

    if (!otpSession) {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid. Please verify your email again.",
      });
    }

    /* ── 3. Company validation ── */
    const company = await getCompanyBySlug(slug);
    if (!company || company.id !== otpSession.company_id) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid company" });
    }

    /* ── 4. Field validation — collect all errors upfront ── */
    const validationErrors = [];
    if (!req.body.name?.trim()) validationErrors.push("Visitor name is required");
    if (!req.body.phone?.trim()) validationErrors.push("Phone number is required");
    if (!req.file) validationErrors.push("Visitor photo is required");

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors[0], // surface the first error; swap for `validationErrors` array if frontend handles multiple
      });
    }

    /* ── 5. Build visitor payload ── */
    const visitorData = {
      name:         req.body.name.trim(),
      phone:        req.body.phone.trim(),
      email:        otpSession.email,
      fromCompany:  req.body.fromCompany?.trim()  || null,
      department:   req.body.department?.trim()   || null,
      designation:  req.body.designation?.trim()  || null,
      address:      req.body.address?.trim()      || null,
      city:         req.body.city?.trim()          || null,
      state:        req.body.state?.trim()         || null,
      postalCode:   req.body.postalCode?.trim()   || null,
      country:      req.body.country?.trim()       || null,
      personToMeet: req.body.personToMeet?.trim() || null,
      purpose:      req.body.purpose?.trim()       || null,
      belongings:   req.body.belongings            || null,
      idType:       req.body.idType?.trim()        || null,
      idNumber:     req.body.idNumber?.trim()      || null,
    };

    /* ── 6. Persist visitor ── */
    const visitor = await saveVisitor(otpSession.company_id, visitorData, req.file);

    /* ── 7. Invalidate session immediately after successful registration ── */
    await db.query(
      `UPDATE visitor_otp SET otp_session_token = NULL WHERE id = ?`,
      [otpSession.id]
    );

    return res.json({
      success: true,
      message: "Visitor registered successfully. Pass sent to your email.",
      visitorCode: visitor.visitorCode,
    });
  } catch (err) {
    console.error("[VISITOR][REGISTER]", err);

    // Known business-logic errors get a 403; everything else is a 500
    const isKnownError = /trial|limit|expired|subscription/i.test(
      err.message || ""
    );

    return res.status(isKnownError ? 403 : 500).json({
      success: false,
      message: isKnownError
        ? err.message
        : "Registration failed. Please try again.",
    });
  }
});

export default router;
