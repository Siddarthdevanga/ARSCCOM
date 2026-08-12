import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { calcPrice } from "../constants/pricing.js";

const router = express.Router();

/**
 * UPGRADE FLOW - CRITICAL FIX
 *
 * ISSUE: Users clicking "upgrade" but not paying were losing access
 * SOLUTION: Never touch subscription_status when creating upgrade payment link
 *
 * RULES:
 * 1. Clicking "Upgrade" → Only set pending_upgrade_plan (+ pending_billing_interval)
 * 2. subscription_status / billing_interval stay unchanged
 * 3. User continues with current plan until:
 *    - Payment succeeds (webhook activates new plan/interval)
 *    - Current plan expires naturally
 * 4. Abandoned upgrades don't affect access
 *
 * PRICING (see constants/pricing.js):
 * Business   monthly: ₹500  base + 18% GST = ₹590  total
 * Business   annual:  ₹6000 base + 18% GST = ₹7080 total
 * Enterprise monthly: ₹1000  base + 18% GST = ₹1180  total
 * Enterprise annual:  ₹10000 base + 18% GST = ₹11800 total
 *
 * Business and Enterprise both use the exact same payment-link machinery
 * (reuse-pending-link check → ensure Zoho customer → create link → store
 * pending fields), differing only in plan name and price — that shared
 * logic lives in createPlanUpgradePaymentLink() below rather than being
 * duplicated per plan.
 */

const PLAN_LABELS = { business: "Business", enterprise: "Enterprise" };

async function createPlanUpgradePaymentLink({ plan, interval, company, companyId, companyName, email }) {
  const pricing = calcPrice(plan, interval);

  /* ── Reuse existing pending payment link if still valid FOR THIS PLAN+INTERVAL ── */
  if (
    company.pending_upgrade_plan === plan &&
    company.pending_billing_interval === interval &&
    company.last_payment_link &&
    company.last_payment_link_id
  ) {
    try {
      const client = await zohoClient();
      const { data } = await client.get(`/paymentlinks/${company.last_payment_link_id}`);
      const linkStatus = data?.payment_link?.status?.toLowerCase();
      const linkAmount = parseFloat(data?.payment_link?.payment_amount || "0");

      console.log("🔍 Existing payment link status:", linkStatus, "| amount:", linkAmount);

      if (["created", "sent"].includes(linkStatus) && linkAmount === pricing.total) {
        console.log(`♻️ Reusing existing ${PLAN_LABELS[plan]} payment link`);
        return { reused: true, url: data.payment_link.url, pricing };
      }

      console.log("⚠ Old payment link expired or different amount → generating new");
    } catch (err) {
      console.log("⚠ Could not verify old link → generating new", err.message);
    }
  }

  /* ── Ensure Zoho customer exists ────────────────── */
  let customerId = company.zoho_customer_id;

  if (!customerId) {
    console.log("🧾 Creating Zoho Customer…");
    const client = await zohoClient();
    const { data } = await client.post("/customers", {
      display_name: companyName,
      company_name: companyName,
      email,
    });

    customerId = data?.customer?.customer_id;
    if (!customerId) throw new Error("Zoho failed to create customer");

    await db.query(
      `UPDATE companies SET zoho_customer_id = ?, updated_at = NOW() WHERE id = ?`,
      [customerId, companyId]
    );
    console.log(`✅ Zoho Customer created: ${customerId}`);
  }

  /* ── Create payment link ────────────────────────── */
  const intervalLabel = interval === "annual" ? "Annual" : "Monthly";
  const planLabel = PLAN_LABELS[plan];
  const payload = {
    customer_id:        customerId,
    customer_name:      companyName,
    currency_code:      "INR",
    payment_amount:     pricing.totalStr,
    description:        `Hai Visitor ${planLabel} Plan (${intervalLabel}) — ₹${pricing.base} + 18% GST (₹${pricing.gst})`,
    is_partial_payment: false,
    reference_id:       `${plan.toUpperCase()}-UPGRADE-${interval.toUpperCase()}-${companyId}-${Date.now()}`,
  };

  console.log(`💳 Creating ${planLabel} ${intervalLabel} Upgrade Payment Link → ₹${pricing.totalStr} (incl. 18% GST) for Company ${companyId}`);

  let client = await zohoClient();
  let data;

  try {
    ({ data } = await client.post("/paymentlinks", payload));
  } catch (err) {
    if (err?.response?.status === 401) {
      console.warn("🔄 Zoho token expired — retrying…");
      client = await zohoClient();
      ({ data } = await client.post("/paymentlinks", payload));
    } else {
      console.error("❌ Zoho payment link creation failed:", err?.response?.data || err.message);
      throw err;
    }
  }

  const link = data?.payment_link;
  if (!link?.url || !link?.payment_link_id)
    throw new Error("Zoho did not return payment link");

  console.log(`✅ Payment link created: ${link.payment_link_id}`);

  /* ── Update DB — ONLY pending fields, never subscription_status/billing_interval ── */
  await db.query(
    `UPDATE companies
     SET pending_upgrade_plan     = ?,
         pending_billing_interval = ?,
         last_payment_link        = ?,
         last_payment_link_id     = ?,
         last_payment_created_at  = NOW(),
         updated_at               = NOW()
     WHERE id = ?`,
    [plan, interval, link.url, link.payment_link_id, companyId]
  );

  console.log(`✅ DB updated: Company ${companyId} → Pending ${planLabel} ${interval} upgrade`);

  return { reused: false, url: link.url, pricing };
}

/* ======================================================
   POST /api/upgrade
====================================================== */
router.post("/", authenticate, async (req, res) => {
  try {
    const { plan }    = req.body;
    // Interval applies to business/enterprise — trial is a fixed one-time charge.
    const interval    = req.body.interval === "annual" ? "annual" : "monthly";
    const email       = req.user?.email;
    const companyId   = req.user?.companyId;

    /* ── Validation ─────────────────────────────────── */
    if (!plan)
      return res.status(400).json({ success: false, message: "Plan is required" });

    if (!["trial", "business", "enterprise"].includes(plan))
      return res.status(400).json({ success: false, message: "Invalid plan. Choose 'trial', 'business' or 'enterprise'" });

    if (!email || !companyId)
      return res.status(401).json({ success: false, message: "Authentication failed" });

    /* ── Fetch company ──────────────────────────────── */
    const [[company]] = await db.query(
      `SELECT
         id, name, subscription_status, plan, billing_interval,
         zoho_customer_id, last_payment_link,
         last_payment_link_id, pending_upgrade_plan,
         pending_billing_interval,
         trial_ends_at, subscription_ends_at
       FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company)
      return res.status(404).json({ success: false, message: "Company not found" });

    const companyName = company.name || "Customer";
    const currentPlan = (company.plan || "").toLowerCase();
    const status      = (company.subscription_status || "").toLowerCase();

    console.log(`🔄 Upgrade Request: Company ${companyId} | Current: ${currentPlan} (${status}) | Requested: ${plan}`);

    /* ======================================================
       TRIAL — blocked entirely (trial is one-time only)
    ====================================================== */
    if (plan === "trial") {
      return res.status(403).json({ success: false, message: "Trial plan can only be used once. Please upgrade to the Business or Enterprise plan." });
    }

    /* ======================================================
       BUSINESS / ENTERPRISE — generate payment link
       (identical machinery, price/description differ by plan)
    ====================================================== */
    if (plan === "business" || plan === "enterprise") {
      const pricing = calcPrice(plan, interval);

      // Block only if currently active on this SAME plan+interval
      // (not in grace period) — switching interval, or downgrading from
      // Enterprise to Business, still goes through as a fresh upgrade request.
      if (currentPlan === plan && status === "active" && company.billing_interval === interval) {
        return res.status(403).json({ success: false, message: `Already on the ${PLAN_LABELS[plan]} ${interval} plan` });
      }

      const { reused, url, pricing: linkPricing } = await createPlanUpgradePaymentLink({
        plan, interval, company, companyId, companyName, email,
      });

      const responseData = {
        plan,
        interval,
        baseAmount:  `₹${linkPricing.base.toFixed(2)}`,
        gst:         `₹${linkPricing.gst.toFixed(2)} (18%)`,
        totalAmount: `₹${linkPricing.totalStr}`,
        currency:    "INR",
        currentPlanContinues: true,
        currentStatus: status,
      };

      return res.json({
        success: true,
        reused,
        redirectTo: url,
        message: reused
          ? `Existing ${PLAN_LABELS[plan]} upgrade payment link still valid. Your current plan remains active until payment.`
          : `${PLAN_LABELS[plan]} upgrade payment link generated. Your current plan remains active until you complete payment.`,
        data: responseData,
      });
    }

  } catch (err) {
    console.error("❌ UPGRADE ERROR →", err?.response?.data || err.message);
    console.error("Stack:", err.stack);
    return res.status(500).json({
      success: false,
      message: err?.response?.data?.message || err?.message || "Upgrade failed",
    });
  }
});

/* ======================================================
   GET /api/upgrade/options
====================================================== */
router.get("/options", authenticate, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId)
      return res.status(401).json({ success: false, message: "Authentication failed" });

    // Interval only matters for business/enterprise — trial pricing is fixed.
    const interval = req.query.interval === "annual" ? "annual" : "monthly";

    const [[company]] = await db.query(
      `SELECT plan, subscription_status, pending_upgrade_plan FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company)
      return res.status(404).json({ success: false, message: "Company not found" });

    const currentPlan   = (company.plan || "trial").toLowerCase();
    const status        = (company.subscription_status || "").toLowerCase();
    const pendingUpgrade = company.pending_upgrade_plan;

    const businessP   = calcPrice("business", interval);
    const enterpriseP = calcPrice("enterprise", interval);
    const periodLabel = interval === "annual" ? "/ year" : "/ month";

    const businessCard = (overrides) => ({
      plan: "business", interval,
      basePrice: `₹${businessP.base}`, gst: `₹${businessP.gst} (18%)`,
      totalPrice: `₹${businessP.totalStr} ${periodLabel}`,
      requiresPayment: true, isPending: pendingUpgrade === "business",
      features: ["Unlimited visitors", "Visitor management only — no conference booking", "Priority support"],
      ...overrides,
    });

    const enterpriseCard = (overrides) => ({
      plan: "enterprise", interval,
      basePrice: `₹${enterpriseP.base}`, gst: `₹${enterpriseP.gst} (18%)`,
      totalPrice: `₹${enterpriseP.totalStr} ${periodLabel}`,
      requiresPayment: true, isPending: pendingUpgrade === "enterprise",
      features: ["Unlimited visitors", "Unlimited conference bookings", "Unlimited conference rooms", "Dedicated support"],
      ...overrides,
    });

    // Renewal card for current plan (always shown)
    const renewalOptions = [];

    // Trial users cannot renew trial — they must upgrade to Business/Enterprise
    if (currentPlan === "business") {
      renewalOptions.push(businessCard({ name: "Renew Business Plan", isRenewal: true }));
    } else if (currentPlan === "enterprise") {
      renewalOptions.push(enterpriseCard({ name: "Renew Enterprise Plan", isRenewal: true }));
    }

    // Upgrade / downgrade options
    const availableUpgrades = [];

    if (currentPlan === "trial") {
      availableUpgrades.push(
        businessCard({ name: "Upgrade to Business" }),
        enterpriseCard({ name: "Upgrade to Enterprise" })
      );
    } else if (currentPlan === "business") {
      availableUpgrades.push(enterpriseCard({ name: "Upgrade to Enterprise" }));
    } else if (currentPlan === "enterprise") {
      // Downgrade path — same payment machinery, just a lower-priced plan.
      availableUpgrades.push(businessCard({ name: "Downgrade to Business", isDowngrade: true }));
    }

    return res.json({
      success: true,
      currentPlan,
      status,
      pendingUpgrade,
      renewalOptions,
      availableUpgrades,
    });

  } catch (err) {
    console.error("❌ GET UPGRADE OPTIONS ERROR →", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch upgrade options" });
  }
});

export default router;
