import axios from "axios";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { sendWhatsAppTemplate } from "./gupshup.service.js";
import { emailFooter } from "./auth.service.js";
import { calcPrice, getRazorpayPlanId, razorpayPlanIdToPlan } from "../constants/pricing.js";
import { syncRoomActivationByPlan } from "./superadmin.service.js";

/* ======================================================
   RAZORPAY SUBSCRIPTIONS — real auto-debit billing for
   Business/Enterprise, replacing the old Zoho payment-link flow.
   Trial stays a one-time Orders-API charge (see razorpay.service.js) —
   never a recurring subscription.
====================================================== */

const RAZORPAY_API = "https://api.razorpay.com/v1";

// Large enough to effectively never run out (Razorpay requires a fixed
// total_count — there's no "forever" option). 120 monthly cycles = 10
// years; 20 annual cycles = 20 years. A subscription can still be
// cancelled or plan-changed at any time regardless of this number.
const TOTAL_COUNT = { monthly: 120, annual: 20 };

const razorpayAuth = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay API keys are not configured");
  return { username: keyId, password: keySecret };
};

const PLAN_LABELS = { business: "Business", enterprise: "Enterprise" };

// Only these Razorpay-side states allow a plan-change PATCH. Any other
// state (created, pending, halted, cancelled, completed, expired) means
// the mandate was never authorized (or no longer is) — a fresh checkout
// via createSubscription is required instead.
const UPDATABLE_STATES = new Set(["authenticated", "active"]);

/* ======================================================
   LIVE STATUS CHECK — the DB's razorpay_subscription_id + our own
   subscription_status columns are not proof the subscription is
   actually usable on Razorpay's side (e.g. a subscription created but
   never authorized because checkout was abandoned/failed). Callers
   must verify this before attempting an update.
====================================================== */
export const isSubscriptionUpdatable = async (subscriptionId) => {
  if (!subscriptionId) return false;
  try {
    const { data } = await axios.get(
      `${RAZORPAY_API}/subscriptions/${subscriptionId}`,
      { auth: razorpayAuth() }
    );
    return UPDATABLE_STATES.has(data.status);
  } catch (err) {
    console.error(`[RAZORPAY-SUB] status check failed for ${subscriptionId}:`, err.response?.data?.error?.description || err.message);
    return false;
  }
};

/* ======================================================
   CREATE SUBSCRIPTION — first-time signup, or upgrade from a plan
   that never had an active Razorpay subscription (e.g. Trial).
====================================================== */
export const createSubscription = async ({ companyId, plan, interval }) => {
  if (!["business", "enterprise"].includes(plan)) {
    throw new Error("Invalid plan — must be 'business' or 'enterprise'");
  }
  const cleanInterval = interval === "annual" ? "annual" : "monthly";
  const planId = getRazorpayPlanId(plan, cleanInterval);
  if (!planId) {
    throw new Error(`Razorpay plan not configured for ${plan}/${cleanInterval} (RAZORPAY_PLAN_${plan.toUpperCase()}_${cleanInterval.toUpperCase()})`);
  }

  const [[company]] = await db.query(
    `SELECT c.id, c.name, c.razorpay_customer_id, c.razorpay_subscription_id, u.email, u.phone
     FROM companies c
     JOIN users u ON u.company_id = c.id AND u.role = 'user'
     WHERE c.id = ? LIMIT 1`,
    [companyId]
  );
  if (!company) throw new Error("Company not found");

  /* ── Tidy up a previous abandoned/declined attempt, if any. Only ever
     cancels a subscription confirmed NOT live (never leaves a genuinely
     active mandate cancelled by accident) — otherwise every retry after a
     declined checkout leaves a dead subscription sitting on Razorpay's
     side forever. Best-effort: never blocks the new subscription. ── */
  if (company.razorpay_subscription_id) {
    try {
      const stillLive = await isSubscriptionUpdatable(company.razorpay_subscription_id);
      if (!stillLive) {
        await axios.post(
          `${RAZORPAY_API}/subscriptions/${company.razorpay_subscription_id}/cancel`,
          {},
          { auth: razorpayAuth() }
        );
      }
    } catch (err) {
      console.error(`[RAZORPAY-SUB] cleanup of stale subscription ${company.razorpay_subscription_id} failed (non-fatal):`, err.response?.data?.error?.description || err.message);
    }
  }

  /* ── Ensure a Razorpay Customer exists ── */
  let customerId = company.razorpay_customer_id;
  if (!customerId) {
    try {
      const { data } = await axios.post(
        `${RAZORPAY_API}/customers`,
        { name: company.name, email: company.email, contact: company.phone, fail_existing: 0 },
        { auth: razorpayAuth() }
      );
      customerId = data.id;
    } catch (err) {
      // fail_existing:0 should reuse a matching customer instead of
      // erroring, but handle a race/edge case defensively.
      if (err.response?.data?.error?.metadata?.customer_id) {
        customerId = err.response.data.error.metadata.customer_id;
      } else {
        throw err;
      }
    }
    await db.query(`UPDATE companies SET razorpay_customer_id = ? WHERE id = ?`, [customerId, companyId]);
  }

  /* ── Create the subscription (not yet active — customer still needs to
     authorize the mandate via checkout) ── */
  const { data: subscription } = await axios.post(
    `${RAZORPAY_API}/subscriptions`,
    {
      plan_id: planId,
      customer_notify: 1,
      total_count: TOTAL_COUNT[cleanInterval],
      notes: { companyId: String(companyId), plan, interval: cleanInterval },
    },
    { auth: razorpayAuth() }
  );

  await db.query(`UPDATE companies SET razorpay_subscription_id = ? WHERE id = ?`, [subscription.id, companyId]);

  return {
    subscriptionId: subscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
    pricing: calcPrice(plan, cleanInterval),
  };
};

/* ======================================================
   UPDATE SUBSCRIPTION PLAN — upgrade/downgrade for a company that
   already has an active Razorpay subscription. Takes effect at the
   NEXT billing cycle (schedule_change_at: cycle_end) — current plan
   and access continue uninterrupted until then, no proration.
====================================================== */
export const updateSubscriptionPlan = async ({ companyId, plan, interval }) => {
  if (!["business", "enterprise"].includes(plan)) {
    throw new Error("Invalid plan — must be 'business' or 'enterprise'");
  }
  const cleanInterval = interval === "annual" ? "annual" : "monthly";
  const planId = getRazorpayPlanId(plan, cleanInterval);
  if (!planId) {
    throw new Error(`Razorpay plan not configured for ${plan}/${cleanInterval}`);
  }

  const [[company]] = await db.query(
    `SELECT razorpay_subscription_id FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );
  if (!company?.razorpay_subscription_id) {
    throw new Error("No active Razorpay subscription for this company — use createSubscription instead");
  }
  if (!(await isSubscriptionUpdatable(company.razorpay_subscription_id))) {
    throw new Error("STALE_SUBSCRIPTION");
  }

  try {
    await axios.patch(
      `${RAZORPAY_API}/subscriptions/${company.razorpay_subscription_id}`,
      { plan_id: planId, schedule_change_at: "cycle_end" },
      { auth: razorpayAuth() }
    );
  } catch (err) {
    const description = err.response?.data?.error?.description || "";
    // UPI Autopay mandates can NEVER be updated in-place — this is a fixed
    // Razorpay platform restriction, not something retrying fixes. Only
    // path left: cancel the old mandate at cycle-end and create a fresh
    // one, but pin its start_at to that same cycle-end date so it still
    // behaves as "takes effect on next billing date" rather than charging
    // immediately — same no-proration promise as the card-based path,
    // just with one extra re-authorization step the customer can't avoid.
    if (/payment mode is upi/i.test(description)) {
      return upgradeViaCancelAndRecreate({ companyId, plan, cleanInterval, planId, oldSubscriptionId: company.razorpay_subscription_id });
    }
    throw err;
  }

  // Purely informational — lets the UI say "changing to Enterprise on your
  // next billing date." The actual switch happens via the subscription.
  // charged webhook once Razorpay applies it at cycle end.
  await db.query(
    `UPDATE companies SET pending_upgrade_plan = ?, pending_billing_interval = ? WHERE id = ?`,
    [plan, cleanInterval, companyId]
  );

  return { scheduled: true, plan, interval: cleanInterval, pricing: calcPrice(plan, cleanInterval) };
};

/* ======================================================
   UPI FALLBACK — cancel the old mandate at cycle-end, create a new one
   with start_at pinned to that same date so billing timing is unchanged;
   the customer must re-authorize (unavoidable for UPI), but sees exactly
   one clean checkout, not a confusing two-step cancel-then-resubscribe.
====================================================== */
const upgradeViaCancelAndRecreate = async ({ companyId, plan, cleanInterval, planId, oldSubscriptionId }) => {
  const { data: oldSub } = await axios.get(
    `${RAZORPAY_API}/subscriptions/${oldSubscriptionId}`,
    { auth: razorpayAuth() }
  );
  const startAt = oldSub.current_end; // Unix seconds — old cycle's end date

  await axios.post(
    `${RAZORPAY_API}/subscriptions/${oldSubscriptionId}/cancel`,
    { cancel_at_cycle_end: 1 },
    { auth: razorpayAuth() }
  );

  const { data: newSub } = await axios.post(
    `${RAZORPAY_API}/subscriptions`,
    {
      plan_id: planId,
      customer_notify: 1,
      total_count: TOTAL_COUNT[cleanInterval],
      start_at: startAt,
      notes: { companyId: String(companyId), plan, interval: cleanInterval },
    },
    { auth: razorpayAuth() }
  );

  await db.query(
    `UPDATE companies SET razorpay_subscription_id = ?, pending_upgrade_plan = ?, pending_billing_interval = ? WHERE id = ?`,
    [newSub.id, plan, cleanInterval, companyId]
  );

  return {
    requiresCheckout: true,
    subscriptionId: newSub.id,
    keyId: process.env.RAZORPAY_KEY_ID,
    plan, interval: cleanInterval,
    pricing: calcPrice(plan, cleanInterval),
  };
};

/* ======================================================
   CANCEL SUBSCRIPTION — self-serve, from Settings. Stops future
   auto-debits; current paid-through access continues until
   subscription_ends_at (cancel_at_cycle_end), then the existing
   grace-period cron takes over exactly as it does for any other
   expiry, regardless of which gateway originally billed it.
====================================================== */
export const cancelSubscription = async (companyId) => {
  const [[company]] = await db.query(
    `SELECT razorpay_subscription_id, plan FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );
  if (!company?.razorpay_subscription_id) {
    throw new Error("No active Razorpay subscription for this company");
  }

  // A trial's mandate is often still only "authenticated" (real billing
  // hasn't started yet — that only happens at day 15 via start_at).
  // Razorpay rejects cancel_at_cycle_end:1 on a subscription with no
  // billing cycle yet (confirmed against their docs) — it needs an
  // immediate cancel instead. Only a genuinely "active" subscription
  // (already billing) supports the cycle-end deferral.
  let cancelAtCycleEnd = 1;
  try {
    const { data } = await axios.get(
      `${RAZORPAY_API}/subscriptions/${company.razorpay_subscription_id}`,
      { auth: razorpayAuth() }
    );
    if (data.status !== "active") cancelAtCycleEnd = 0;
  } catch (err) {
    console.error(`[RAZORPAY-SUB] status check before cancel failed for ${company.razorpay_subscription_id}:`, err.response?.data?.error?.description || err.message);
  }

  await axios.post(
    `${RAZORPAY_API}/subscriptions/${company.razorpay_subscription_id}/cancel`,
    { cancel_at_cycle_end: cancelAtCycleEnd },
    { auth: razorpayAuth() }
  );

  if (company.plan === "trial") {
    // Mandate is dead immediately — the trial itself was already paid for
    // (the ₹49) and its access continues to trial_ends_at regardless;
    // there's simply no future conversion charge coming anymore. Clearing
    // the id means HAS_TRIAL_MANDATE correctly reads false from here on.
    await db.query(`UPDATE companies SET razorpay_subscription_id = NULL WHERE id = ?`, [companyId]);
  } else {
    // Auto-debit is genuinely off from this point, even though plan access
    // continues until subscription_ends_at — so "Renew" should reappear for
    // the customer right away rather than waiting for the date to lapse.
    await db.query(`UPDATE companies SET razorpay_auto_debit_active = 0 WHERE id = ?`, [companyId]);
  }

  return { cancelled: true };
};

/* ======================================================
   ACTIVATION EMAIL (shared by first activation and renewal)
====================================================== */
const sendActivationEmail = async ({ email, companyName, plan, interval, endsAt, isRenewal }) => {
  const planLabel = PLAN_LABELS[plan];
  const endsLabel = new Date(endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  await sendEmail({
    to: email,
    subject: isRenewal
      ? `Hai Visitor ${planLabel} — Renewed Successfully`
      : `Welcome to Hai Visitor ${planLabel}!`,
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">H<span style="color:#FDBA74;">ai</span> Visitor</div>
          <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,.12);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">
            ${planLabel} Plan ${isRenewal ? "Renewed" : "Activated"}
          </div>
        </div>
        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello <b>${companyName}</b>,</p>
          <p style="font-size:15px;color:#262046;">
            ${isRenewal
              ? `Your <b>Hai Visitor ${planLabel}</b> subscription has been renewed successfully.`
              : `Your <b>Hai Visitor ${planLabel}</b> subscription is now active. Thank you for upgrading!`}
          </p>
          <div style="background:#F1ECFB;border-left:4px solid #7C3AED;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <table style="width:100%;font-size:14px;color:#262046;border-collapse:collapse;">
              <tr><td style="padding:4px 0;color:#6E6890;">Plan</td><td style="padding:4px 0;text-align:right;font-weight:700;">${planLabel} (${interval === "annual" ? "Annual" : "Monthly"})</td></tr>
              <tr><td style="padding:4px 0;color:#6E6890;">Next billing date</td><td style="padding:4px 0;text-align:right;font-weight:700;">${endsLabel}</td></tr>
            </table>
          </div>
          <p style="font-size:13px;color:#6E6890;">
            Your card/UPI mandate will be charged automatically on your next billing date — no action needed. You can cancel anytime from Settings.
          </p>
          ${emailFooter()}
        </div>
      </div>
    `,
  });
};

/* ======================================================
   WEBHOOK LOG (mirrors razorpay_webhook_log used for the Orders/trial
   flow — separate table since the shape of what's useful to log differs)
====================================================== */
const logSubscriptionEvent = async ({ event, subscriptionId, companyId, status, rawPayload }) => {
  try {
    await db.execute(
      `INSERT INTO razorpay_subscription_log (event, subscription_id, company_id, status, raw_payload)
       VALUES (?, ?, ?, ?, ?)`,
      [event, subscriptionId || null, companyId || null, status, JSON.stringify(rawPayload)]
    );
  } catch (err) {
    console.error("[RAZORPAY-SUB] failed to write webhook log:", err.message);
  }
};

/* ======================================================
   HANDLE SUBSCRIPTION WEBHOOK EVENTS
   subscription.activated / subscription.charged — mandate authorized
     and/or a cycle successfully charged. Activates/renews the plan.
   subscription.halted — Razorpay exhausted its own retry attempts on a
     failed charge. subscription_ends_at simply stops being extended, and
     the EXISTING gracePeriodCron already treats any company whose ends_at
     has passed as expired, starting the same 10-day grace flow regardless
     of which gateway originally billed it — so plan/access timing is
     untouched here. But razorpay_auto_debit_active IS cleared immediately:
     the mandate is genuinely dead at this point (Razorpay already gave up
     retrying), so the customer should see "Renew" and be able to fix their
     payment method right away rather than being stuck until their already-
     paid-for period actually runs out with no way to intervene.
   subscription.cancelled — same immediate flag-clear, for the same reason
     (though self-serve cancellation already clears it synchronously in
     cancelSubscription() — this covers cancellation via Razorpay's
     dashboard/API directly, not just our own Settings button).
====================================================== */
export const handleSubscriptionWebhookEvent = async (event, payload) => {
  const entity = payload?.subscription?.entity || {};
  const subscriptionId = entity.id;
  const companyId = entity.notes?.companyId ? parseInt(entity.notes.companyId) : null;

  const log = (status) => logSubscriptionEvent({ event, subscriptionId, companyId, status, rawPayload: payload });

  if (!subscriptionId) {
    await log("missing_subscription_id");
    return { status: "ignored", reason: "missing_subscription_id" };
  }

  if (event === "subscription.halted" || event === "subscription.cancelled") {
    await db.query(
      `UPDATE companies SET razorpay_auto_debit_active = 0 WHERE razorpay_subscription_id = ?`,
      [subscriptionId]
    );
    console.log(`[RAZORPAY-SUB] ${event} for ${subscriptionId} — auto-debit flag cleared, grace period cron handles expiry timing naturally`);
    await log(event === "subscription.halted" ? "halted" : "cancelled");
    return { status: "logged", event };
  }

  if (event !== "subscription.activated" && event !== "subscription.charged") {
    await log("ignored_event");
    return { status: "ignored", reason: event };
  }

  const planMatch = razorpayPlanIdToPlan(entity.plan_id);
  if (!planMatch) {
    console.error(`[RAZORPAY-SUB] ${event}: plan_id ${entity.plan_id} doesn't match any configured plan`);
    await log("unrecognized_plan");
    return { status: "ignored", reason: "unrecognized_plan" };
  }
  const { plan, interval } = planMatch;

  // Resolve the company either by the notes companyId (set at creation) or,
  // as a fallback, by the subscription id already stored on a row (covers
  // a plan-change webhook where notes might not carry through identically).
  const [[company]] = await db.query(
    companyId
      ? `SELECT id, name FROM companies WHERE id = ? LIMIT 1`
      : `SELECT id, name FROM companies WHERE razorpay_subscription_id = ? LIMIT 1`,
    [companyId || subscriptionId]
  );
  if (!company) {
    console.error(`[RAZORPAY-SUB] ${event}: no company found for subscription ${subscriptionId}`);
    await log("company_not_found");
    return { status: "ignored", reason: "company_not_found" };
  }

  const [[existing]] = await db.query(
    `SELECT plan, subscription_status FROM companies WHERE id = ? LIMIT 1`,
    [company.id]
  );
  const isRenewal = existing?.plan === plan && existing?.subscription_status === "active";

  // current_end is a Unix timestamp (seconds) — this becomes the new
  // paid-through date and, indirectly, the next charge date.
  const endsAt = entity.current_end ? new Date(entity.current_end * 1000) : null;
  const mysqlEnds = endsAt
    ? endsAt.toISOString().slice(0, 19).replace("T", " ")
    : null;

  // Confirmed via a real webhook payload: entity.customer_id is still null
  // at subscription.authenticated (it's captured there too, in
  // razorpayTrialSubscription.service.js, but always stores NULL) — Razorpay
  // doesn't attach the actual cust_... id until the subscription reaches
  // active. This is the first point it's reliably present.
  const customerId = entity.customer_id || null;

  // A trial customer almost always completes /complete-registration (real
  // company name) long before this conversion fires, but at that earlier
  // point razorpay_customer_id didn't exist yet — the name-sync attempted
  // there was a silent no-op. Push it now, the first moment a customer id
  // actually exists to push it to. Best-effort, never blocks activation.
  if (customerId && company.name) {
    axios.put(
      `${RAZORPAY_API}/customers/${customerId}`,
      { name: company.name },
      { auth: razorpayAuth() }
    ).catch((err) => console.error(`[RAZORPAY-SUB] failed to sync customer name for ${customerId}:`, err.response?.data?.error?.description || err.message));
  }

  await db.query(
    `UPDATE companies SET
       subscription_status = 'active',
       plan = ?,
       billing_interval = ?,
       subscription_ends_at = COALESCE(?, subscription_ends_at),
       razorpay_subscription_id = ?,
       razorpay_customer_id = COALESCE(?, razorpay_customer_id),
       razorpay_auto_debit_active = 1,
       razorpay_charge_reminder_sent = 0,
       pending_upgrade_plan = NULL,
       pending_billing_interval = NULL,
       grace_period_ends_at = NULL,
       grace_period_day = 0,
       expired_reminder_last_sent_at = NULL,
       wa_reminders_sent = '',
       updated_at = NOW()
     WHERE id = ?`,
    [plan, interval, mysqlEnds, subscriptionId, customerId, company.id]
  );

  await syncRoomActivationByPlan(company.id, plan);

  const [[user]] = await db.query(
    `SELECT email, phone FROM users WHERE company_id = ? AND role = 'user' LIMIT 1`,
    [company.id]
  );

  if (user?.email && mysqlEnds) {
    sendActivationEmail({
      email: user.email, companyName: company.name, plan, interval,
      endsAt: mysqlEnds, isRenewal,
    }).catch((err) => console.error("[RAZORPAY-SUB] activation email failed:", err.message));
  }

  if (user?.phone) {
    const templateKey = plan === "business" ? "GUPSHUP_BUSINESS_ACTIVATED_TEMPLATE" : "GUPSHUP_ENTERPRISE_ACK_TEMPLATE";
    if (process.env[templateKey]) {
      sendWhatsAppTemplate(user.phone, process.env[templateKey], [company.name]).catch((err) =>
        console.error("[RAZORPAY-SUB] activation WhatsApp failed:", err.message)
      );
    }
  }

  await log(isRenewal ? "renewed" : "activated");
  console.log(`[RAZORPAY-SUB] ${event}: company ${company.id} → ${plan}/${interval}, ends ${mysqlEnds}`);
  return { status: isRenewal ? "renewed" : "activated", companyId: company.id, plan, interval };
};
