import axios from "axios";
import bcrypt from "bcrypt";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { sendWhatsAppTemplate } from "./gupshup.service.js";
import { generateTempPassword } from "../utils/tempPassword.js";
import { deriveCodePrefix } from "../utils/codePrefix.js";
import { getTrialRazorpayPlanId, PLAN_FEATURES } from "../constants/pricing.js";
import { isSubscriptionUpdatable } from "./razorpaySubscription.service.js";
import {
  emailFooter,
  generateSlug,
  generateUniqueSlug,
  normalizeEmail,
  BCRYPT_ROUNDS,
} from "./auth.service.js";

/* ======================================================
   TRIAL — REPLACES THE OLD ONE-TIME ORDERS-API FLOW ENTIRELY.
   --------------------------------------------------------
   Trial is now a real Razorpay Subscription against a dedicated
   "trial-origin" Business Monthly plan:
     - Mandate authorized + ₹49 collected immediately (as an `addons`
       line item on the authorization transaction — confirmed against
       Razorpay's own docs: addons bill upfront, not on the delayed
       invoice).
     - Real ₹500/mo billing delayed 15 days via `start_at` — the
       documented mechanism for a trial-then-bill subscription.
     - `subscription.authenticated` fires the moment the mandate + ₹49
       are confirmed (current_start/current_end still null) — THIS is
       where the account gets created (mirrors the old flow's
       payment.captured timing).
     - `subscription.activated` + `subscription.charged` fire together
       once `start_at` arrives and the real ₹500 charge succeeds —
       already handled by the EXISTING handleSubscriptionWebhookEvent()
       in razorpaySubscription.service.js. Since the company's `plan`
       is still 'trial' at that point (not 'business'), that handler's
       own isRenewal check already resolves to false, so the conversion
       is treated as a first activation automatically — no changes
       needed there.
   No account exists yet when the landing-page popup fires (Path A);
   an account already exists by the time /subscription is shown for a
   web-registered company choosing Trial (Path B) — both are handled
   here, distinguished by whether `notes.companyId` is present.
====================================================== */

const RAZORPAY_API = "https://api.razorpay.com/v1";
const TRIAL_AMOUNT_PAISE = 4900; // ₹49
const TRIAL_DAYS = 15;
const TOTAL_COUNT_MONTHLY = 120; // matches razorpaySubscription.service.js's monthly count
const PHONE_RE = /^[6-9]\d{9}$/;

const razorpayAuth = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay API keys are not configured");
  return { username: keyId, password: keySecret };
};

const trialStartAt = () => Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60;

// A race (two tabs, a retry before the first webhook lands) can authorize
// TWO real mandates for what should be one signup. Whichever one loses gets
// cancelled immediately here rather than left dangling — an uncancelled
// duplicate is a live mandate that will genuinely auto-charge ₹500/month at
// day 15 with no company ever tied to it. Best-effort: a failure here is
// logged, never allowed to break the winning signup's own activation.
const cancelDuplicateSubscription = async (subscriptionId, reason) => {
  try {
    await axios.post(
      `${RAZORPAY_API}/subscriptions/${subscriptionId}/cancel`,
      { cancel_at_cycle_end: 0 },
      { auth: razorpayAuth() }
    );
    console.log(`[RAZORPAY-TRIAL] cancelled duplicate subscription ${subscriptionId} (${reason})`);
  } catch (err) {
    console.error(`[RAZORPAY-TRIAL] failed to cancel duplicate subscription ${subscriptionId} (${reason}):`, err.response?.data?.error?.description || err.message);
  }
};

/* ======================================================
   CREATE TRIAL SUBSCRIPTION — landing-page popup (Path A).
   No account exists yet; the customer's email/phone travel as `notes`
   for handleSubscriptionAuthenticated() to read once the mandate is
   confirmed, exactly like the old flow's Order notes did for
   payment.captured.
====================================================== */
export const createTrialSubscription = async ({ email, phone }) => {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = (phone || "").replace(/\D/g, "");

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Enter a valid email address");
  }
  if (!PHONE_RE.test(cleanPhone)) {
    throw new Error("Enter a valid 10-digit phone number");
  }

  // Catch an already-registered email/phone before authorizing a mandate —
  // the webhook's own dedup (resend temp password) is a safety net, not
  // meant to be the first line of defense against a real repeat signup.
  // Compared on the last 10 digits, not a raw match — /register stores
  // phone as "91" + 10 digits, while this flow stores the bare 10-digit
  // number. A raw match would miss a duplicate against a web-registered
  // account that used this same phone with a different email.
  const [[existingUser]] = await db.query(
    `SELECT id FROM users WHERE email = ? OR RIGHT(phone, 10) = ? LIMIT 1`,
    [cleanEmail, cleanPhone]
  );
  if (existingUser) {
    const err = new Error("This email or phone number is already registered. Please log in instead.");
    err.code = "ALREADY_REGISTERED";
    throw err;
  }

  const planId = getTrialRazorpayPlanId();
  if (!planId) throw new Error("Trial Razorpay plan not configured (RAZORPAY_PLAN_TRIAL_BUSINESS_MONTHLY)");

  const { data: subscription } = await axios.post(
    `${RAZORPAY_API}/subscriptions`,
    {
      plan_id: planId,
      customer_notify: 1,
      total_count: TOTAL_COUNT_MONTHLY,
      start_at: trialStartAt(),
      addons: [{ item: { name: "Hai Visitor 15-Day Trial", amount: TRIAL_AMOUNT_PAISE, currency: "INR" } }],
      notes: { email: cleanEmail, phone: cleanPhone, isNewTrialSignup: "true" },
    },
    { auth: razorpayAuth() }
  );

  return {
    subscriptionId: subscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

/* ======================================================
   CREATE TRIAL SUBSCRIPTION — existing company (Path B, web-registered
   company choosing Trial from /subscription). Account already exists,
   so notes carries companyId instead of email/phone.
====================================================== */
export const createTrialSubscriptionForExistingCompany = async (companyId) => {
  const [[company]] = await db.query(
    `SELECT id, subscription_status, razorpay_subscription_id FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );
  if (!company) throw new Error("Company not found");
  if (["trial", "active"].includes(company.subscription_status)) {
    throw new Error("Subscription already active");
  }

  // Tidy up a previous abandoned attempt (checkout opened, mandate never
  // authorized) before creating a new one — same cleanup already applied
  // to Business/Enterprise upgrades, so a retry doesn't leave dead
  // subscriptions sitting on Razorpay's side. Never cancels a genuinely
  // live one by accident (isSubscriptionUpdatable would say true, and the
  // ["trial","active"] guard above already blocks reaching here anyway).
  if (company.razorpay_subscription_id) {
    try {
      if (!(await isSubscriptionUpdatable(company.razorpay_subscription_id))) {
        await axios.post(
          `${RAZORPAY_API}/subscriptions/${company.razorpay_subscription_id}/cancel`,
          { cancel_at_cycle_end: 0 },
          { auth: razorpayAuth() }
        );
      }
    } catch (err) {
      console.error(`[RAZORPAY-TRIAL] cleanup of stale subscription ${company.razorpay_subscription_id} failed (non-fatal):`, err.response?.data?.error?.description || err.message);
    }
  }

  const planId = getTrialRazorpayPlanId();
  if (!planId) throw new Error("Trial Razorpay plan not configured (RAZORPAY_PLAN_TRIAL_BUSINESS_MONTHLY)");

  const { data: subscription } = await axios.post(
    `${RAZORPAY_API}/subscriptions`,
    {
      plan_id: planId,
      customer_notify: 1,
      total_count: TOTAL_COUNT_MONTHLY,
      start_at: trialStartAt(),
      addons: [{ item: { name: "Hai Visitor 15-Day Trial", amount: TRIAL_AMOUNT_PAISE, currency: "INR" } }],
      notes: { companyId: String(companyId), isNewTrialSignup: "false" },
    },
    { auth: razorpayAuth() }
  );

  return {
    subscriptionId: subscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

/* ======================================================
   CREATE MANDATE FOR AN EXISTING NO-MANDATE TRIAL COMPANY
   --------------------------------------------------------
   For companies that signed up under the OLD one-time-Order trial flow
   (or otherwise never authorized a mandate) and are still eligible
   (status trial or grace_period). Adds a real Razorpay mandate WITHOUT
   the ₹49 addon — they already paid that once under the old flow, so
   charging it again here would be a double-charge. start_at keeps their
   ORIGINAL conversion date (no free extension for adding a mandate
   late); if that date has already passed (deep into grace period),
   Razorpay requires start_at in the future, so it falls back to "as
   soon as possible" instead.
====================================================== */
export const createMandateForExistingTrial = async (companyId) => {
  const [[company]] = await db.query(
    `SELECT id, plan, subscription_status, razorpay_subscription_id, trial_ends_at
     FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );
  if (!company) throw new Error("Company not found");
  if (company.plan !== "trial") throw new Error("Only trial-plan accounts can add auto-pay this way");
  if (company.razorpay_subscription_id) throw new Error("A payment mandate already exists for this account");
  if (!["trial", "grace_period"].includes(company.subscription_status)) {
    throw new Error("This account is not eligible to add auto-pay");
  }

  const planId = getTrialRazorpayPlanId();
  if (!planId) throw new Error("Trial Razorpay plan not configured (RAZORPAY_PLAN_TRIAL_BUSINESS_MONTHLY)");

  const minStartAt = Math.floor(Date.now() / 1000) + 600; // Razorpay requires start_at to be in the future
  const existingEndsAt = company.trial_ends_at ? Math.floor(new Date(company.trial_ends_at).getTime() / 1000) : null;
  const startAt = existingEndsAt && existingEndsAt > minStartAt ? existingEndsAt : minStartAt;

  const { data: subscription } = await axios.post(
    `${RAZORPAY_API}/subscriptions`,
    {
      plan_id: planId,
      customer_notify: 1,
      total_count: TOTAL_COUNT_MONTHLY,
      start_at: startAt,
      // No addon — see comment above.
      notes: { companyId: String(companyId), isNewTrialSignup: "false" },
    },
    { auth: razorpayAuth() }
  );

  return { subscriptionId: subscription.id, keyId: process.env.RAZORPAY_KEY_ID };
};

/* ======================================================
   WELCOME EMAIL (temp password) — Path A only, new account.
   Same shape as the old razorpay.service.js version, with a courtesy
   mention of the auto-conversion added per the confirmed plan.
====================================================== */
const sendTrialWelcomeEmail = async (email, tempPassword, convertsOnLabel) => {
  await sendEmail({
    to: email,
    subject: "Welcome to Hai Visitor — Your Trial Account & Login Details",
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
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

          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#EA580C;margin:0 0 8px;font-size:15px;">Continues Automatically After Your Trial</h3>
            <p style="font-size:13px;color:#6E6890;margin:0;">
              Your card/UPI mandate has been authorized. Unless you cancel before then, your Hai Visitor
              <b>Business Plan (₹500/month + GST)</b> begins automatically on <b>${convertsOnLabel}</b> —
              no action needed to continue. You can cancel anytime from Settings before that date.
            </p>
          </div>

          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#EA580C;margin:0 0 8px;font-size:15px;">Your Login Details</h3>
            <p style="font-size:13px;color:#6E6890;margin:0 0 10px;">
              Login with your email or phone number, using this temporary password:
            </p>
            <div style="font-size:20px;font-weight:800;letter-spacing:2px;background:#ffffff;border:1px dashed #F97316;color:#221C53;padding:12px 16px;border-radius:8px;text-align:center;">
              ${tempPassword}
            </div>
          </div>

          <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#16A34A;margin:0 0 8px;font-size:15px;">Before You Start — Complete Your Registration</h3>
            <p style="font-size:13px;color:#6E6890;margin:0 0 8px;">The first time you log in, you'll be asked to:</p>
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;">🔑&nbsp; Set your own password (replacing this temporary one)</td></tr>
              <tr><td style="padding:4px 0;">🏢&nbsp; Enter your <b>Company Name</b></td></tr>
              <tr><td style="padding:4px 0;">🖼️&nbsp; Upload your <b>Company Logo</b></td></tr>
              <tr><td style="padding:4px 0;">💬&nbsp; Add your <b>WhatsApp Number/URL</b> (optional)</td></tr>
            </table>
          </div>

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
   TRIAL ACTIVATED EMAIL — existing company (Path B)
====================================================== */
const sendTrialActivatedEmailForExistingCompany = async ({ email, companyName, convertsOnLabel }) => {
  await sendEmail({
    to: email,
    subject: "Hai Visitor 15-Day Trial — Now Active",
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">H<span style="color:#FDBA74;">ai</span> Visitor</div>
          <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">15-Day Trial Activated</div>
        </div>
        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello <b>${companyName}</b>,</p>
          <p style="font-size:15px;color:#262046;">Your <b>Hai Visitor 15-Day Trial</b> is now active.</p>
          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <p style="font-size:13px;color:#6E6890;margin:0;">
              Your card/UPI mandate has been authorized. Unless you cancel before then, your Hai Visitor
              <b>Business Plan (₹500/month + GST)</b> begins automatically on <b>${convertsOnLabel}</b> —
              no action needed to continue. You can cancel anytime from Settings before that date.
            </p>
          </div>
          ${emailFooter()}
        </div>
      </div>
    `,
  });
};

/* ======================================================
   WEBHOOK LOG — reuses the same log table subscription events already
   write to, for one consistent place to look.
====================================================== */
const logSubscriptionEvent = async ({ event, subscriptionId, companyId, status, rawPayload }) => {
  try {
    await db.execute(
      `INSERT INTO razorpay_subscription_log (event, subscription_id, company_id, status, raw_payload)
       VALUES (?, ?, ?, ?, ?)`,
      [event, subscriptionId || null, companyId || null, status, JSON.stringify(rawPayload)]
    );
  } catch (err) {
    console.error("[RAZORPAY-TRIAL] failed to write webhook log:", err.message);
  }
};

/* ======================================================
   UPDATE RAZORPAY CUSTOMER NAME
   --------------------------------------------------------
   Trial signups never carry a real company name at checkout time — the
   Razorpay Customer record is stuck showing whatever placeholder Razorpay
   assigned. Called from /complete-registration once the customer sets
   their real company name, so Razorpay's own dashboard reflects it too.
   Best-effort: never blocks registration completion if it fails, and a
   company with no razorpay_customer_id on file (e.g. Path B business/
   enterprise, or Trial before this field existed) is a silent no-op.
====================================================== */
export const updateRazorpayCustomerName = async (companyId, name) => {
  const cleanName = name?.trim();
  if (!cleanName) return;

  const [[company]] = await db.query(
    `SELECT razorpay_customer_id FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );
  if (!company?.razorpay_customer_id) return;

  try {
    await axios.put(
      `${RAZORPAY_API}/customers/${company.razorpay_customer_id}`,
      { name: cleanName },
      { auth: razorpayAuth() }
    );
  } catch (err) {
    console.error(`[RAZORPAY-TRIAL] failed to update customer name for ${company.razorpay_customer_id}:`, err.response?.data?.error?.description || err.message);
  }
};

/* ======================================================
   RESEND TEMP PASSWORD — superadmin-triggered
   --------------------------------------------------------
   Same regenerate-and-notify logic as the webhook's own duplicate-
   signup path, callable on demand from the Superadmin dashboard's
   "Razorpay Payment Source" tab for a company that never completed
   registration. Reads the company's own trial_ends_at rather than
   recomputing it, since the mandate/trial already exists by now.
====================================================== */
export const resendTrialPassword = async (companyId) => {
  const [[row]] = await db.query(
    `SELECT u.id, u.email, u.phone, c.trial_ends_at
     FROM users u JOIN companies c ON c.id = u.company_id
     WHERE u.company_id = ? AND c.registration_source = 'razorpay'
     LIMIT 1`,
    [companyId]
  );
  if (!row) throw new Error("No Razorpay-sourced user found for this company");

  const convertsOnLabel = row.trial_ends_at
    ? new Date(row.trial_ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "your conversion date";

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  await db.execute(`UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`, [passwordHash, row.id]);

  await Promise.allSettled([
    sendWhatsAppTemplate(row.phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, []),
    sendTrialWelcomeEmail(row.email, tempPassword, convertsOnLabel),
  ]).then((results) => {
    results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY-TRIAL] resend notification failed:", r.reason); });
  });
};

/* ======================================================
   HANDLE subscription.authenticated
   --------------------------------------------------------
   Fires the moment the mandate is confirmed and the ₹49 addon is
   captured — current_start/current_end are still null at this point
   (real billing hasn't started; that's subscription.activated later).
   This is trial-only: a Business/Enterprise subscription reaching
   "authenticated" on its way to its OWN immediate first charge also
   fires this event, so it's guarded to only act when the plan_id
   matches the trial plan.
====================================================== */
export const handleSubscriptionAuthenticated = async (payload) => {
  const entity = payload?.subscription?.entity || {};
  const subscriptionId = entity.id;
  const notes = entity.notes || {};
  // The ₹49 addon's own payment — Razorpay nests it alongside the
  // subscription entity on this event, same shape as payment.captured's
  // payload used to carry. Recorded on the company row so the Superadmin
  // "Razorpay Payment Source" tab (which reads amount_paid/razorpay_payment_id
  // for every registration_source='razorpay' company) still shows it.
  const paymentId = payload?.payment?.entity?.id || null;
  // Populated by Razorpay once checkout completes — stored so
  // updateRazorpayCustomerName() can later push the real company name to
  // Razorpay once the customer sets it at /complete-registration (we never
  // pre-create a Customer for trial signups the way the Business/Enterprise
  // upgrade path does, so this is the only place it's captured from).
  const customerId = entity.customer_id || null;

  const log = (status, companyId) => logSubscriptionEvent({ event: "subscription.authenticated", subscriptionId, companyId, status, rawPayload: payload });

  if (!subscriptionId) {
    await log("missing_subscription_id");
    return { status: "ignored", reason: "missing_subscription_id" };
  }

  // Only the trial plan auto-converts — a Business/Enterprise subscription
  // reaching "authenticated" is handled elsewhere (or not at all, since
  // those bill immediately and go straight to activated/charged).
  if (entity.plan_id !== getTrialRazorpayPlanId()) {
    await log("not_trial_plan");
    return { status: "ignored", reason: "not_trial_plan" };
  }

  const trialEndsAt = entity.start_at ? new Date(entity.start_at * 1000) : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const mysqlTrialEnds = trialEndsAt.toISOString().slice(0, 19).replace("T", " ");
  const convertsOnLabel = trialEndsAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const isNewSignup = notes.isNewTrialSignup === "true";
  const existingCompanyId = !isNewSignup && notes.companyId ? parseInt(notes.companyId) : null;

  /* ---------- Path B: existing company (already logged in) ---------- */
  if (existingCompanyId) {
    // Race guard: two rapid attempts (double-click, retry before the first
    // webhook lands) can authorize two separate mandates for the same
    // company. Whichever webhook arrives second finds the company already
    // claimed by a different subscription id — that's the loser, cancel it
    // rather than overwrite and risk two live mandates both converting at
    // day 15 (a real double-charge risk, not just a data-consistency one).
    const [[current]] = await db.query(
      `SELECT subscription_status, razorpay_subscription_id FROM companies WHERE id = ? LIMIT 1`,
      [existingCompanyId]
    );
    if (current?.subscription_status === "trial" && current.razorpay_subscription_id && current.razorpay_subscription_id !== subscriptionId) {
      await cancelDuplicateSubscription(subscriptionId, `company ${existingCompanyId} already claimed by ${current.razorpay_subscription_id}`);
      await log("duplicate_race", existingCompanyId);
      return { status: "duplicate_race", companyId: existingCompanyId };
    }

    try {
      // paymentId is only present when an addon was actually charged on
      // this subscription (a brand-new trial checkout). A mandate added
      // later to an already-existing trial (createMandateForExistingTrial,
      // no addon) has no payment entity in this event at all — leave
      // razorpay_payment_id/amount_paid untouched rather than overwriting
      // them with a ₹49 charge that never happened this time.
      await db.execute(
        `UPDATE companies SET
           subscription_status = 'trial',
           plan = 'trial',
           billing_interval = 'monthly',
           trial_ends_at = ?,
           razorpay_subscription_id = ?,
           razorpay_customer_id = COALESCE(?, razorpay_customer_id),
           razorpay_auto_debit_active = 0,
           razorpay_payment_id = COALESCE(?, razorpay_payment_id),
           amount_paid = CASE WHEN ? IS NOT NULL THEN ? ELSE amount_paid END,
           grace_period_ends_at = NULL,
           grace_period_day = 0,
           pending_upgrade_plan = NULL,
           pending_billing_interval = NULL,
           updated_at = NOW()
         WHERE id = ?`,
        [mysqlTrialEnds, subscriptionId, customerId, paymentId, paymentId, TRIAL_AMOUNT_PAISE, existingCompanyId]
      );
    } catch (err) {
      console.error("[RAZORPAY-TRIAL] existing-company activation failed:", err.message);
      throw err;
    }

    const [[row]] = await db.query(
      `SELECT c.name, u.email FROM companies c JOIN users u ON u.company_id = c.id AND u.role = 'user' WHERE c.id = ? LIMIT 1`,
      [existingCompanyId]
    );
    if (row?.email) {
      sendTrialActivatedEmailForExistingCompany({ email: row.email, companyName: row.name, convertsOnLabel }).catch((err) =>
        console.error("[RAZORPAY-TRIAL] existing-company welcome email failed:", err.message)
      );
    }

    await log("activated_existing", existingCompanyId);
    console.log(`[RAZORPAY-TRIAL] Trial activated for existing company ${existingCompanyId}, converts on ${convertsOnLabel}`);
    return { status: "activated_existing", companyId: existingCompanyId };
  }

  /* ---------- Path A: brand-new signup from the landing-page popup ---------- */
  const cleanEmail = normalizeEmail(notes.email);
  const cleanPhone = (notes.phone || "").replace(/\D/g, "").slice(-10);

  if (!cleanEmail || !cleanPhone) {
    console.error("[RAZORPAY-TRIAL] subscription.authenticated missing email/phone in notes:", { subscriptionId, notes });
    await log("missing_fields");
    return { status: "ignored", reason: "missing_fields" };
  }

  // Existing account? Same dedup safety net the old Orders flow had —
  // regenerate and resend rather than creating a second company. Compared
  // on the last 10 digits — see the comment on the same check above in
  // createTrialSubscription().
  const [[existingUser]] = await db.query(
    `SELECT u.id, u.email, u.phone FROM users u WHERE u.email = ? OR RIGHT(u.phone, 10) = ? LIMIT 1`,
    [cleanEmail, cleanPhone]
  );
  if (existingUser) {
    // This subscription belongs to nobody — the account it was meant to
    // create already exists (a race between two signup attempts, or a
    // retry). Left uncancelled, it's a live mandate that will genuinely
    // auto-charge ₹500/month at day 15 with no company ever tied to it.
    await cancelDuplicateSubscription(subscriptionId, `email/phone already registered to user ${existingUser.id}`);

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    await db.execute(`UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`, [passwordHash, existingUser.id]);
    Promise.allSettled([
      sendWhatsAppTemplate(existingUser.phone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, []),
      sendTrialWelcomeEmail(existingUser.email, tempPassword, convertsOnLabel),
    ]).then((results) => results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY-TRIAL] resend failed:", r.reason); }));
    await log("resent");
    return { status: "resent", companyExisted: true };
  }

  const name = "New Customer";
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
          registration_source, registration_complete, razorpay_subscription_id,
          razorpay_customer_id, razorpay_auto_debit_active, billing_interval,
          trial_ends_at, razorpay_payment_id, amount_paid)
         VALUES (?, ?, ?, '', ?, 'trial', 'trial', 'razorpay', 0, ?, ?, 0, 'monthly', ?, ?, ?)`,
        [name, slug, codePrefix, conferenceRooms, subscriptionId, customerId, mysqlTrialEnds, paymentId, TRIAL_AMOUNT_PAISE]
      );
      companyId = companyResult.insertId;
    } catch (err) {
      // razorpay_subscription_id UNIQUE collision — this exact subscription
      // was already processed by a concurrent/redelivered webhook call.
      if (err.code === "ER_DUP_ENTRY" && err.sqlMessage?.includes("razorpay_subscription_id")) {
        await conn.rollback();
        console.log("[RAZORPAY-TRIAL] duplicate webhook delivery for subscription", subscriptionId, "— already processed");
        await log("duplicate_delivery");
        return { status: "duplicate_delivery" };
      }
      throw err;
    }

    await conn.execute(
      `INSERT INTO users (company_id, email, phone, password_hash, must_change_password)
       VALUES (?, ?, ?, ?, 1)`,
      [companyId, cleanEmail, cleanPhone, passwordHash]
    );

    if (conferenceRooms > 0) {
      const roomValues = Array.from({ length: conferenceRooms }, (_, i) => [companyId, `Conference Room ${i + 1}`, i + 1]);
      await conn.query(`INSERT INTO conference_rooms (company_id, room_name, room_number) VALUES ?`, [roomValues]);
    }

    await conn.commit();

    Promise.allSettled([
      sendWhatsAppTemplate(cleanPhone, process.env.GUPSHUP_BOT_WELCOME_TEMPLATE, []),
      sendTrialWelcomeEmail(cleanEmail, tempPassword, convertsOnLabel),
    ]).then((results) => results.forEach((r) => { if (r.status === "rejected") console.error("[RAZORPAY-TRIAL] welcome notification failed:", r.reason); }));

    await log("created", companyId);
    console.log(`[RAZORPAY-TRIAL] New trial company ${companyId} created, converts to Business on ${convertsOnLabel}`);
    return { status: "created", companyId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
