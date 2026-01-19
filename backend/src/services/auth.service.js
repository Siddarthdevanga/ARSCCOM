import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendEmail } from "../utils/mailer.js";

/* ======================================================
   CONSTANTS & CONFIGURATION
====================================================== */
const PASSWORD_MIN_LENGTH = 8;
const RESET_CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const JWT_EXPIRY = "7d";
const BCRYPT_ROUNDS = 10;

// Only block cancelled subscriptions, allow expired to login for renewal
const SUBSCRIPTION_BLOCKED_STATES = ["cancelled", "canceled"];

/* ======================================================
   ENV VALIDATION
====================================================== */
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

/* ======================================================
   EMAIL TEMPLATES
====================================================== */
const emailFooter = () => `
<br/>
Regards,<br/>

<img 
  src="https://arsccom-assets.s3.amazonaws.com/PROMEET/EMAILS%20LOGO.png" 
  alt="PROMEET Logo"
  style="height:65px;margin:10px 0;display:block"
/>

<hr style="border:0;border-top:1px solid #ddd;margin:10px 0;" />

<p style="font-size:13px;color:#666">
This email was automatically sent from the PROMEET
Conference & Visitor Management Platform.
If this was not you, please contact your administrator immediately.
</p>`;

/* ======================================================
   HELPER FUNCTIONS
====================================================== */
const generateSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateResetCode = () =>
  crypto.randomBytes(3).toString("hex").toUpperCase();

const validatePassword = (password) => {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new Error("Valid email is required");
  }
};

const normalizeEmail = (email) => email?.trim().toLowerCase();

/* ======================================================
   SLUG GENERATION WITH UNIQUENESS CHECK
====================================================== */
const generateUniqueSlug = async (baseSlug) => {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const [[exists]] = await db.query(
      "SELECT id FROM companies WHERE slug = ? LIMIT 1",
      [slug]
    );
    if (!exists) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
};

/* ======================================================
   REGISTER COMPANY
====================================================== */
export const registerCompany = async (data, file) => {
  // Validate required fields
  const companyName = data.companyName?.trim();
  const email = normalizeEmail(data.email);
  const phone = data.phone || null;
  const conferenceRooms = Number(data.conferenceRooms || 0);
  const password = data.password;

  if (!companyName || !email || !password || !file) {
    throw new Error("Company name, email, password and logo are required");
  }

  validateEmail(email);
  validatePassword(password);

  // Check for existing email
  const [existing] = await db.execute(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  if (existing.length) {
    throw new Error("Email already registered");
  }

  // Generate unique slug
  const baseSlug = generateSlug(companyName);
  const slug = await generateUniqueSlug(baseSlug);

  // Upload logo to S3
  const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
  const logoKey = `companies/${slug}/logo${ext}`;
  const logoUrl = await uploadToS3(file, logoKey);

  // Start transaction
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Insert company
    const [companyResult] = await conn.execute(
      `INSERT INTO companies 
       (name, slug, logo_url, rooms, subscription_status, plan)
       VALUES (?, ?, ?, ?, 'pending', 'trial')`,
      [companyName, slug, logoUrl, conferenceRooms]
    );

    const companyId = companyResult.insertId;

    // Hash password and insert user
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await conn.execute(
      `INSERT INTO users (company_id, email, phone, password_hash)
       VALUES (?, ?, ?, ?)`,
      [companyId, email, phone, passwordHash]
    );

    // Create conference rooms if specified
    if (conferenceRooms > 0) {
      const roomValues = Array.from({ length: conferenceRooms }, (_, i) => [
        companyId,
        `Conference Room ${i + 1}`,
        i + 1,
      ]);

      await conn.query(
        `INSERT INTO conference_rooms (company_id, room_name, room_number)
         VALUES ?`,
        [roomValues]
      );
    }

    await conn.commit();

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, companyName).catch(console.error);

    return { companyId, companyName, slug, logoUrl };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   SEND WELCOME EMAIL
====================================================== */
const sendWelcomeEmail = async (email, companyName) => {
  await sendEmail({
    to: email,
    subject: `Welcome ${companyName} — Activate Your PROMEET Subscription`,
    html: `
      <p>Hello <b>${companyName}</b>,</p>

      <p>
        Your organization has been successfully registered on 
        <b>PROMEET – Visitor & Conference Room Management Platform.</b>
      </p>

      <h3 style="color:#6c2bd9;margin-bottom:6px;">
        Next Step: Login & Choose Your Subscription Plan
      </h3>

      <p>
        To continue using PROMEET, please login and activate one of the subscription plans:
      </p>

      <ul style="font-size:14px;margin-top:8px;margin-bottom:12px;">
        <li><b>Trial</b> – Evaluate PROMEET and experience core features.</li>
        <li><b>Business</b> – Designed for growing organizations with advanced capabilities.</li>
        <li><b>Enterprise</b> – Tailored, scalable and secure for large enterprises.</li>
      </ul>

      <h3 style="color:#6c2bd9;margin-bottom:6px;">
        What PROMEET Delivers to ${companyName}
      </h3>

      <ul style="font-size:14px;">
        <li><b>Dedicated QR Code</b> – Visitors can self-register instantly by scanning a dedicated QR code.</li>
        <li><b>Instant Digital Visitor Pass</b> – Secure virtual passes via Email / WhatsApp.</li>
        <li><b>Powerful Live Dashboard</b> – Real-time check-ins, check-outs & analytics.</li>
        <li><b>Conference Room Booking</b> – Quick booking with automatic email alerts.</li>
        <li><b>Dedicated Company Access Link</b> – Employees login via OTP. Zero HR dependency.</li>
        <li><b>Fully Automated Workflow</b> – No registers, spreadsheets or paper passes.</li>
        <li><b>Enterprise-Grade Security</b> – Role-based authentication & encrypted data handling.</li>
      </ul>

      <p>
        Login, activate your subscription, and empower <b>${companyName}</b> with smarter Visitor & Conference Management.
      </p>

      ${emailFooter()}
    `
  });
};

/* ======================================================
   LOGIN
   --------------------------------------------------------
   IMPORTANT: Users with "expired" subscriptions CAN login
   so they can navigate to /auth/subscription to renew.
   Frontend handles the redirect based on subscription_status.
====================================================== */
export const login = async ({ email, password }) => {
  const cleanEmail = normalizeEmail(email);
  
  if (!cleanEmail || !password) {
    throw new Error("Email and password are required");
  }

  validateEmail(cleanEmail);

  // Fetch user and company data
  const [rows] = await db.execute(
    `SELECT
       u.id,
       u.password_hash,
       c.id       AS companyId,
       c.name     AS companyName,
       c.slug     AS companySlug,
       c.logo_url AS companyLogo,
       c.subscription_status,
       c.plan
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.email = ?
     LIMIT 1`,
    [cleanEmail]
  );

  if (!rows.length) {
    throw new Error("Invalid credentials");
  }

  const user = rows[0];

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error("Invalid credentials");
  }

  // Only block cancelled subscriptions - allow expired to login for renewal
  if (SUBSCRIPTION_BLOCKED_STATES.includes(user.subscription_status)) {
    throw new Error("Your subscription has been cancelled. Please contact support.");
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      companyId: user.companyId,
      email: cleanEmail,
      companyName: user.companyName
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  return {
    token,
    user: { 
      id: user.id, 
      email: cleanEmail 
    },
    company: {
      id: user.companyId,
      name: user.companyName,
      slug: user.companySlug,
      logo_url: user.companyLogo,
      subscription_status: user.subscription_status || "pending",
      plan: user.plan || "trial"
    }
  };
};

/* ======================================================
   FORGOT PASSWORD WITH RESEND COOLDOWN
====================================================== */
export const forgotPassword = async (email) => {
  const cleanEmail = normalizeEmail(email);
  
  if (!cleanEmail) {
    throw new Error("Email is required");
  }

  validateEmail(cleanEmail);

  // Fetch user data
  const [rows] = await db.execute(
    `SELECT 
       u.id, 
       u.reset_last_sent,
       c.name AS companyName
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.email = ? 
     LIMIT 1`,
    [cleanEmail]
  );

  // Return early if user not found (don't leak this info)
  if (!rows.length) {
    return { sent: true, waitSeconds: RESEND_COOLDOWN_SECONDS };
  }

  const user = rows[0];

  // Check resend cooldown
  let waitSeconds = 0;

  if (user.reset_last_sent) {
    const [timeRow] = await db.query(
      `SELECT GREATEST(0, ? - TIMESTAMPDIFF(SECOND, reset_last_sent, NOW())) AS waitSeconds
       FROM users WHERE id = ?`,
      [RESEND_COOLDOWN_SECONDS, user.id]
    );
    waitSeconds = timeRow[0].waitSeconds;
  }

  if (waitSeconds > 0) {
    return { sent: false, waitSeconds };
  }

  // Generate and save reset code
  const resetCode = generateResetCode();

  await db.execute(
    `UPDATE users
     SET reset_code = ?,
         reset_expires = DATE_ADD(NOW(), INTERVAL ? MINUTE),
         reset_last_sent = NOW()
     WHERE id = ?`,
    [resetCode, RESET_CODE_EXPIRY_MINUTES, user.id]
  );

  // Send reset email (non-blocking)
  sendPasswordResetEmail(cleanEmail, user.companyName, resetCode).catch(console.error);

  return { sent: true, waitSeconds: RESEND_COOLDOWN_SECONDS };
};

/* ======================================================
   SEND PASSWORD RESET EMAIL
====================================================== */
const sendPasswordResetEmail = async (email, companyName, resetCode) => {
  await sendEmail({
    to: email,
    subject: "PROMEET — Secure Password Reset Code",
    html: `
      <p>Hello <b>${companyName}</b>,</p>

      <p>
        We received a request to reset your PROMEET account password. 
        To proceed, please use the secure verification code below:
      </p>

      <div style="background:#f8f9ff;border-left:4px solid #6c2bd9;padding:20px;margin:20px 0;text-align:center;">
        <h2 style="color:#6c2bd9;margin:0;letter-spacing:4px;font-size:32px;">
          ${resetCode}
        </h2>
      </div>

      <p>
        <b>Important Security Information:</b>
      </p>

      <ul style="font-size:14px;line-height:1.8;">
        <li>This code is valid for <b>${RESET_CODE_EXPIRY_MINUTES} minutes</b> only.</li>
        <li>Enter this code in the PROMEET password reset page.</li>
        <li>If you did not request this reset, please ignore this email and contact your administrator immediately.</li>
        <li>Never share this code with anyone, including PROMEET support staff.</li>
      </ul>

      <p>
        For security reasons, password reset codes expire quickly. 
        If your code has expired, simply request a new one from the login page.
      </p>

      <p style="color:#666;font-size:13px;margin-top:30px;">
        <b>Note:</b> You can request a new code every ${RESEND_COOLDOWN_SECONDS} seconds if needed.
      </p>

      ${emailFooter()}
    `
  });
};

/* ======================================================
   RESET PASSWORD
====================================================== */
export const resetPassword = async ({ email, code, password }) => {
  const cleanEmail = normalizeEmail(email);
  
  if (!cleanEmail || !code || !password) {
    throw new Error("Email, code and password are required");
  }

  validateEmail(cleanEmail);
  validatePassword(password);

  // Fetch user with valid reset code
  const [rows] = await db.execute(
    `SELECT 
       u.id, 
       u.reset_code,
       c.name AS companyName
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.email = ?
       AND u.reset_expires > NOW()
     LIMIT 1`,
    [cleanEmail]
  );

  if (!rows.length || rows[0].reset_code !== code.toUpperCase()) {
    throw new Error("Invalid or expired reset code");
  }

  const user = rows[0];

  // Hash new password and update
  const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db.execute(
    `UPDATE users
     SET password_hash = ?,
         reset_code = NULL,
         reset_expires = NULL,
         reset_last_sent = NULL
     WHERE id = ?`,
    [newHash, user.id]
  );

  // Send confirmation email (non-blocking)
  sendPasswordChangedEmail(cleanEmail, user.companyName).catch(console.error);

  return { message: "Password reset successful" };
};

/* ======================================================
   SEND PASSWORD CHANGED EMAIL
====================================================== */
const sendPasswordChangedEmail = async (email, companyName) => {
  await sendEmail({
    to: email,
    subject: "PROMEET — Password Successfully Changed",
    html: `
      <p>Hello <b>${companyName}</b>,</p>

      <p>
        This email confirms that your PROMEET account password has been 
        <b style="color:#00c853;">successfully changed</b>.
      </p>

      <div style="background:#e8f5e9;border-left:4px solid #00c853;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#2e7d32;font-weight:600;">
          ✓ Your password has been updated securely
        </p>
      </div>

      <h3 style="color:#6c2bd9;margin-top:30px;margin-bottom:10px;">
        What This Means
      </h3>

      <ul style="font-size:14px;line-height:1.8;">
        <li>You can now login to PROMEET using your new password.</li>
        <li>Your account security has been enhanced with password encryption.</li>
        <li>All active sessions remain valid — no need to re-login immediately.</li>
      </ul>

      <h3 style="color:#6c2bd9;margin-top:30px;margin-bottom:10px;">
        Important Security Notice
      </h3>

      <p>
        <b style="color:#ff1744;">Did you make this change?</b>
      </p>

      <ul style="font-size:14px;line-height:1.8;">
        <li>
          <b>If yes:</b> No further action required. Your account is secure.
        </li>
        <li>
          <b>If no:</b> Someone may have unauthorized access to your account. 
          Please contact your administrator <b>immediately</b> and reset your password again.
        </li>
      </ul>

      <div style="background:#fff3e0;border-left:4px solid #ff9800;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#e65100;font-weight:600;">
          ⚠️ Security Tip: Use a strong, unique password for PROMEET. 
          Never share your password with anyone.
        </p>
      </div>

      <p>
        Thank you for using PROMEET to manage your organization's visitor and 
        conference room operations securely.
      </p>

      ${emailFooter()}
    `
  });
};
