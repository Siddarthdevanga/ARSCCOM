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
const generateSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

  /* ---------- Check existing user ---------- */
  const [existing] = await db.execute(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (existing.length) {
    throw new Error("Email already registered");
  }

  /* ---------- Generate UNIQUE slug ---------- */
  let slug = generateSlug(companyName);
  let suffix = 1;

  while (true) {
    const [[exists]] = await db.query(
      "SELECT id FROM companies WHERE slug = ? LIMIT 1",
      [slug]
    );
    if (!exists) break;
    slug = `${generateSlug(companyName)}-${suffix++}`;
  }

  /* ---------- Upload logo ---------- */
  const ext = path.extname(file.originalname).toLowerCase() || ".png";
  const logoKey = `companies/${slug}/logo${ext}`;
  const logoUrl = await uploadToS3(file, logoKey);

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* ---------- Create company ---------- */
    const [companyResult] = await conn.execute(
      `
      INSERT INTO companies (name, slug, logo_url, rooms)
      VALUES (?, ?, ?, ?)
      `,
      [companyName, slug, logoUrl, conferenceRooms]
    );

    const companyId = companyResult.insertId;

    /* ---------- Create admin user ---------- */
    const passwordHash = await bcrypt.hash(password, 10);

    await conn.execute(
      `
      INSERT INTO users (company_id, email, phone, password_hash)
      VALUES (?, ?, ?, ?)
      `,
      [companyId, email, phone, passwordHash]
    );

    /* ---------- Create Conference Rooms ---------- */
    for (let i = 1; i <= conferenceRooms; i++) {
      await conn.execute(
        `
        INSERT INTO conference_rooms (company_id, room_name, room_number)
        VALUES (?, ?, ?)
        `,
        [companyId, `Conference Room ${i}`, i]
      );
    }

    await conn.commit();

    /* ======================================================
       WELCOME EMAIL
    ====================================================== */
    sendEmail({
      to: email,
      subject: "Welcome to PROMEET – Complete Your Subscription",
      html: `
<p>Hi,</p>

<p>
Thank you for registering <b>${companyName}</b> on <b>PROMEET</b>.
Your company account has been successfully created and your admin profile is now active.
</p>

<h3 style="margin-top:10px;">Next Step</h3>
<p>
Please proceed to the Subscription page and select a suitable plan
to activate your account and start using PROMEET.
</p>

<p>
If you need any help with onboarding or billing setup, feel free to contact us anytime.
</p>

<br/>
<p>Regards,<br/>PROMEET Team</p>

<hr/>
<p style="font-size:12px;color:#777;">
This is an auto-generated email. Please do not reply.
</p>
`
    }).catch(() => {});

    return {
      companyId,
      companyName,
      slug,
      logoUrl
    };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   LOGIN
   (Allow only Trial or Active companies)
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
      c.subscription_status
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.email = ?
    `,
    [cleanEmail]
  );

  if (!rows.length) {
    throw new Error("Invalid credentials");
  }

  // block login if not trial or active
  if (!["trial", "active"].includes(rows[0].subscription_status)) {
    throw new Error("Your subscription is not active. Please subscribe to continue.");
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
      slug: rows[0].companySlug,
      logo_url: rows[0].companyLogo
    }
  };
};

/* ======================================================
   FORGOT PASSWORD
====================================================== */
export const forgotPassword = async (email) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) return;

  const [rows] = await db.execute(
    "SELECT id FROM users WHERE email = ?",
    [cleanEmail]
  );

  if (!rows.length) return;

  const resetCode = generateResetCode();

  await db.execute(
    `
    UPDATE users
    SET reset_code = ?,
        reset_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
    WHERE id = ?
    `,
    [resetCode, rows[0].id]
  );

  await sendEmail({
    to: cleanEmail,
    subject: "PROMEET Password Reset Code",
    html: `
<p>Your password reset code is:</p>

<h2>${resetCode}</h2>

<p>This code is valid for <b>10 minutes</b>.</p>

<br/>
<p>Regards,<br/>PROMEET Team</p>

<hr/>
<p style="font-size:12px;color:#777;">
This is an auto-generated email. Please do not reply.
</p>
`
  });
};

/* ======================================================
   RESET PASSWORD + SUCCESS EMAIL
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
    SET password_hash = ?,
        reset_code = NULL,
        reset_expires = NULL
    WHERE id = ?
    `,
    [newHash, rows[0].id]
  );

  /* ================= PASSWORD RESET SUCCESS EMAIL ================= */
  await sendEmail({
    to: cleanEmail,
    subject: "Your PROMEET Password Has Been Reset",
    html: `
<p>Hi,</p>

<p>
Your PROMEET account password has been reset successfully.
If this action was done by you, no further action is required.
</p>

<p>
If you did NOT request this change, please contact support immediately.
</p>

<br/>
<p>Regards,<br/>PROMEET Team</p>

<hr/>
<p style="font-size:12px;color:#777;">
This is an auto-generated email. Please do not reply.
</p>
`
  });

  return { message: "Password reset successful" };
};
