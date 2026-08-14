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

  const greetName = userRow.companyName || "there";

  // WhatsApp never carries the password itself (Meta rejects templates that
  // transmit credentials) — it just points them to the email, which does.
  await Promise.allSettled([
    sendWhatsAppTemplate(userRow.phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, [greetName]),
    sendRazorpayWelcomeEmail(userRow.email, greetName, tempPassword),
  ]).then((results) => {
    results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY] resend notification failed:", r.reason); });
  });
};

/* ======================================================
   EXTRACT NAME/EMAIL/PHONE FROM A payment.captured PAYLOAD
   --------------------------------------------------------
   Razorpay Payment Pages collect Name/Email/Phone as native checkout
   fields, but — unlike Payment Links — there's no `customer` object
   on the payment entity. Email/contact are native Payment fields;
   Name isn't, so Payment Pages surface it through `notes` using the
   field's label as the key. Tries a few casings defensively since
   the exact key isn't nailed down without a live payload to check
   against — logs the raw notes object so this can be tightened once
   real webhook deliveries are visible in the Razorpay dashboard.
====================================================== */
const extractPayerDetails = (paymentEntity) => {
  const notes = paymentEntity?.notes || {};
  const name =
    notes.name || notes.Name || notes["Name"] || notes["name"] ||
    paymentEntity?.customer?.name ||
    "New Customer";

  const email = normalizeEmail(paymentEntity?.email || notes.email || notes.Email);
  const phone = (paymentEntity?.contact || notes.phone || notes.Phone || "").replace(/\D/g, "").slice(-10);

  return { name, email, phone };
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

  const { name, email, phone } = extractPayerDetails(paymentEntity);
  const log = (status, companyId) => logWebhookEvent({ paymentId, name, email, phone, status, companyId, rawPayload: payload });

  if (!paymentId || !email || !phone) {
    console.error(
      "[RAZORPAY] payment.captured payload missing required fields:",
      { paymentId: !!paymentId, email: !!email, phone: !!phone, notes: paymentEntity?.notes }
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
    // check their email, which does.
    Promise.allSettled([
      sendWhatsAppTemplate(phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, [name]),
      sendRazorpayWelcomeEmail(email, name, tempPassword),
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
