import axios from "axios";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { getTrialRazorpayPlanId } from "../constants/pricing.js";
import { isSubscriptionUpdatable } from "./razorpaySubscription.service.js";
import { emailFooter } from "./auth.service.js";

/* ======================================================
   TRIAL SUBSCRIPTION (MANDATE-BASED) — Path B only: a web-registered
   company (already has an account, created via the normal /register +
   payment.captured flow) choosing Trial from the in-app /subscription
   page. This is the ONLY place a trial still becomes a real Razorpay
   Subscription with an auto-convert-to-Business mandate.

   The landing-page popup (Path A, no account yet) reverted to a plain
   one-time ₹49 Order — see razorpay.service.js — with NO mandate and
   NO auto-conversion; trial customers from that path must manually
   pick a plan (Business/Enterprise) after their 15 days, same as
   before this whole auto-convert feature existed. That reversion was
   deliberate: real customers should only ever get a recurring mandate
   when they explicitly choose a paid plan themselves.
====================================================== */

const RAZORPAY_API = "https://api.razorpay.com/v1";
const TRIAL_AMOUNT_PAISE = 4900; // ₹49
const TRIAL_DAYS = 15;
const TOTAL_COUNT_MONTHLY = 120; // matches razorpaySubscription.service.js's monthly count

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
   CREATE TRIAL SUBSCRIPTION — existing company (Path B, web-registered
   company choosing Trial from /subscription). Account already exists,
   so notes carries companyId.
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
   Called from /complete-registration once the customer sets their real
   company name, so Razorpay's own dashboard reflects it too. Best-effort:
   never blocks registration completion if it fails, and a company with
   no razorpay_customer_id on file (e.g. Business/Enterprise, or a
   Path-A trial that never had a mandate) is a silent no-op.
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
   HANDLE subscription.authenticated
   --------------------------------------------------------
   Fires the moment the mandate is confirmed and the ₹49 addon is
   captured — current_start/current_end are still null at this point
   (real billing hasn't started; that's subscription.activated later).
   Path B only now — Path A (landing-page popup) no longer creates a
   Subscription at all, so it never reaches this handler. Still guarded
   to only act on the trial plan_id, since a Business/Enterprise
   subscription reaching "authenticated" on its way to its own
   immediate first charge also fires this same event.
====================================================== */
export const handleSubscriptionAuthenticated = async (payload) => {
  const entity = payload?.subscription?.entity || {};
  const subscriptionId = entity.id;
  const notes = entity.notes || {};
  const paymentId = payload?.payment?.entity?.id || null;
  const customerId = entity.customer_id || null;

  const log = (status, companyId) => logSubscriptionEvent({ event: "subscription.authenticated", subscriptionId, companyId, status, rawPayload: payload });

  if (!subscriptionId) {
    await log("missing_subscription_id");
    return { status: "ignored", reason: "missing_subscription_id" };
  }

  if (entity.plan_id !== getTrialRazorpayPlanId()) {
    await log("not_trial_plan");
    return { status: "ignored", reason: "not_trial_plan" };
  }

  const trialEndsAt = entity.start_at ? new Date(entity.start_at * 1000) : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const mysqlTrialEnds = trialEndsAt.toISOString().slice(0, 19).replace("T", " ");
  const convertsOnLabel = trialEndsAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const existingCompanyId = notes.companyId ? parseInt(notes.companyId) : null;
  if (!existingCompanyId) {
    console.error("[RAZORPAY-TRIAL] subscription.authenticated for trial plan with no companyId in notes:", { subscriptionId, notes });
    await log("missing_fields");
    return { status: "ignored", reason: "missing_fields" };
  }

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
};
