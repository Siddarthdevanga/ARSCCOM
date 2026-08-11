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
 * Business monthly: ₹500  base + 18% GST = ₹590  total
 * Business annual:  ₹6000 base + 18% GST = ₹7080 total
 */

/* ======================================================
   POST /api/upgrade
====================================================== */
router.post("/", authenticate, async (req, res) => {
  try {
    const { plan }    = req.body;
    // Interval only applies to the business plan.
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
       ENTERPRISE — redirect to contact form
    ====================================================== */
    if (plan === "enterprise") {
      console.log(`📧 Redirecting Company ${companyId} to contact form for Enterprise upgrade`);

      await db.query(
        `UPDATE companies SET pending_upgrade_plan = 'enterprise', updated_at = NOW() WHERE id = ?`,
        [companyId]
      );

      // WhatsApp — enterprise acknowledgement
      const enterpriseTemplate = process.env.GUPSHUP_ENTERPRISE_ACK_TEMPLATE || "";
      if (enterpriseTemplate) {
        try {
          const [[user]] = await db.query(
            `SELECT u.phone, c.name FROM users u JOIN companies c ON c.id = u.company_id
             WHERE u.company_id = ? AND u.role = 'user' AND u.is_active = 1 LIMIT 1`, [companyId]
          );
          if (user?.phone) {
            const { sendWhatsAppTemplate } = await import("../services/gupshup.service.js");
            const d = String(user.phone).replace(/\D/g, "");
            const phone = d.length === 10 ? `91${d}` : d;
            await sendWhatsAppTemplate(phone, enterpriseTemplate, [user.name]);
            console.log(`[UPGRADE] Enterprise ack WhatsApp sent to ${user.phone}`);
          }
        } catch (e) {
          console.error(`[UPGRADE] Enterprise ack WhatsApp failed:`, e.message);
        }
      }

      return res.json({
        success: true,
        requiresContact: true,
        redirectTo: "/auth/contact-us",
        message: "Please fill out the contact form to discuss Enterprise plan options. Your current plan remains active.",
        data: {
          plan: "enterprise",
          currentPlan,
          currentPlanContinues: true,
        },
      });
    }

    /* ======================================================
       TRIAL — blocked entirely (trial is one-time only)
    ====================================================== */
    if (plan === "trial") {
      return res.status(403).json({ success: false, message: "Trial plan can only be used once. Please upgrade to the Business plan." });
    }

    /* ======================================================
       BUSINESS — generate payment link (monthly ₹590 or annual ₹7080, incl. 18% GST)
    ====================================================== */
    if (plan === "business") {
      const pricing = calcPrice("business", interval);

      // Block only if currently active on business at this SAME interval
      // (not in grace period) — switching interval while active is still
      // allowed to go through as a fresh upgrade request.
      if (currentPlan === "business" && status === "active" && company.billing_interval === interval)
        return res.status(403).json({ success: false, message: `Already on the Business ${interval} plan` });

      if (currentPlan === "enterprise" && status !== "grace_period")
        return res.status(403).json({ success: false, message: "Cannot downgrade from Enterprise to Business. Please contact support." });

      /* ── Reuse existing pending payment link if still valid FOR THIS INTERVAL ── */
      if (
        company.pending_upgrade_plan === "business" &&
        company.pending_billing_interval === interval &&
        company.last_payment_link &&
        company.last_payment_link_id
      ) {
        let client = await zohoClient();
        try {
          const { data } = await client.get(`/paymentlinks/${company.last_payment_link_id}`);
          const linkStatus = data?.payment_link?.status?.toLowerCase();
          const linkAmount = parseFloat(data?.payment_link?.payment_amount || "0");

          console.log("🔍 Existing payment link status:", linkStatus, "| amount:", linkAmount);

          if (["created", "sent"].includes(linkStatus) && linkAmount === pricing.total) {
            console.log("♻️ Reusing existing Business payment link");
            return res.json({
              success: true,
              reused: true,
              redirectTo: data.payment_link.url,
              message: "Existing Business upgrade payment link still valid. Your current plan remains active until payment.",
              data: {
                plan: "business",
                interval,
                baseAmount:  `₹${pricing.base.toFixed(2)}`,
                gst:         `₹${pricing.gst.toFixed(2)} (18%)`,
                totalAmount: `₹${pricing.totalStr}`,
                currency: "INR",
                currentPlanContinues: true,
              },
            });
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
        let client = await zohoClient();
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
      const payload = {
        customer_id:        customerId,
        customer_name:      companyName,
        currency_code:      "INR",
        payment_amount:     pricing.totalStr,
        description:        `Hai Visitor Business Plan (${intervalLabel}) — ₹${pricing.base} + 18% GST (₹${pricing.gst})`,
        is_partial_payment: false,
        reference_id:       `BIZ-UPGRADE-${interval.toUpperCase()}-${companyId}-${Date.now()}`,
      };

      console.log(`💳 Creating Business ${intervalLabel} Upgrade Payment Link → ₹${pricing.totalStr} (incl. 18% GST) for Company ${companyId}`);

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
         SET pending_upgrade_plan     = 'business',
             pending_billing_interval = ?,
             last_payment_link        = ?,
             last_payment_link_id     = ?,
             last_payment_created_at  = NOW(),
             updated_at               = NOW()
         WHERE id = ?`,
        [interval, link.url, link.payment_link_id, companyId]
      );

      console.log(`✅ DB updated: Company ${companyId} → Pending Business ${interval} upgrade`);
      console.log(`✅ IMPORTANT: subscription_status unchanged (${status}) — user keeps access`);

      return res.json({
        success: true,
        redirectTo: link.url,
        message: "Business upgrade payment link generated. Your current plan remains active until you complete payment.",
        data: {
          plan:        "business",
          interval,
          baseAmount:  `₹${pricing.base.toFixed(2)}`,
          gst:         `₹${pricing.gst.toFixed(2)} (18%)`,
          totalAmount: `₹${pricing.totalStr}`,
          currency:    "INR",
          currentPlanContinues: true,
          currentStatus: status,
        },
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

    // Only meaningful for the business plan — trial/enterprise pricing is
    // interval-independent.
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

    const businessP = calcPrice("business", interval);
    const businessPeriodLabel = interval === "annual" ? "/ year" : "/ month";

    // Renewal card for current plan (always shown)
    const renewalOptions = [];

    // Trial users cannot renew trial — they must upgrade to Business
    if (currentPlan === "business") {
      renewalOptions.push({
        plan: "business", interval, name: "Renew Business Plan", isRenewal: true,
        basePrice: `₹${businessP.base}`, gst: `₹${businessP.gst} (18%)`,
        totalPrice: `₹${businessP.totalStr} ${businessPeriodLabel}`,
        requiresPayment: true, isPending: pendingUpgrade === "business",
        features: ["Unlimited visitors", "1,000 conference bookings", "6 conference rooms", "Priority support"],
      });
    } else if (currentPlan === "enterprise") {
      renewalOptions.push({
        plan: "enterprise", name: "Renew Enterprise Plan", isRenewal: true,
        basePrice: "Custom Pricing", gst: "Applicable", totalPrice: "Custom Pricing",
        requiresPayment: false, requiresContact: true, isPending: pendingUpgrade === "enterprise",
        features: ["Unlimited everything", "Dedicated support"],
      });
    }

    // Upgrade options (higher plans only)
    const availableUpgrades = [];

    if (currentPlan === "trial") {
      availableUpgrades.push(
        {
          plan: "business", interval, name: "Upgrade to Business",
          basePrice: `₹${businessP.base}`, gst: `₹${businessP.gst} (18%)`,
          totalPrice: `₹${businessP.totalStr} ${businessPeriodLabel}`,
          requiresPayment: true, isPending: pendingUpgrade === "business",
          features: ["Unlimited visitors", "1,000 conference bookings", "6 conference rooms", "Priority support"],
        },
        {
          plan: "enterprise", name: "Enterprise Plan",
          basePrice: "Custom Pricing", gst: "Applicable", totalPrice: "Custom Pricing",
          requiresPayment: false, requiresContact: true, isPending: pendingUpgrade === "enterprise",
          features: ["Unlimited everything", "Custom integrations", "Dedicated account manager"],
        }
      );
    } else if (currentPlan === "business") {
      availableUpgrades.push({
        plan: "enterprise", name: "Upgrade to Enterprise",
        basePrice: "Custom Pricing", gst: "Applicable", totalPrice: "Custom Pricing",
        requiresPayment: false, requiresContact: true, isPending: pendingUpgrade === "enterprise",
        features: ["Unlimited everything", "Custom integrations", "Dedicated account manager"],
      });
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
