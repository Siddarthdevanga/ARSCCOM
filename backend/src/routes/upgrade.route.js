import express from "express";
import { db } from "../config/db.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { calcPrice } from "../constants/pricing.js";
import { createSubscription, updateSubscriptionPlan, cancelSubscription, isSubscriptionUpdatable } from "../services/razorpaySubscription.service.js";

const router = express.Router();

/**
 * UPGRADE / DOWNGRADE / RENEW FLOW — Razorpay Subscriptions (full
 * replacement of the old Zoho payment-link flow, same route/response
 * shape the frontend already calls).
 *
 * - A company with no active Razorpay subscription yet (still on Trial,
 *   or never subscribed) → createSubscription(): a fresh mandate
 *   authorization via checkout, same as a first-time signup.
 * - A company that already has an active Razorpay subscription → this is
 *   the actual "upgrade/downgrade" case: updateSubscriptionPlan() changes
 *   the plan on the EXISTING mandate, taking effect at the next billing
 *   date — no re-authorization, no proration, current plan/access
 *   continues uninterrupted until then.
 * - "Renew" (same plan+interval) also just goes through createSubscription
 *   when there's no active subscription (e.g. it lapsed), or is simply a
 *   no-op if a subscription is already active and current — the auto-debit
 *   handles renewal on its own from here on, nothing to click.
 */

const PLAN_LABELS = { business: "Business", enterprise: "Enterprise" };

// Hardcoded for now — a single live promo. Worth promoting to a small
// DB-backed table (code -> {plan, interval, offerId}) once there's a
// second one to manage; not worth that scope while there's only one.
const PROMO_CODES = {
  WEB30: { plan: "business", interval: "annual", offerId: "offer_TXU3V0c40VEuze" },
};

router.post("/", authenticate, async (req, res) => {
  try {
    const { plan, promoCode } = req.body;
    const interval = req.body.interval === "annual" ? "annual" : "monthly";
    const companyId = req.user?.companyId;

    if (!plan) return res.status(400).json({ success: false, message: "Plan is required" });
    if (!["trial", "business", "enterprise"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan. Choose 'trial', 'business' or 'enterprise'" });
    }
    if (!companyId) return res.status(401).json({ success: false, message: "Authentication failed" });

    let offerId;
    if (promoCode) {
      const promo = PROMO_CODES[String(promoCode).trim().toUpperCase()];
      if (!promo || promo.plan !== plan || promo.interval !== interval) {
        return res.status(400).json({ success: false, message: "This promo code isn't valid for the selected plan" });
      }
      offerId = promo.offerId;
    }

    if (plan === "trial") {
      return res.status(403).json({ success: false, message: "Trial plan can only be used once. Please upgrade to the Business or Enterprise plan." });
    }

    const [[company]] = await db.query(
      `SELECT plan, subscription_status, billing_interval, razorpay_subscription_id
       FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const currentPlan = (company.plan || "").toLowerCase();
    const status = (company.subscription_status || "").toLowerCase();

    if (currentPlan === plan && status === "active" && company.billing_interval === interval) {
      return res.status(403).json({ success: false, message: `Already on the ${PLAN_LABELS[plan]} ${interval} plan` });
    }

    const pricing = calcPrice(plan, interval);
    const responseData = {
      plan, interval,
      baseAmount: `₹${pricing.base.toFixed(2)}`,
      gst: `₹${pricing.gst.toFixed(2)} (18%)`,
      totalAmount: `₹${pricing.totalStr}`,
      currency: "INR",
      currentPlanContinues: true,
      currentStatus: status,
    };

    // Has a stored subscription id — but that alone isn't proof it's
    // actually usable (it may have been created and then abandoned before
    // checkout completed). Verify the live Razorpay-side status before
    // trying to update it; a stale id is cleared so it stops being tried.
    if (company.razorpay_subscription_id && status === "active") {
      const updatable = await isSubscriptionUpdatable(company.razorpay_subscription_id);
      if (updatable) {
        // offer_id is only accepted by Razorpay's CREATE Subscription API,
        // not the update-plan-in-place path used here — rather than
        // silently charging full price while implying a discount applied,
        // reject clearly so the customer knows to contact support instead.
        if (offerId) {
          return res.status(400).json({
            success: false,
            message: "This promo code only applies to a new subscription, not a plan change on an existing one. Contact support if you'd like this applied.",
          });
        }

        const result = await updateSubscriptionPlan({ companyId, plan, interval });

        // UPI mandates can't be updated in-place at all — updateSubscriptionPlan
        // already cancelled the old one and created a fresh one pinned to the
        // same next-billing-date; the customer just needs to re-authorize it.
        if (result.requiresCheckout) {
          return res.json({
            success: true,
            mode: "subscription",
            message: `Your payment method doesn't support in-place plan changes — please confirm to activate ${PLAN_LABELS[plan]}. Takes effect on your next billing date; your current plan remains active until then.`,
            subscriptionId: result.subscriptionId,
            keyId: result.keyId,
            data: responseData,
          });
        }

        return res.json({
          success: true,
          mode: "scheduled",
          message: `${PLAN_LABELS[plan]} plan scheduled — takes effect on your next billing date. Your current plan remains active until then.`,
          data: { ...responseData, scheduled: result.scheduled },
        });
      }
      console.warn(`[UPGRADE] company ${companyId} has stale razorpay_subscription_id ${company.razorpay_subscription_id} (not authenticated/active) — clearing and starting a fresh checkout instead`);
      await db.query(`UPDATE companies SET razorpay_subscription_id = NULL WHERE id = ?`, [companyId]);
    }

    // No active mandate yet (still on Trial, or previously cancelled/
    // expired) — needs a fresh checkout to authorize auto-debit.
    const subscription = await createSubscription({ companyId, plan, interval, offerId });
    return res.json({
      success: true,
      mode: "subscription",
      message: `Authorize payment to activate your ${PLAN_LABELS[plan]} plan.`,
      subscriptionId: subscription.subscriptionId,
      keyId: subscription.keyId,
      data: responseData,
    });

  } catch (err) {
    console.error("❌ UPGRADE ERROR →", err?.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: err?.response?.data?.error?.description || err?.message || "Upgrade failed",
    });
  }
});

/* ======================================================
   POST /api/upgrade/cancel — self-serve cancellation (Settings page).
   Stops future auto-debits; current paid-through access continues until
   subscription_ends_at, then the existing grace-period flow takes over
   exactly as it does for any other expiry.
====================================================== */
router.post("/cancel", authenticate, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Authentication failed" });

    await cancelSubscription(companyId);
    return res.json({
      success: true,
      message: "Subscription cancelled. You'll keep access until your current billing period ends — no further charges after that.",
    });
  } catch (err) {
    console.error("❌ CANCEL SUBSCRIPTION ERROR →", err?.response?.data || err.message);
    return res.status(400).json({
      success: false,
      message: err?.response?.data?.error?.description || err?.message || "Failed to cancel subscription",
    });
  }
});

/* ======================================================
   GET /api/upgrade/options
====================================================== */
router.get("/options", authenticate, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Authentication failed" });

    const interval = req.query.interval === "annual" ? "annual" : "monthly";

    const [[company]] = await db.query(
      `SELECT plan, subscription_status, pending_upgrade_plan, razorpay_subscription_id
       FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const currentPlan = (company.plan || "trial").toLowerCase();
    const status = (company.subscription_status || "").toLowerCase();
    const pendingUpgrade = company.pending_upgrade_plan;
    const hasActiveSubscription = !!company.razorpay_subscription_id && status === "active";
    // Downgrade (Enterprise → Business) is only offered once the current
    // plan has lapsed — grace period counts as already lapsed for this
    // purpose, same as expired/cancelled. Never offered while genuinely active.
    const planHasLapsed = ["grace_period", "expired", "cancelled"].includes(status);

    const businessP = calcPrice("business", interval);
    const enterpriseP = calcPrice("enterprise", interval);
    const periodLabel = interval === "annual" ? "/ year" : "/ month";

    const businessCard = (overrides) => ({
      plan: "business", interval,
      basePrice: `₹${businessP.base}`, gst: `₹${businessP.gst} (18%)`,
      totalPrice: `₹${businessP.totalStr} ${periodLabel}`,
      requiresPayment: !hasActiveSubscription, isPending: pendingUpgrade === "business",
      features: ["Unlimited visitors", "Visitor management only — no conference booking", "Priority support"],
      ...overrides,
    });

    const enterpriseCard = (overrides) => ({
      plan: "enterprise", interval,
      basePrice: `₹${enterpriseP.base}`, gst: `₹${enterpriseP.gst} (18%)`,
      totalPrice: `₹${enterpriseP.totalStr} ${periodLabel}`,
      requiresPayment: !hasActiveSubscription, isPending: pendingUpgrade === "enterprise",
      features: ["Unlimited visitors", "Unlimited conference bookings", "Unlimited conference rooms", "Dedicated support"],
      ...overrides,
    });

    const renewalOptions = [];
    if (currentPlan === "business") {
      renewalOptions.push(businessCard({ name: "Renew Business Plan", isRenewal: true }));
    } else if (currentPlan === "enterprise") {
      renewalOptions.push(enterpriseCard({ name: "Renew Enterprise Plan", isRenewal: true }));
    }

    const availableUpgrades = [];
    if (currentPlan === "trial") {
      availableUpgrades.push(businessCard({ name: "Upgrade to Business" }), enterpriseCard({ name: "Upgrade to Enterprise" }));
    } else if (currentPlan === "business") {
      availableUpgrades.push(enterpriseCard({ name: "Upgrade to Enterprise" }));
    } else if (currentPlan === "enterprise" && planHasLapsed) {
      availableUpgrades.push(businessCard({ name: "Switch to Business", isDowngrade: true }));
    }

    return res.json({
      success: true,
      currentPlan, status, pendingUpgrade, hasActiveSubscription,
      renewalOptions, availableUpgrades,
    });

  } catch (err) {
    console.error("❌ GET UPGRADE OPTIONS ERROR →", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch upgrade options" });
  }
});

export default router;
