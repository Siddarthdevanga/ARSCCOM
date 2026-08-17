import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendEmail } from "../utils/mailer.js";
import { autoCheckoutStaleVisitors } from "./visitor.service.js";
import { PLAN_FEATURES } from "../constants/pricing.js";
import { deriveCodePrefix } from "../utils/codePrefix.js";

/* ======================================================
   CONSTANTS & CONFIGURATION
====================================================== */
const PASSWORD_MIN_LENGTH = 8;
const RESET_CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const JWT_EXPIRY = "12h";
export const BCRYPT_ROUNDS = 10;

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
export const emailFooter = () => `
<br/>
Regards,<br/>

<div style="background:#6c2bd9;border-radius:10px;padding:14px 18px;margin:10px 0;display:inline-block;">
  <img
    src="https://www.haivisitor.zodopt.com/haivisitor.png"
    alt="Hai Visitor Logo"
    style="height:65px;display:block"
  />
</div>

<hr style="border:0;border-top:1px solid #ddd;margin:10px 0;" />

<p style="font-size:13px;color:#666">
This email was automatically sent from the Hai Visitor
Conference & Visitor Management Platform.
If this was not you, please contact your administrator immediately.
</p>`;

/* ======================================================
   HELPER FUNCTIONS
====================================================== */
export const generateSlug = (name) =>
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

const validateWhatsAppUrl = (url) => {
  if (!url) return null; // Optional field
  
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;
  
  // Accept any WhatsApp URL — direct chat (wa.me/api.whatsapp.com), group
  // or community invite (chat.whatsapp.com), channel, business, etc. — with
  // www. optional throughout, since WhatsApp's own share buttons generate
  // slightly different link shapes depending on which one you use.
  const whatsappPattern = /^https:\/\/(www\.)?(([a-z0-9-]+\.)?whatsapp\.com|wa\.me)\/.+/i;
  if (!whatsappPattern.test(trimmedUrl)) {
    throw new Error("Invalid WhatsApp URL. Accepted: any wa.me or whatsapp.com link (chat, group/community invite, channel, etc.)");
  }
  
  return trimmedUrl;
};

export const normalizeEmail = (email) => email?.trim().toLowerCase();

/* ======================================================
   SLUG GENERATION WITH UNIQUENESS CHECK
====================================================== */
export const generateUniqueSlug = async (baseSlug) => {
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
  // Every new signup starts on the trial plan — conference room count is
  // no longer user-chosen at registration, it's provisioned to match the
  // trial plan's own room cap (same number PLAN_FEATURES/syncRoomActivationByPlan
  // would grant a trial company anywhere else in the app).
  const conferenceRooms = PLAN_FEATURES.trial.rooms;
  const password = data.password;
  const whatsappUrl = validateWhatsAppUrl(data.whatsappUrl); // Optional field

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

    // Insert company with optional WhatsApp URL
    const codePrefix = deriveCodePrefix(companyName);
    const [companyResult] = await conn.execute(
      `INSERT INTO companies
       (name, slug, code_prefix, logo_url, rooms, whatsapp_url, subscription_status, plan)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'trial')`,
      [companyName, slug, codePrefix, logoUrl, conferenceRooms, whatsappUrl]
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

    // Log the new company straight in so the frontend can skip a manual
    // login step and land directly on /subscription — same token +
    // company shape a normal login would produce, so every page that reads
    // `company` from storage behaves identically either way.
    return await login({ email, password });

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
    subject: `Welcome ${companyName} — Activate Your Hai Visitor Subscription`,
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

        <!-- BRAND HEADER -->
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">
            H<span style="color:#FDBA74;">ai</span> Visitor
          </div>
          <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">
            Registration Complete
          </div>
        </div>

        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello <b>${companyName}</b>,</p>

          <p style="font-size:15px;color:#262046;">
            Your organization has been successfully registered on <b>Hai Visitor</b> —
            Visitor &amp; Conference Room Management Platform.
          </p>

          <!-- NEXT STEP -->
          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#EA580C;margin:0 0 10px;font-size:15px;">Next Step: Choose Your Subscription Plan</h3>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;"><b>Trial</b> — Evaluate Hai Visitor and experience core features</td></tr>
              <tr><td style="padding:4px 0;"><b>Business</b> — Designed for growing organizations with advanced capabilities</td></tr>
              <tr><td style="padding:4px 0;"><b>Enterprise</b> — Tailored, scalable and secure for large enterprises</td></tr>
            </table>
          </div>

          <!-- WHAT YOU GET -->
          <div style="background:#F1ECFB;border-left:4px solid #7C3AED;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#7C3AED;margin:0 0 10px;font-size:15px;">What Hai Visitor Delivers to ${companyName}</h3>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;">✅&nbsp; Dedicated QR Code for instant visitor self-registration</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; Instant Digital Visitor Pass via Email / WhatsApp</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; Powerful Live Dashboard with real-time check-ins &amp; analytics</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; Conference Room Booking with automatic email alerts</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; Dedicated Company Access Link — employees login via OTP</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; Fully Automated Workflow — no registers or paper passes</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; Enterprise-Grade Security &amp; encrypted data handling</td></tr>
            </table>
          </div>

          <p style="font-size:14px;color:#262046;">
            Login, activate your subscription, and empower <b>${companyName}</b> with smarter Visitor &amp; Conference Management.
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin-top:28px;">
            <a href="https://www.haivisitor.zodopt.com/login" style="display:inline-block;background:#F97316;background-image:linear-gradient(95deg,#F97316,#EF3E66);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:999px;">
              Login &amp; Choose Your Plan →
            </a>
          </div>

          ${emailFooter()}
        </div>
      </div>
    `
  });
};

/* ======================================================
   ACCOUNT READY (Razorpay flow — after complete-registration)
====================================================== */
const sendAccountReadyEmail = async (email, companyName) => {
  await sendEmail({
    to: email,
    subject: `You're All Set, ${companyName} — Start Using Hai Visitor`,
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

        <!-- BRAND HEADER -->
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">
            H<span style="color:#FDBA74;">ai</span> Visitor
          </div>
          <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">
            Account Ready
          </div>
        </div>

        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello <b>${companyName}</b>,</p>

          <p style="font-size:15px;color:#262046;">
            Your account is ready. Here's a quick look at what you can do with <b>Hai Visitor</b>.
          </p>

          <!-- VISITOR REGISTRATION -->
          <div style="background:#F1ECFB;border-left:4px solid #7C3AED;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#7C3AED;margin:0 0 8px;font-size:15px;">📋&nbsp; Registering Visitors</h3>
            <p style="font-size:14px;color:#262046;line-height:1.6;margin:0;">
              Visitors register themselves in seconds by scanning your company's QR
              code — no app download, no dedicated hardware. The host gets notified
              instantly and the visitor receives a digital pass, with every check-in
              logged automatically.
            </p>
          </div>

          <!-- REPORTS & ANALYTICS -->
          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#EA580C;margin:0 0 8px;font-size:15px;">📊&nbsp; Reports &amp; Analytics</h3>
            <p style="font-size:14px;color:#262046;line-height:1.6;margin:0;">
              A live dashboard of who's checked in, visit history, and trends over
              time — searchable and exportable, so you always have a record to fall
              back on.
            </p>
          </div>

          <!-- EMPLOYEE DIRECTORY & FORM BUILDER -->
          <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#16A34A;margin:0 0 10px;font-size:15px;">👥&nbsp; Employee Directory &amp; Form Builder</h3>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;">Add your team as hosts — notifications route straight to the right person</td></tr>
              <tr><td style="padding:4px 0;">Customize the visitor registration form — add, remove or reorder fields</td></tr>
            </table>
          </div>

          <!-- ACCOUNT SETTINGS -->
          <div style="background:#F1ECFB;border-left:4px solid #7C3AED;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#7C3AED;margin:0 0 8px;font-size:15px;">⚙️&nbsp; Account Settings</h3>
            <p style="font-size:14px;color:#262046;line-height:1.6;margin:0;">
              Update your company logo, WhatsApp number, visitor code prefix and
              other preferences any time from Settings.
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin-top:28px;">
            <a href="https://www.haivisitor.zodopt.com/home" style="display:inline-block;background:#F97316;background-image:linear-gradient(95deg,#F97316,#EF3E66);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:999px;">
              Login to Hai Visitor →
            </a>
          </div>

          ${emailFooter()}
        </div>
      </div>
    `
  });
};

/* ======================================================
   LOGIN
   --------------------------------------------------------
   IMPORTANT: Users with "expired" subscriptions CAN login
   so they can navigate to /subscription to renew.
   Frontend handles the redirect based on subscription_status.
====================================================== */
export const login = async ({ identifier, email, password }) => {
  // `identifier` is the new email-or-phone field; `email` kept as a fallback
  // so registerCompany()'s internal call (and any other existing caller)
  // doesn't need to change.
  const rawIdentifier = (identifier ?? email ?? "").trim();

  if (!rawIdentifier || !password) {
    throw new Error("Email or phone number, and password, are required");
  }

  // A phone identifier is all-digits (10-digit Indian mobile); anything else
  // is treated as an email and normalized the same way registration does.
  const isPhone = /^\d{10}$/.test(rawIdentifier);
  const cleanEmail = isPhone ? null : normalizeEmail(rawIdentifier);
  const cleanPhone = isPhone ? rawIdentifier : null;

  if (!isPhone) validateEmail(cleanEmail);

  // Fetch user and company data (including grace period info)
  const [rows] = await db.execute(
    `SELECT
       u.id,
       u.email,
       u.phone,
       u.password_hash,
       u.must_change_password,
       c.id       AS companyId,
       c.name     AS companyName,
       c.slug     AS companySlug,
       c.logo_url AS companyLogo,
       c.whatsapp_url AS whatsappUrl,
       c.subscription_status,
       c.plan,
       c.registration_source,
       c.registration_complete,
       c.grace_period_ends_at,
       c.grace_period_day
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.email = ? OR u.phone = ?
     LIMIT 1`,
    [cleanEmail, cleanPhone]
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
      email: user.email,
      companyName: user.companyName
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  // Calculate grace period info
  const inGracePeriod = user.grace_period_ends_at &&
                        new Date(user.grace_period_ends_at) > new Date();

  let gracePeriodDaysRemaining = 0;
  if (inGracePeriod) {
    const endsAt = new Date(user.grace_period_ends_at);
    const now = new Date();
    gracePeriodDaysRemaining = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
  }

  // Fire-and-forget: auto-checkout any visitors still IN from a previous day
  autoCheckoutStaleVisitors().catch(console.error);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      must_change_password: !!user.must_change_password,
    },
    company: {
      id: user.companyId,
      name: user.companyName,
      slug: user.companySlug,
      logo_url: user.companyLogo ? `/api/logo/${user.companyId}` : null,
      whatsapp_url: user.whatsappUrl || null,
      subscription_status: user.subscription_status || "pending",
      plan: user.plan || "trial",
      registration_source: user.registration_source || "web",
      registration_complete: !!user.registration_complete,
      grace_period_days_remaining: gracePeriodDaysRemaining,
      in_grace_period: inGracePeriod,
    }
  };
};

/* ======================================================
   COMPLETE REGISTRATION
   --------------------------------------------------------
   For companies created via the Razorpay payment-link flow
   (registration_source='razorpay'), which only had a Name/Email/
   Phone at signup. Sets the real company name, logo and WhatsApp
   URL, replaces the temp password, and flips registration_complete.
   Regenerates slug/code_prefix from the real name — safe since
   registration_complete=0 means nothing has used the placeholder
   values yet.
====================================================== */
export const completeRegistration = async ({ companyId, userId, companyName, password, whatsappUrl }, file) => {
  const cleanCompanyName = companyName?.trim();
  if (!cleanCompanyName || cleanCompanyName.length < 3) {
    throw new Error("Company name must be at least 3 characters");
  }
  if (/^\d+$/.test(cleanCompanyName)) {
    throw new Error("Company name cannot be numeric only");
  }

  validatePassword(password);

  const cleanWhatsappUrl = validateWhatsAppUrl(whatsappUrl);

  const baseSlug = generateSlug(cleanCompanyName);
  const slug = await generateUniqueSlug(baseSlug);
  const codePrefix = deriveCodePrefix(cleanCompanyName);

  let logoKey = null;
  if (file) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    logoKey = `companies/${slug}/logo${ext}`;
    logoKey = await uploadToS3(file, logoKey);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE companies SET
         name = ?, slug = ?, code_prefix = ?,
         logo_url = COALESCE(?, logo_url),
         whatsapp_url = ?,
         registration_complete = 1
       WHERE id = ?`,
      [cleanCompanyName, slug, codePrefix, logoKey, cleanWhatsappUrl, companyId]
    );

    await conn.execute(
      `UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ? AND company_id = ?`,
      [passwordHash, userId, companyId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [[updated]] = await db.execute(
    `SELECT c.id, c.name, c.slug, c.logo_url, c.whatsapp_url, c.subscription_status, c.plan,
            c.registration_source, c.registration_complete, u.email AS userEmail
     FROM companies c JOIN users u ON u.company_id = c.id AND u.id = ?
     WHERE c.id = ?`,
    [userId, companyId]
  );

  if (updated?.userEmail) {
    Promise.allSettled([
      sendPasswordChangedEmail(updated.userEmail, cleanCompanyName),
      sendAccountReadyEmail(updated.userEmail, cleanCompanyName),
    ]).then((results) => {
      results.forEach((r) => { if (r.status === "rejected") console.error("[COMPLETE REGISTRATION] notification failed:", r.reason); });
    });
  }

  return {
    company: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      logo_url: updated.logo_url ? `/api/logo/${updated.id}` : null,
      whatsapp_url: updated.whatsapp_url || null,
      subscription_status: updated.subscription_status,
      plan: updated.plan,
      registration_source: updated.registration_source,
      registration_complete: !!updated.registration_complete,
    },
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
    subject: "Hai Visitor — Secure Password Reset Code",
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

        <!-- BRAND HEADER -->
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">
            H<span style="color:#FDBA74;">ai</span> Visitor
          </div>
          <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">
            Password Reset Requested
          </div>
        </div>

        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello <b>${companyName}</b>,</p>

          <p style="font-size:15px;color:#262046;">
            We received a request to reset your Hai Visitor account password.
            Use the secure verification code below to proceed:
          </p>

          <!-- RESET CODE -->
          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:20px 18px;margin:20px 0;text-align:center;">
            <h3 style="color:#EA580C;margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Your Verification Code</h3>
            <div style="font-size:32px;font-weight:800;letter-spacing:6px;background:#ffffff;border:1px dashed #F97316;color:#221C53;padding:14px 16px;border-radius:8px;">
              ${resetCode}
            </div>
            <p style="font-size:13px;color:#6E6890;margin:10px 0 0;">
              Valid for <b>${RESET_CODE_EXPIRY_MINUTES} minutes</b> only
            </p>
          </div>

          <!-- SECURITY INFO -->
          <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#16A34A;margin:0 0 10px;font-size:15px;">Important Security Information</h3>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;">Enter this code on the Hai Visitor password reset page</td></tr>
              <tr><td style="padding:4px 0;">If you did not request this, ignore this email and contact your administrator immediately</td></tr>
              <tr><td style="padding:4px 0;">Never share this code with anyone, including Hai Visitor support staff</td></tr>
            </table>
          </div>

          <p style="font-size:13px;color:#6E6890;">
            If your code has expired, simply request a new one from the login page.
            You can request a new code every ${RESEND_COOLDOWN_SECONDS} seconds if needed.
          </p>

          ${emailFooter()}
        </div>
      </div>
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
    subject: "Hai Visitor — Password Successfully Changed",
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

        <!-- BRAND HEADER -->
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">
            H<span style="color:#FDBA74;">ai</span> Visitor
          </div>
          <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">
            Password Changed
          </div>
        </div>

        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello <b>${companyName}</b>,</p>

          <p style="font-size:15px;color:#262046;">
            This email confirms that your Hai Visitor account password has been
            <b style="color:#16A34A;">successfully changed</b>.
          </p>

          <!-- CONFIRMATION -->
          <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#16A34A;margin:0 0 10px;font-size:15px;">✓ What This Means</h3>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;">You can now login to Hai Visitor using your new password</td></tr>
              <tr><td style="padding:4px 0;">Your account security has been enhanced with password encryption</td></tr>
              <tr><td style="padding:4px 0;">All active sessions remain valid — no need to re-login immediately</td></tr>
            </table>
          </div>

          <!-- SECURITY NOTICE -->
          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#EA580C;margin:0 0 10px;font-size:15px;">⚠️&nbsp; Important Security Notice</h3>
            <p style="font-size:14px;color:#262046;margin:0 0 8px;"><b>Did you make this change?</b></p>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;"><b>If yes:</b> No further action required. Your account is secure.</td></tr>
              <tr><td style="padding:4px 0;"><b>If no:</b> Someone may have unauthorized access. Contact your administrator immediately and reset your password again.</td></tr>
            </table>
          </div>

          <p style="font-size:14px;color:#262046;">
            Thank you for using Hai Visitor to manage your organization's visitor and
            conference room operations securely.
          </p>

          ${emailFooter()}
        </div>
      </div>
    `
  });
};
