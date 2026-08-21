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
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

        <!-- BRAND HEADER -->
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">
            H<span style="color:#FDBA74;">ai</span> Visitor
          </div>
          <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">
            15-Day Trial Activated
          </div>
        </div>

        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello,</p>

          <p style="font-size:15px;color:#262046;">
            Thank you for your payment. Your <b>Hai Visitor 15-Day Trial</b> is now active.
          </p>

          <!-- TRIAL PLAN -->
          <div style="background:#F1ECFB;border-left:4px solid #7C3AED;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#7C3AED;margin:0 0 10px;font-size:15px;">Your Trial Plan Includes</h3>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;">✅&nbsp; 100 Visitor Registrations</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; 100 Conference Room Bookings</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; 2 Conference Rooms</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; Live Dashboard &amp; Visitor History</td></tr>
              <tr><td style="padding:4px 0;">✅&nbsp; No dedicated hardware — just a displayed QR code</td></tr>
            </table>
          </div>

          <!-- LOGIN DETAILS -->
          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#EA580C;margin:0 0 8px;font-size:15px;">Your Login Details</h3>
            <p style="font-size:13px;color:#6E6890;margin:0 0 10px;">
              Login with your email or phone number, using this temporary password:
            </p>
            <div style="font-size:20px;font-weight:800;letter-spacing:2px;background:#ffffff;border:1px dashed #F97316;color:#221C53;padding:12px 16px;border-radius:8px;text-align:center;">
              ${tempPassword}
            </div>
          </div>

          <!-- COMPLETE REGISTRATION -->
          <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#16A34A;margin:0 0 8px;font-size:15px;">Before You Start — Complete Your Registration</h3>
            <p style="font-size:13px;color:#6E6890;margin:0 0 8px;">The first time you log in, you'll be asked to:</p>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;">🔑&nbsp; Set your own password (replacing this temporary one)</td></tr>
              <tr><td style="padding:4px 0;">🏢&nbsp; Enter your <b>Company Name</b></td></tr>
              <tr><td style="padding:4px 0;">🖼️&nbsp; Upload your <b>Company Logo</b></td></tr>
              <tr><td style="padding:4px 0;">💬&nbsp; Add your <b>WhatsApp Number/URL</b> (optional)</td></tr>
            </table>
            <p style="font-size:13px;color:#6E6890;margin:10px 0 0;">
              Having these details ready before you log in will make setup quicker.
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin-top:28px;">
            <a href="https://www.haivisitor.zodopt.com/login" style="display:inline-block;background:#F97316;background-image:linear-gradient(95deg,#F97316,#EF3E66);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:999px;">
              Login to Hai Visitor →
            </a>
          </div>

          ${emailFooter()}
        </div>
      </div>
    `,
  });
};

/* ======================================================
   PAYMENT RECEIPT
   --------------------------------------------------------
   Always a separate email from the welcome/temp-password one —
   fired for every real payment.captured event (both a brand-new
   account and a repeat payment on an existing one), never for the
   superadmin-triggered manual password resend (no payment involved
   there).
====================================================== */
const sendPaymentReceiptEmail = async ({ email, phone, paymentId }) => {
  // Always the fixed trial price, not the actual captured amount — Razorpay's
  // "customer pays the transaction fee" account setting inflates what's
  // actually captured (e.g. ₹50.16 instead of ₹49.00), and the receipt should
  // reflect the trial price, not a gateway fee pass-through.
  const amount = (TRIAL_AMOUNT_PAISE / 100).toFixed(2);
  const paidOn = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  await sendEmail({
    to: email,
    subject: "Payment Receipt — Hai Visitor 15-Day Trial",
    html: `
      <div style="border:1px solid #e0d9f0;border-radius:12px;padding:24px;max-width:480px;margin:0 auto;">
        <h2 style="color:#221a35;margin:0 0 16px;">Payment Receipt</h2>

        <p style="font-size:14px;">
          Thank you for your payment. Here are your payment details:
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
          <tr>
            <td style="padding:8px 0;color:#6E6890;">Amount Paid</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;">₹${amount}</td>
          </tr>
          <tr style="border-top:1px solid #eee;">
            <td style="padding:8px 0;color:#6E6890;">Payment ID</td>
            <td style="padding:8px 0;text-align:right;">${paymentId}</td>
          </tr>
          <tr style="border-top:1px solid #eee;">
            <td style="padding:8px 0;color:#6E6890;">Date</td>
            <td style="padding:8px 0;text-align:right;">${paidOn}</td>
          </tr>
          <tr style="border-top:1px solid #eee;">
            <td style="padding:8px 0;color:#6E6890;">Email</td>
            <td style="padding:8px 0;text-align:right;">${email}</td>
          </tr>
          <tr style="border-top:1px solid #eee;">
            <td style="padding:8px 0;color:#6E6890;">Phone</td>
            <td style="padding:8px 0;text-align:right;">${phone}</td>
          </tr>
        </table>

        <p style="font-size:14px;">
          This receipt confirms your payment for the Hai Visitor 15-Day Trial.
        </p>

        ${emailFooter()}
      </div>
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

  // WhatsApp never carries the password itself (Meta rejects templates that
  // transmit credentials) — it just points them to the email, which does.
  // Template has no {{1}} — no real name is ever collected at this stage.
  await Promise.allSettled([
    sendWhatsAppTemplate(userRow.phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, []),
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
   /complete-registration.
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

  // Only an order created by our own createTrialOrder() carries this tag.
  // The Razorpay account also takes other, unrelated payments — without
  // this check, any payment.captured event anywhere on the account (a
  // different product, a manual payment link, anything else) would be
  // mistaken for a genuine trial signup and create a real account.
  const isOurOrder = notes.product === "hai_visitor_trial";

  return { name: "New Customer", email, phone, isOurOrder };
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

  const { name, email, phone, isOurOrder } = await extractPayerDetails(paymentEntity);
  const log = (status, companyId) => logWebhookEvent({ paymentId, name, email, phone, status, companyId, rawPayload: payload });

  // Not one of our trial orders — some other payment on the same Razorpay
  // account (it also takes unrelated payments). Never create an account
  // for this, no matter what email/phone/amount happens to be on it.
  if (!isOurOrder) {
    console.warn(
      "[RAZORPAY] payment.captured for a non-trial order, ignoring:",
      { paymentId, orderId: paymentEntity?.order_id, amount: amountPaise }
    );
    await log("unrecognized_payment");
    return { status: "ignored", reason: "unrecognized_payment" };
  }

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
    sendPaymentReceiptEmail({ email, phone, paymentId, amountPaise }).catch((err) =>
      console.error("[RAZORPAY] receipt email failed:", err.message)
    );
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
          registration_source, registration_complete, razorpay_payment_id, amount_paid,
          trial_ends_at)
         VALUES (?, ?, ?, '', ?, 'trial', 'trial', 'razorpay', 0, ?, ?,
          DATE_ADD(NOW(), INTERVAL 15 DAY))`,
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
    // check their email, which does. Template has no {{1}} — no real name
    // is ever collected by the popup.
    Promise.allSettled([
      sendWhatsAppTemplate(phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, []),
      sendRazorpayWelcomeEmail(email, tempPassword),
      sendPaymentReceiptEmail({ email, phone, paymentId, amountPaise }),
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
