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
   EMAIL FOOTER
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
   HELPERS
====================================================== */
const generateSlug = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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
  const companyName = data.companyName?.trim();
  const email = data.email?.trim().toLowerCase();
  const phone = data.phone || null;
  const conferenceRooms = Number(data.conferenceRooms || 0);
  const password = data.password;

  if (!companyName || !email || !password || !file) {
    throw new Error("Company name, email, password and logo are required");
  }

  validatePassword(password);

  const [existing] = await db.execute(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  if (existing.length) throw new Error("Email already registered");

  let baseSlug = generateSlug(companyName);
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const [[exists]] = await db.query(
      "SELECT id FROM companies WHERE slug=? LIMIT 1",
      [slug]
    );
    if (!exists) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
  const logoKey = `companies/${slug}/logo${ext}`;
  const logoUrl = await uploadToS3(file, logoKey);

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [companyResult] = await conn.execute(
      `
      INSERT INTO companies 
      (name, slug, logo_url, rooms, subscription_status, plan)
      VALUES (?, ?, ?, ?, 'pending', 'trial')
      `,
      [companyName, slug, logoUrl, conferenceRooms]
    );

    const companyId = companyResult.insertId;

    const passwordHash = await bcrypt.hash(password, 10);

    await conn.execute(
      `
      INSERT INTO users (company_id, email, phone, password_hash)
      VALUES (?, ?, ?, ?)
      `,
      [companyId, email, phone, passwordHash]
    );

    if (conferenceRooms > 0) {
      const values = Array.from({ length: conferenceRooms }).map((_, i) => [
        companyId,
        `Conference Room ${i + 1}`,
        i + 1,
      ]);

      await conn.query(
        `
        INSERT INTO conference_rooms (company_id, room_name, room_number)
        VALUES ?
        `,
        [values]
      );
    }

    await conn.commit();

    /* ================= UPDATED PROFESSIONAL EMAIL ================= */
    sendEmail({
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
    }).catch(() => {});

    return { companyId, companyName, slug, logoUrl };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async ({ email, password }) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error("Email and password are required");
  }

  const [rows] = await db.execute(
    `
    SELECT
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
    LIMIT 1
    `,
    [cleanEmail]
  );

  if (!rows.length) throw new Error("Invalid credentials");
  const user = rows[0];

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid credentials");

  const blockedStates = ["expired", "cancelled", "canceled"];
  if (blockedStates.includes(user.subscription_status)) {
    throw new Error("Your subscription has expired. Please renew to continue.");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      companyId: user.companyId,
      email: cleanEmail,
      companyName: user.companyName
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: { id: user.id, email: cleanEmail },
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
   FORGOT PASSWORD WITH 30s RESEND LOCK
====================================================== */
export const forgotPassword = async (email) => {
  const cleanEmail = email?.trim()?.toLowerCase();
  if (!cleanEmail) return;

  const [rows] = await db.execute(
    "SELECT id, reset_last_sent FROM users WHERE email=? LIMIT 1",
    [cleanEmail]
  );

  if (!rows.length) return;

  const user = rows[0];

  let waitSeconds = 0;

  if (user.reset_last_sent) {
    const [timeRow] = await db.query(
      `SELECT GREATEST(0, 30 - TIMESTAMPDIFF(SECOND, reset_last_sent, NOW())) AS waitSeconds
       FROM users WHERE id=?`,
      [user.id]
    );
    waitSeconds = timeRow[0].waitSeconds;
  }

  if (waitSeconds > 0) {
    return { sent: false, waitSeconds };
  }

  const resetCode = generateResetCode();

  await db.execute(
    `
    UPDATE users
    SET reset_code=?,
        reset_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
        reset_last_sent = NOW()
    WHERE id=?
    `,
    [resetCode, user.id]
  );

  sendEmail({
    to: cleanEmail,
    subject: "PROMEET Password Reset Code",
    html: `
      <p>Hello,</p>
      <p>Your password reset code is:</p>
      <h2 style="color:#6c2bd9">${resetCode}</h2>
      <p>This code is valid for <b>10 minutes</b>.</p>
      ${emailFooter()}
    `
  }).catch(() => {});

  return { sent: true, waitSeconds: 30 };
};

/* ======================================================
   RESET PASSWORD
====================================================== */
export const resetPassword = async ({ email, code, password }) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !code || !password) {
    throw new Error("Email, code and password are required");
  }

  validatePassword(password);

  const [rows] = await db.execute(
    `
    SELECT id, reset_code
    FROM users
    WHERE email = ?
      AND reset_expires > NOW()
    LIMIT 1
    `,
    [cleanEmail]
  );

  if (!rows.length || rows[0].reset_code !== code) {
    throw new Error("Invalid or expired reset code");
  }

  const newHash = await bcrypt.hash(password, 10);

  await db.execute(
    `
    UPDATE users
    SET password_hash=?,
        reset_code=NULL,
        reset_expires=NULL
    WHERE id=?
    `,
    [newHash, rows[0].id]
  );

  sendEmail({
    to: cleanEmail,
    subject: "Your PROMEET Password Has Been Reset",
    html: `
      <p>Hello,</p>
      <p>Your PROMEET account password has been successfully reset.</p>
      ${emailFooter()}
    `
  }).catch(() => {});

  return { message: "Password reset successful" };
};
