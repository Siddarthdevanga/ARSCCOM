import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * UPGRADE FLOW - CRITICAL FIX
 *
 * ISSUE: Users clicking "upgrade" but not paying were losing access
 * SOLUTION: Never touch subscription_status when creating upgrade payment link
 *
 * RULES:
 * 1. Clicking "Upgrade" → Only set pending_upgrade_plan
 * 2. subscription_status stays "active" or "trial" (unchanged)
 * 3. User continues with current plan until:
 *    - Payment succeeds (webhook activates new plan)
 *    - Current plan expires naturally
 * 4. Abandoned upgrades don't affect access
 *
 * PRICING:
 * Business Plan: ₹500 base + 18% GST = ₹590 total
 */

/* ── Pricing constants ───────────────────────────────── */
const GST_RATE = 0.18;

const PRICING = {
  trial:    { base: 49,  label: "PROMEET Trial (15 Days)" },
  business: { base: 500, label: "PROMEET Business Plan (30 Days)" },
};

const calcPrice = (plan) => {
  const base  = PRICING[plan]?.base || 0;
  const gst   = parseFloat((base * GST_RATE).toFixed(2));
  const total = parseFloat((base + gst).toFixed(2));
  return { base, gst, total, totalStr: total.toFixed(2) };
};

// Keep legacy constants used in business block below
const BUSINESS_TOTAL_PRICE = calcPrice("business").total;
const BUSINESS_TOTAL_STR   = calcPrice("business").totalStr;
const BUSINESS_BASE_PRICE  = calcPrice("business").base;
const BUSINESS_GST_AMOUNT  = calcPrice("business").gst;

/* ======================================================
   POST /api/upgrade
====================================================== */
router.post("/", authenticate, async (req, res) => {
  try {
    const { plan }    = req.body;
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
         id, name, subscription_status, plan,
         zoho_customer_id, last_payment_link,
         last_payment_link_id, pending_upgrade_plan,
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
       TRIAL RENEWAL — ₹49 + 18% GST = ₹57.82
       Allowed for: trial (any status) or grace_period on any plan
    ====================================================== */
    if (plan === "trial") {
      if (currentPlan !== "trial")
        return res.status(403).json({ success: false, message: "Trial renewal is only available for Trial plan users." });

      const pricing = calcPrice("trial");

      // Reuse existing pending payment link if still valid
      if (company.pending_upgrade_plan === "trial" && company.last_payment_link && company.last_payment_link_id) {
        let client = await zohoClient();
        try {
          const { data } = await client.get(`/paymentlinks/${company.last_payment_link_id}`);
          const linkStatus = data?.payment_link?.status?.toLowerCase();
          const linkAmount = parseFloat(data?.payment_link?.payment_amount || "0");
          if (["created", "sent"].includes(linkStatus) && linkAmount === pricing.total) {
            return res.json({
              success: true, reused: true,
              redirectTo: data.payment_link.url,
              message: "Existing trial renewal payment link still valid.",
              data: { plan: "trial", baseAmount: `₹${pricing.base}`, gst: `₹${pricing.gst} (18%)`, totalAmount: `₹${pricing.totalStr}`, currency: "INR" },
            });
          }
        } catch (err) {
          console.log("⚠ Could not verify old trial link → generating new", err.message);
        }
      }

      // Ensure Zoho customer
      let customerId = company.zoho_customer_id;
      if (!customerId) {
        let client = await zohoClient();
        const { data } = await client.post("/customers", { display_name: companyName, company_name: companyName, email });
        customerId = data?.customer?.customer_id;
        if (!customerId) throw new Error("Zoho failed to create customer");
        await db.query(`UPDATE companies SET zoho_customer_id = ?, updated_at = NOW() WHERE id = ?`, [customerId, companyId]);
      }

      const payload = {
        customer_id: customerId, customer_name: companyName, currency_code: "INR",
        payment_amount: pricing.totalStr,
        description: `${PRICING.trial.label} — ₹${pricing.base} + 18% GST (₹${pricing.gst})`,
        is_partial_payment: false,
        reference_id: `TRIAL-RENEW-${companyId}-${Date.now()}`,
      };

      console.log(`💳 Creating Trial Renewal Payment Link → ₹${pricing.totalStr} for Company ${companyId}`);

      let client = await zohoClient();
      let data;
      try {
        ({ data } = await client.post("/paymentlinks", payload));
      } catch (err) {
        if (err?.response?.status === 401) {
          client = await zohoClient();
          ({ data } = await client.post("/paymentlinks", payload));
        } else throw err;
      }

      const link = data?.payment_link;
      if (!link?.url || !link?.payment_link_id) throw new Error("Zoho did not return payment link");

      await db.query(
        `UPDATE companies SET pending_upgrade_plan = 'trial', last_payment_link = ?, last_payment_link_id = ?, last_payment_created_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [link.url, link.payment_link_id, companyId]
      );

      return res.json({
        success: true, redirectTo: link.url,
        message: "Trial renewal payment link generated. Your current plan remains active until you complete payment.",
        data: { plan: "trial", baseAmount: `₹${pricing.base}`, gst: `₹${pricing.gst} (18%)`, totalAmount: `₹${pricing.totalStr}`, currency: "INR" },
      });
    }

    /* ======================================================
       BUSINESS — generate payment link (₹500 + 18% GST = ₹590)
    ====================================================== */
    if (plan === "business") {
      // Block only if currently active on business (not in grace period)
      if (currentPlan === "business" && status === "active")
        return res.status(403).json({ success: false, message: "Already on Business plan" });

      if (currentPlan === "enterprise" && status !== "grace_period")
        return res.status(403).json({ success: false, message: "Cannot downgrade from Enterprise to Business. Please contact support." });

      /* ── Reuse existing pending payment link if still valid ── */
      if (
        company.pending_upgrade_plan === "business" &&
        company.last_payment_link &&
        company.last_payment_link_id
      ) {
        let client = await zohoClient();
        try {
          const { data } = await client.get(`/paymentlinks/${company.last_payment_link_id}`);
          const linkStatus = data?.payment_link?.status?.toLowerCase();
          const linkAmount = parseFloat(data?.payment_link?.payment_amount || "0");

          console.log("🔍 Existing payment link status:", linkStatus, "| amount:", linkAmount);

          if (["created", "sent"].includes(linkStatus) && linkAmount === BUSINESS_TOTAL_PRICE) {
            console.log("♻️ Reusing existing Business payment link");
            return res.json({
              success: true,
              reused: true,
              redirectTo: data.payment_link.url,
              message: "Existing Business upgrade payment link still valid. Your current plan remains active until payment.",
              data: {
                plan: "business",
                baseAmount:  `₹${BUSINESS_BASE_PRICE.toFixed(2)}`,
                gst:         `₹${BUSINESS_GST_AMOUNT.toFixed(2)} (18%)`,
                totalAmount: `₹${BUSINESS_TOTAL_STR}`,
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
      const payload = {
        customer_id:        customerId,
        customer_name:      companyName,
        currency_code:      "INR",
        payment_amount:     BUSINESS_TOTAL_STR,
        description:        `PROMEET Business Plan — ₹${BUSINESS_BASE_PRICE} + 18% GST (₹${BUSINESS_GST_AMOUNT})`,
        is_partial_payment: false,
        reference_id:       `BIZ-UPGRADE-${companyId}-${Date.now()}`,
      };

      console.log(`💳 Creating Business Upgrade Payment Link → ₹${BUSINESS_TOTAL_STR} (incl. 18% GST) for Company ${companyId}`);
      console.log("📤 ZOHO PAYMENT PAYLOAD:", JSON.stringify(payload, null, 2));

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

      /* ── Update DB — ONLY pending fields, never subscription_status ── */
      await db.query(
        `UPDATE companies
         SET pending_upgrade_plan    = 'business',
             last_payment_link       = ?,
             last_payment_link_id    = ?,
             last_payment_created_at = NOW(),
             updated_at              = NOW()
         WHERE id = ?`,
        [link.url, link.payment_link_id, companyId]
      );

      console.log(`✅ DB updated: Company ${companyId} → Pending Business upgrade`);
      console.log(`✅ IMPORTANT: subscription_status unchanged (${status}) — user keeps access`);

      return res.json({
        success: true,
        redirectTo: link.url,
        message: "Business upgrade payment link generated. Your current plan remains active until you complete payment.",
        data: {
          plan:        "business",
          baseAmount:  `₹${BUSINESS_BASE_PRICE.toFixed(2)}`,
          gst:         `₹${BUSINESS_GST_AMOUNT.toFixed(2)} (18%)`,
          totalAmount: `₹${BUSINESS_TOTAL_STR}`,
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

    const [[company]] = await db.query(
      `SELECT plan, subscription_status, pending_upgrade_plan FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company)
      return res.status(404).json({ success: false, message: "Company not found" });

    const currentPlan   = (company.plan || "trial").toLowerCase();
    const status        = (company.subscription_status || "").toLowerCase();
    const pendingUpgrade = company.pending_upgrade_plan;

    const trialP    = calcPrice("trial");
    const businessP = calcPrice("business");

    // Renewal card for current plan (always shown)
    const renewalOptions = [];

    if (currentPlan === "trial") {
      renewalOptions.push({
        plan: "trial", name: "Renew Trial Plan", isRenewal: true,
        basePrice: `₹${trialP.base}`, gst: `₹${trialP.gst} (18%)`,
        totalPrice: `₹${trialP.totalStr} / 15 days`,
        requiresPayment: true, isPending: pendingUpgrade === "trial",
        features: ["100 visitor bookings", "100 conference bookings", "2 conference rooms"],
      });
    } else if (currentPlan === "business") {
      renewalOptions.push({
        plan: "business", name: "Renew Business Plan", isRenewal: true,
        basePrice: `₹${businessP.base}`, gst: `₹${businessP.gst} (18%)`,
        totalPrice: `₹${businessP.totalStr} / month`,
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
          plan: "business", name: "Upgrade to Business",
          basePrice: `₹${businessP.base}`, gst: `₹${businessP.gst} (18%)`,
          totalPrice: `₹${businessP.totalStr} / month`,
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
