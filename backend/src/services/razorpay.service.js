import crypto from "crypto";
import bcrypt from "bcrypt";
import axios from "axios";
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

const RAZORPAY_API = "https://api.razorpay.com/v1";
const TRIAL_AMOUNT_PAISE = 4900; // ₹49

const razorpayAuth = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay API keys are not configured");
  }
  return { username: keyId, password: keySecret };
};

/* ======================================================
   ORDERS API — embedded checkout (landing-page popup)
====================================================== */
const PHONE_RE = /^[6-9]\d{9}$/;

export const createTrialOrder = async ({ email, phone }) => {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = (phone || "").replace(/\D/g, "");

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Enter a valid email address");
  }
  if (!PHONE_RE.test(cleanPhone)) {
    throw new Error("Enter a valid 10-digit phone number");
  }

  // Catch an already-registered email/phone before charging them again —
  // the webhook's own dedup (resend temp password) is a safety net, not
  // meant to be the first line of defense against a real repeat payment.
  const [[existingUser]] = await db.query(
    `SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1`,
    [cleanEmail, cleanPhone]
  );
  if (existingUser) {
    const err = new Error("This email or phone number is already registered. Please log in instead.");
    err.code = "ALREADY_REGISTERED";
    throw err;
  }

  const { data } = await axios.post(
    `${RAZORPAY_API}/orders`,
    {
      amount: TRIAL_AMOUNT_PAISE,
      currency: "INR",
      receipt: `trial_${Date.now()}`,
      notes: { email: cleanEmail, phone: cleanPhone, product: "hai_visitor_trial" },
    },
    { auth: razorpayAuth() }
  );

  return {
    orderId: data.id,
    amount: data.amount,
    currency: data.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

const fetchRazorpayOrder = async (orderId) => {
  const { data } = await axios.get(`${RAZORPAY_API}/orders/${orderId}`, { auth: razorpayAuth() });
  return data;
};

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
const sendRazorpayWelcomeEmail = async (email, tempPassword) => {
  await sendEmail({
    to: email,
    subject: "Welcome to Hai Visitor — Your Trial Account & Login Details",
    html: `
      <p>Hello,</p>

      <p>
        Thank you for your payment. Your <b>Hai Visitor 15-Day Trial</b> is now active.
      </p>

      <h3 style="color:#6c2bd9;margin-bottom:6px;">Your Trial Plan Includes</h3>
      <ul style="font-size:14px;line-height:1.8;">
        <li>100 Visitor Registrations</li>
        <li>100 Conference Room Bookings</li>
        <li>2 Conference Rooms</li>
        <li>Live Dashboard &amp; Visitor History</li>
        <li>No dedicated hardware required — just a displayed QR code</li>
      </ul>

      <h3 style="color:#6c2bd9;margin-bottom:6px;">Your Login Details</h3>
      <p style="font-size:14px;">
        Login with your email or phone number, using this temporary password:
      </p>
      <p style="font-size:18px;font-weight:700;letter-spacing:1px;background:#f4f0fb;padding:10px 14px;border-radius:8px;display:inline-block;">
        ${tempPassword}
      </p>

      <h3 style="color:#6c2bd9;margin-top:20px;margin-bottom:6px;">Before You Start — Complete Your Registration</h3>
      <p style="font-size:14px;">
        The first time you log in, you'll be asked to:
      </p>
      <ul style="font-size:14px;line-height:1.8;">
        <li>Set your own password (replacing this temporary one)</li>
        <li>Enter your <b>Company Name</b></li>
        <li>Upload your <b>Company Logo</b></li>
        <li>Add your <b>WhatsApp Number/URL</b> (optional — used for visitor notifications)</li>
      </ul>
      <p style="font-size:14px;">
        Having these details ready before you log in will make setup quicker.
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

  const greetName = userRow.companyName || "there";

  // WhatsApp never carries the password itself (Meta rejects templates that
  // transmit credentials) — it just points them to the email, which does.
  await Promise.allSettled([
    sendWhatsAppTemplate(userRow.phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, [greetName]),
    sendRazorpayWelcomeEmail(userRow.email, tempPassword),
  ]).then((results) => {
    results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY] resend notification failed:", r.reason); });
  });
};

/* ======================================================
   RESEND TEMP PASSWORD — superadmin-triggered
   --------------------------------------------------------
   Same regenerate-and-notify logic as the webhook's own duplicate-
   payment path, but callable on demand from the Superadmin dashboard's
   "Razorpay Payment Source" tab for a company that never completed
   registration.
====================================================== */
export const resendTrialPassword = async (companyId) => {
  const [[userRow]] = await db.query(
    `SELECT u.id, u.email, u.phone, c.name AS companyName
     FROM users u JOIN companies c ON c.id = u.company_id
     WHERE u.company_id = ? AND c.registration_source = 'razorpay'
     LIMIT 1`,
    [companyId]
  );

  if (!userRow) {
    throw new Error("No Razorpay-sourced user found for this company");
  }

  await resendTempPassword(userRow);
};

/* ======================================================
   EXTRACT EMAIL/PHONE FROM A payment.captured PAYLOAD
   --------------------------------------------------------
   The landing-page popup only collects Email + Phone (no name) and
   sends them to Razorpay as `notes` when the Order is created via
   createTrialOrder(). The payment webhook only carries an `order_id`
   — not the order's own notes — so this fetches the order back from
   Razorpay's API to read them. Name always falls back to a
   placeholder; the real company name gets filled in later on
   /auth/complete-registration.
====================================================== */
const extractPayerDetails = async (paymentEntity) => {
  const orderId = paymentEntity?.order_id;
  let notes = {};

  if (orderId) {
    try {
      const order = await fetchRazorpayOrder(orderId);
      notes = order?.notes || {};
    } catch (err) {
      console.error("[RAZORPAY] failed to fetch order for notes:", orderId, err.response?.data || err.message);
    }
  }

  const email = normalizeEmail(notes.email || paymentEntity?.email);
  const phone = (notes.phone || paymentEntity?.contact || "").replace(/\D/g, "").slice(-10);

  return { name: "New Customer", email, phone };
};

/* ======================================================
   WEBHOOK LOG
   --------------------------------------------------------
   One row per payment.captured delivery, regardless of outcome —
   lets you check what was received without SSHing in to grep logs.
====================================================== */
const logWebhookEvent = async ({ paymentId, name, email, phone, status, companyId, rawPayload }) => {
  try {
    await db.execute(
      `INSERT INTO razorpay_webhook_log (event, payment_id, name, email, phone, status, company_id, raw_payload)
       VALUES ('payment.captured', ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId || null, name || null, email || null, phone || null, status, companyId || null, JSON.stringify(rawPayload)]
    );
  } catch (err) {
    // Logging must never break the actual webhook flow.
    console.error("[RAZORPAY] failed to write webhook log:", err.message);
  }
};

/* ======================================================
   HANDLE payment.captured
====================================================== */
export const handlePaymentCaptured = async (payload) => {
  const paymentEntity = payload?.payment?.entity || {};
  const paymentId = paymentEntity?.id || null;
  const amountPaise = Number.isFinite(paymentEntity?.amount) ? paymentEntity.amount : null;

  const { name, email, phone } = await extractPayerDetails(paymentEntity);
  const log = (status, companyId) => logWebhookEvent({ paymentId, name, email, phone, status, companyId, rawPayload: payload });

  if (!paymentId || !email || !phone) {
    console.error(
      "[RAZORPAY] payment.captured payload missing required fields:",
      { paymentId: !!paymentId, email: !!email, phone: !!phone, orderId: paymentEntity?.order_id }
    );
    await log("missing_fields");
    return { status: "ignored", reason: "missing_fields" };
  }

  /* ---------- Existing account? Treat as a duplicate payment ---------- */
  const [[existingUser]] = await db.query(
    `SELECT u.id, u.email, u.phone, c.name AS companyName
     FROM users u JOIN companies c ON c.id = u.company_id
     WHERE u.email = ? OR u.phone = ? LIMIT 1`,
    [email, phone]
  );

  if (existingUser) {
    await resendTempPassword(existingUser);
    await log("resent");
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
          registration_source, registration_complete, razorpay_payment_id, amount_paid)
         VALUES (?, ?, ?, '', ?, 'trial', 'trial', 'razorpay', 0, ?, ?)`,
        [name, slug, codePrefix, conferenceRooms, paymentId, amountPaise]
      );
      companyId = companyResult.insertId;
    } catch (err) {
      // razorpay_payment_id UNIQUE collision — this exact payment was already
      // processed by a concurrent/redelivered webhook call. Not an error.
      if (err.code === "ER_DUP_ENTRY" && err.sqlMessage?.includes("razorpay_payment_id")) {
        await conn.rollback();
        console.log("[RAZORPAY] duplicate webhook delivery for payment", paymentId, "— already processed");
        await log("duplicate_delivery");
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

    // WhatsApp never carries the password itself — it just tells them to
    // check their email, which does. No real name is collected by the
    // popup, so the template's {{1}} just gets a generic greeting.
    Promise.allSettled([
      sendWhatsAppTemplate(phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, ["there"]),
      sendRazorpayWelcomeEmail(email, tempPassword),
    ]).then((results) => {
      results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY] welcome notification failed:", r.reason); });
    });

    await log("created", companyId);
    return { status: "created", companyId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
