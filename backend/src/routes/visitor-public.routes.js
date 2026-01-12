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

/* ======================================================
   MULTER CONFIGURATION
====================================================== */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files allowed"));
  },
});

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
  <hr style="margin-top:20px;"/>
  <p style="font-size:13px;color:#666;margin-top:15px;line-height:1.5;">
    This email was automatically sent from the Conference Room Booking Platform.<br/>
    If you did not perform this action, please contact your administrator immediately.
  </p>
`;

/* ======================================================
   UTILITIES
====================================================== */
const normalizeSlug = (v) => String(v || "").trim().toLowerCase();
const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const hashOTP = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

/* ======================================================
   COMPANY FETCH
====================================================== */
const getCompanyBySlug = async (slug) => {
  const [[company]] = await db.query(
    `SELECT id, name, slug, logo_url
     FROM companies
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );
  return company;
};

/* ======================================================
   SEND OTP EMAIL (USING AUTH SERVICE PATTERN)
====================================================== */
const sendOtpMail = async (email, otp, company) => {
  await sendEmail({
    to: email,
    subject: `Your Visitor Verification Code - ${company.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#6c2bd9;">${company.name} – Visitor Verification</h2>
        <p style="font-size: 16px;">Your verification code is:</p>
        <div style="background: #f7f7f7; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="letter-spacing: 8px; color: #6c2bd9; margin: 0; font-size: 36px;">${otp}</h1>
        </div>
        <p style="color: #666;">This OTP is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          If you didn't request this code, please ignore this email.
        </p>
        ${emailFooter(company)}
      </div>
    `,
  });
};

/* ======================================================
   GET COMPANY INFO & QR CODE
====================================================== */
router.get("/visitor/:slug/info", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid registration link" 
      });
    }

    // Generate public URL (from AWS Secrets Manager env var)
    const publicUrl = `${process.env.FRONTEND_URL}/visitor/${slug}`;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(publicUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#3c007a", light: "#ffffff" },
    });

    res.json({
      success: true,
      company: {
        name: company.name,
        logo_url: company.logo_url,
      },
      qrCode,
      publicUrl,
    });
  } catch (err) {
    console.error("[VISITOR_PUBLIC][INFO]", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

/* ======================================================
   DOWNLOAD QR CODE AS PNG
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
    res.send(qrBuffer);
  } catch (err) {
    console.error("[VISITOR_PUBLIC][QR_DOWNLOAD]", err);
    res.status(500).send("Failed to generate QR code");
  }
});

/* ======================================================
   SEND OTP
====================================================== */
router.post("/visitor/:slug/otp/send", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid email address required" 
      });
    }

    const company = await getCompanyBySlug(slug);
    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid registration link" 
      });
    }

    // Check resend throttle
    const [[last]] = await db.query(
      `SELECT otp_last_sent_at
       FROM visitor_otp
       WHERE email = ? AND company_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [email, company.id]
    );

    if (last?.otp_last_sent_at) {
      const diff =
        (Date.now() - new Date(last.otp_last_sent_at).getTime()) / 1000;

      if (diff < OTP_RESEND_SECONDS) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(
            OTP_RESEND_SECONDS - diff
          )} seconds before requesting a new OTP`,
        });
      }
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    // Store OTP
    await db.query(
      `INSERT INTO visitor_otp
       (company_id, email, otp_hash, otp_expires_at, otp_last_sent_at, verified)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW(), 0)`,
      [company.id, email, otpHash, OTP_EXPIRY_MINUTES]
    );

    // Send OTP email (using auth service pattern)
    await sendOtpMail(email, otp, company);

    res.json({
      success: true,
      message: "OTP sent successfully",
      resendAfter: OTP_RESEND_SECONDS,
    });
  } catch (err) {
    console.error("[VISITOR_PUBLIC][OTP_SEND]", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send OTP" 
    });
  }
});

/* ======================================================
   VERIFY OTP
====================================================== */
router.post("/visitor/:slug/otp/verify", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter 6-digit OTP" 
      });
    }

    const company = await getCompanyBySlug(slug);
    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid registration link" 
      });
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
        message: "OTP not found. Please request a new one." 
      });
    }

    if (new Date(otpRecord.otp_expires_at) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: "OTP expired. Please request a new one." 
      });
    }

    if (otpHash !== otpRecord.otp_hash) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OTP. Please check and try again." 
      });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString("hex");

    await db.query(
      `UPDATE visitor_otp
       SET verified = 1,
           otp_session_token = ?,
           verified_at = NOW()
       WHERE id = ?`,
      [sessionToken, otpRecord.id]
    );

    res.json({
      success: true,
      otpToken: sessionToken,
      message: "OTP verified successfully"
    });
  } catch (err) {
    console.error("[VISITOR_PUBLIC][OTP_VERIFY]", err);
    res.status(500).json({ 
      success: false, 
      message: "Verification failed" 
    });
  }
});

/* ======================================================
   REGISTER VISITOR
====================================================== */
router.post(
  "/visitor/:slug/register",
  upload.single("photo"),
  async (req, res) => {
    try {
      const slug = normalizeSlug(req.params.slug);
      const otpToken = req.headers["otp-token"];

      if (!otpToken) {
        return res.status(401).json({ 
          success: false, 
          message: "OTP verification required" 
        });
      }

      // Verify OTP session
      const [[otpSession]] = await db.query(
        `SELECT id, company_id, email
         FROM visitor_otp
         WHERE otp_session_token = ? AND verified = 1
         LIMIT 1`,
        [otpToken]
      );

      if (!otpSession) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid or expired session" 
        });
      }

      const company = await getCompanyBySlug(slug);
      if (!company || company.id !== otpSession.company_id) {
        return res.status(404).json({ 
          success: false, 
          message: "Invalid company" 
        });
      }

      // Validate required fields
      if (!req.body.name?.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: "Visitor name is required" 
        });
      }

      if (!req.body.phone?.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: "Phone number is required" 
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "Visitor photo is required" 
        });
      }

      // Prepare visitor data (matching visitor service structure)
      const visitorData = {
        name: req.body.name?.trim(),
        phone: req.body.phone?.trim(),
        email: otpSession.email,
        fromCompany: req.body.fromCompany?.trim() || null,
        department: req.body.department?.trim() || null,
        designation: req.body.designation?.trim() || null,
        address: req.body.address?.trim() || null,
        city: req.body.city?.trim() || null,
        state: req.body.state?.trim() || null,
        postalCode: req.body.postalCode?.trim() || null,
        country: req.body.country?.trim() || null,
        personToMeet: req.body.personToMeet?.trim() || null,
        purpose: req.body.purpose?.trim() || null,
        belongings: req.body.belongings || null,
        idType: req.body.idType?.trim() || null,
        idNumber: req.body.idNumber?.trim() || null,
      };

      // Save visitor using existing service
      const visitor = await saveVisitor(
        otpSession.company_id,
        visitorData,
        req.file
      );

      // Invalidate OTP session
      await db.query(
        `UPDATE visitor_otp SET otp_session_token = NULL WHERE id = ?`,
        [otpSession.id]
      );

      res.json({
        success: true,
        message: "Visitor registered successfully. Pass sent to email.",
        visitorCode: visitor.visitorCode,
      });
    } catch (err) {
      console.error("[VISITOR_PUBLIC][REGISTER]", err);
      
      // Return user-friendly error messages
      const message = err.message?.includes("Trial") || 
                     err.message?.includes("limit") ||
                     err.message?.includes("expired") ||
                     err.message?.includes("subscription")
        ? err.message
        : "Registration failed. Please try again.";

      res.status(500).json({ 
        success: false, 
        message 
      });
    }
  }
);

export default router;
