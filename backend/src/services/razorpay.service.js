import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { sendWhatsAppTemplate } from "./gupshup.service.js";
import { generateTempPassword } from "../utils/tempPassword.js";
import { deriveCodePrefix } from "../utils/codePrefix.js";
import { PLAN_FEATURES } from "../constants/pricing.js";
import {
  emailFooter,
  generateSlug,
  generateUniqueSlug,
  normalizeEmail,
  BCRYPT_ROUNDS,
} from "./auth.service.js";

/* ======================================================
   SIGNATURE VERIFICATION
====================================================== */
export const verifyRazorpaySignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !rawBody) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== signatureBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
};

/* ======================================================
   WELCOME EMAIL (temp password)
====================================================== */
const sendRazorpayWelcomeEmail = async (email, name, tempPassword) => {
  await sendEmail({
    to: email,
    subject: "Welcome to Hai Visitor — Your Trial Account & Login Details",
    html: `
      <p>Hello <b>${name}</b>,</p>

      <p>
        Thank you for your payment. Your <b>15-day Hai Visitor trial</b> is active
        and your account has been created.
      </p>

      <h3 style="color:#6c2bd9;margin-bottom:6px;">Your Login Details</h3>
      <p style="font-size:14px;">
        Login with your email or phone number, using this temporary password:
      </p>
      <p style="font-size:18px;font-weight:700;letter-spacing:1px;background:#f4f0fb;padding:10px 14px;border-radius:8px;display:inline-block;">
        ${tempPassword}
      </p>

      <p style="font-size:14px;">
        You'll be asked to set your own password and finish setting up your
        company profile (name, logo) the first time you log in.
      </p>

      <p>
        <a href="https://www.haivisitor.zodopt.com/auth/login" style="color:#6c2bd9;font-weight:600;">
          Login to Hai Visitor →
        </a>
      </p>

      ${emailFooter()}
    `,
  });
};

/* ======================================================
   RESEND TEMP PASSWORD (duplicate payment / already exists)
====================================================== */
const resendTempPassword = async (userRow) => {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  await db.execute(
    `UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`,
    [passwordHash, userRow.id]
  );

  await Promise.allSettled([
    sendWhatsAppTemplate(userRow.phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, [userRow.name || "there", tempPassword]),
    sendRazorpayWelcomeEmail(userRow.email, userRow.name || "there", tempPassword),
  ]).then((results) => {
    results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY] resend notification failed:", r.reason); });
  });
};

/* ======================================================
   HANDLE payment_link.paid
====================================================== */
export const handlePaymentLinkPaid = async (payload) => {
  const paymentLinkEntity = payload?.payment_link?.entity || {};
  const paymentEntity = payload?.payment?.entity || {};

  const paymentId = paymentEntity?.id || null;
  const name = paymentLinkEntity?.customer?.name || paymentEntity?.notes?.name || "New Customer";
  const email = normalizeEmail(paymentLinkEntity?.customer?.email || paymentEntity?.email);
  const phone = (paymentLinkEntity?.customer?.contact || paymentEntity?.contact || "").replace(/\D/g, "").slice(-10);

  if (!paymentId || !email || !phone) {
    console.error("[RAZORPAY] payment_link.paid payload missing required fields:", { paymentId, email: !!email, phone: !!phone });
    return { status: "ignored", reason: "missing_fields" };
  }

  /* ---------- Existing account? Treat as a duplicate payment ---------- */
  const [[existingUser]] = await db.query(
    `SELECT id, email, phone, name FROM users WHERE email = ? OR phone = ? LIMIT 1`,
    [email, phone]
  );

  if (existingUser) {
    await resendTempPassword(existingUser);
    return { status: "resent", companyExisted: true };
  }

  /* ---------- Create company + user ---------- */
  const baseSlug = generateSlug(name);
  const slug = await generateUniqueSlug(baseSlug);
  const codePrefix = deriveCodePrefix(name);
  const conferenceRooms = PLAN_FEATURES.trial.rooms;

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let companyId;
    try {
      const [companyResult] = await conn.execute(
        `INSERT INTO companies
         (name, slug, code_prefix, logo_url, rooms, subscription_status, plan,
          registration_source, registration_complete, razorpay_payment_id)
         VALUES (?, ?, ?, NULL, ?, 'trial', 'trial', 'razorpay', 0, ?)`,
        [name, slug, codePrefix, conferenceRooms, paymentId]
      );
      companyId = companyResult.insertId;
    } catch (err) {
      // razorpay_payment_id UNIQUE collision — this exact payment was already
      // processed by a concurrent/redelivered webhook call. Not an error.
      if (err.code === "ER_DUP_ENTRY" && err.sqlMessage?.includes("razorpay_payment_id")) {
        await conn.rollback();
        console.log("[RAZORPAY] duplicate webhook delivery for payment", paymentId, "— already processed");
        return { status: "duplicate_delivery" };
      }
      throw err;
    }

    await conn.execute(
      `INSERT INTO users (company_id, email, phone, password_hash, must_change_password)
       VALUES (?, ?, ?, ?, 1)`,
      [companyId, email, phone, passwordHash]
    );

    if (conferenceRooms > 0) {
      const roomValues = Array.from({ length: conferenceRooms }, (_, i) => [
        companyId,
        `Conference Room ${i + 1}`,
        i + 1,
      ]);
      await conn.query(
        `INSERT INTO conference_rooms (company_id, room_name, room_number) VALUES ?`,
        [roomValues]
      );
    }

    await conn.commit();

    Promise.allSettled([
      sendWhatsAppTemplate(phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, [name, tempPassword]),
      sendRazorpayWelcomeEmail(email, name, tempPassword),
    ]).then((results) => {
      results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY] welcome notification failed:", r.reason); });
    });

    return { status: "created", companyId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
