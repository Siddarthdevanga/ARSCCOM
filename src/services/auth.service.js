import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";

import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendEmail } from "../utils/mailer.js";

/* ======================================================
   ENV VALIDATION
====================================================== */
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

/* ======================================================
   HELPERS
====================================================== */

const sanitizeCompany = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

const generateResetCode = () =>
  crypto.randomBytes(3).toString("hex").toUpperCase();

const validatePassword = (password) => {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
};

/* ======================================================
   REGISTER COMPANY
====================================================== */
export const registerCompany = async (data, file) => {
  const {
    companyName,
    email,
    phone,
    conferenceRooms = 0,
    password
  } = data;

  if (!companyName || !email || !password || !file) {
    throw new Error("Company name, email, password and logo are required");
  }

  validatePassword(password);

  const [existing] = await db.execute(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (existing.length) {
    throw new Error("Email already registered");
  }

  const safeCompany = sanitizeCompany(companyName);
  const ext = path.extname(file.originalname).toLowerCase() || ".png";
  const logoKey = `companies/${safeCompany}/logo${ext}`;

  const logoUrl = await uploadToS3(file, logoKey);

  const [companyResult] = await db.execute(
    `INSERT INTO companies (name, logo_url, rooms)
     VALUES (?, ?, ?)` ,
    [companyName, logoUrl, conferenceRooms]
  );

  const passwordHash = await bcrypt.hash(password, 10);

  await db.execute(
    `INSERT INTO users (company_id, email, phone, password_hash)
     VALUES (?, ?, ?, ?)`,
    [companyResult.insertId, email, phone || null, passwordHash]
  );

  sendEmail({
    to: email,
    subject: "Welcome to ARSCCOM 🎉",
    html: `
      <h3>Welcome to ARSCCOM</h3>
      <p>Your company <b>${companyName}</b> has been registered.</p>
      <p>You can now select the plan of your choice and log in and manage your visitors and manage bookings of conferece rooms.</p>
    `
  }).catch(() => {});

  return {
    companyId: companyResult.insertId,
    companyName,
    logoUrl
  };
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const [rows] = await db.execute(
    `SELECT
        u.id,
        u.password_hash,
        c.id AS companyId,
        c.name AS companyName,
        c.logo_url AS companyLogo
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.email = ?`,
    [email]
  );

  if (!rows.length) {
    throw new Error("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const token = jwt.sign(
    {
      userId: rows[0].id,
      companyId: rows[0].companyId
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    token,
    company: {
      id: rows[0].companyId,
      name: rows[0].companyName,
      logo: rows[0].companyLogo
    }
  };
};

/* ======================================================
   FORGOT PASSWORD ✅ REFINED (ONLY THIS PART)
====================================================== */
export const forgotPassword = async (email) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) return;

  console.log("🔐 FORGOT PASSWORD REQUEST:", cleanEmail);

  const [rows] = await db.execute(
    "SELECT id FROM users WHERE email = ?",
    [cleanEmail]
  );

  // Silent exit (security)
  if (!rows.length) {
    console.log("⚠️ FORGOT PASSWORD: email not found (silent)");
    return;
  }

  const resetCode = generateResetCode();

  await db.execute(
    `UPDATE users
     SET reset_code = ?,
         reset_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
     WHERE id = ?`,
    [resetCode, rows[0].id]
  );

  console.log("🔑 RESET CODE GENERATED:", resetCode);

  try {
    await sendEmail({
      to: cleanEmail,
      subject: "ARSCCOM Password Reset Code",
      html: `
        <p>Your password reset code:</p>
        <h2>${resetCode}</h2>
        <p>This code is valid for <b>10 minutes</b>.</p>
      `
    });

    console.log("📧 FORGOT PASSWORD MAIL SENT:", cleanEmail);

  } catch (err) {
    console.error("❌ FORGOT PASSWORD MAIL FAILED:", err.message);
    throw err;
  }
};

/* ======================================================
   RESET PASSWORD
====================================================== */
export const resetPassword = async ({ email, code, password }) => {
  if (!email || !code || !password) {
    throw new Error("Email, code and password are required");
  }

  validatePassword(password);

  const [rows] = await db.execute(
    `SELECT id, reset_code
     FROM users
     WHERE email = ?
       AND reset_expires > NOW()`,
    [email]
  );

  if (!rows.length || rows[0].reset_code !== code) {
    throw new Error("Invalid or expired reset code");
  }

  const newHash = await bcrypt.hash(password, 10);

  await db.execute(
    `UPDATE users
     SET password_hash = ?,
         reset_code = NULL,
         reset_expires = NULL
     WHERE id = ?`,
    [newHash, rows[0].id]
  );

  return { message: "Password reset successful" };
};
