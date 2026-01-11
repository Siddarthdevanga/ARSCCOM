import express from "express";
import { db } from "../config/db.js";
import { saveVisitor } from "../services/visitor.service.js";
import multer from "multer";
import QRCode from "qrcode";
import crypto from "crypto";
import nodemailer from "nodemailer";

const router = express.Router();

/* ======================================================
   HARD-CODED OTP RULES (AS REQUESTED)
====================================================== */
const OTP_EXPIRY_MINUTES = 5;   // ⏱️ OTP valid for 5 minutes
const OTP_RESEND_SECONDS = 30;  // 🔁 Resend allowed after 30 seconds

/* ======================================================
   MULTER (PHOTO UPLOAD)
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
   MAIL CONFIG (FROM SECRETS MANAGER)
====================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
   SEND OTP EMAIL
====================================================== */
const sendOtpMail = async (email, otp, companyName) => {
  await transporter.sendMail({
    from: `"${companyName}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your Visitor Verification Code",
    html: `
      <h2>${companyName} – Visitor Verification</h2>
      <p>Your OTP is:</p>
      <h1 style="letter-spacing:4px">${otp}</h1>
      <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
    `,
  });
};

/* ======================================================
   SEND VISITOR PASS EMAIL
====================================================== */
const sendVisitorPassMail = async (visitor, company) => {
  await transporter.sendMail({
    from: `"${company.name}" <${process.env.SMTP_USER}>`,
    to: visitor.email,
    subject: "Your Visitor Pass",
    html: `
      <h2>Welcome to ${company.name}</h2>
      <p><b>Name:</b> ${visitor.name}</p>
      <p><b>Visitor Code:</b> ${visitor.visitor_code}</p>
      <p><b>Check-in:</b> ${visitor.check_in}</p>
      <p>Please show this email at reception.</p>
    `,
  });
};

/* ======================================================
   QR CODE (PUBLIC URL)
====================================================== */
router.get("/visitor/:slug/info", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }

    const publicUrl = `${process.env.PUBLIC_BASE_URL}/api/public/visitor/${slug}`;

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
    console.error("[QR_INFO]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ======================================================
   SEND OTP (WELCOME PAGE)
====================================================== */
router.post("/visitor/:slug/otp/send", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }

    const company = await getCompanyBySlug(slug);
    if (!company) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }

    // ⏱️ Resend throttle
    const [[last]] = await db.query(
      `SELECT otp_last_sent_at
       FROM visitors
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
          message: `Wait ${Math.ceil(
            OTP_RESEND_SECONDS - diff
          )} seconds to resend OTP`,
        });
      }
    }

    const otp = generateOTP();

    await db.query(
      `INSERT INTO visitors
       (company_id, email, otp_hash, otp_expires_at, otp_last_sent_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
      [company.id, email, hashOTP(otp), OTP_EXPIRY_MINUTES]
    );

    await sendOtpMail(email, otp, company.name);

    res.json({
      success: true,
      message: "OTP sent to email",
      resendAfter: OTP_RESEND_SECONDS,
    });
  } catch (err) {
    console.error("[OTP_SEND]", err);
    res.status(500).json({ success: false, message: "OTP send failed" });
  }
});

/* ======================================================
   VERIFY OTP
====================================================== */
router.post("/visitor/:slug/otp/verify", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;

    const [[visitor]] = await db.query(
      `SELECT id, otp_hash, otp_expires_at
       FROM visitors
       WHERE email = ?
       ORDER BY id DESC
       LIMIT 1`,
      [email]
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: "OTP not found" });
    }

    if (new Date(visitor.otp_expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (hashOTP(otp) !== visitor.otp_hash) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");

    await db.query(
      `UPDATE visitors
       SET otp_verified_at = NOW(),
           otp_session_token = ?
       WHERE id = ?`,
      [sessionToken, visitor.id]
    );

    res.json({
      success: true,
      otpToken: sessionToken,
    });
  } catch (err) {
    console.error("[OTP_VERIFY]", err);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

/* ======================================================
   REGISTER VISITOR (AFTER OTP)
====================================================== */
router.post(
  "/visitor/:slug/register",
  upload.single("photo"),
  async (req, res) => {
    try {
      const otpToken = req.headers["otp-token"];
      if (!otpToken) {
        return res.status(401).json({ success: false, message: "OTP required" });
      }

      const [[visitor]] = await db.query(
        `SELECT id, company_id, email
         FROM visitors
         WHERE otp_session_token = ?`,
        [otpToken]
      );

      if (!visitor) {
        return res.status(401).json({ success: false, message: "Invalid session" });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: "Photo required" });
      }

      const updatedVisitor = await saveVisitor(
        visitor.company_id,
        {
          name: req.body.name?.trim(),
          phone: req.body.phone?.trim(),
          fromCompany: req.body.fromCompany?.trim(),
          purpose: req.body.purpose?.trim(),
        },
        req.file,
        visitor.id
      );

      const [[company]] = await db.query(
        `SELECT name FROM companies WHERE id = ?`,
        [visitor.company_id]
      );

      await sendVisitorPassMail(updatedVisitor, company);

      res.json({
        success: true,
        message: "Visitor registered & pass sent",
        visitorCode: updatedVisitor.visitor_code,
      });
    } catch (err) {
      console.error("[REGISTER]", err);
      res.status(500).json({ success: false, message: "Registration failed" });
    }
  }
);

export default router;

