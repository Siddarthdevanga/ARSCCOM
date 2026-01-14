import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * UPGRADE FLOW
 *
 * PLANS:
 * - BUSINESS  → ₹500 / Month (Redirect to Zoho payment)
 * - ENTERPRISE → Contact Sales (Redirect to contact form)
 *
 * UPGRADE PATHS:
 * - Trial → Business (Generate payment link, return URL)
 * - Trial → Enterprise (Return contact form URL)
 * - Business → Enterprise (Return contact form URL)
 *
 * Activation happens ONLY via Zoho Webhook after payment success
 */

/* ================= UPGRADE ENDPOINT ================= */
router.post("/", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    const email = req.user?.email;
    const companyId = req.user?.companyId;

    /* ================= VALIDATION ================= */
    if (!plan) {
      return res.status(400).json({ success: false, message: "Plan is required" });
    }

    if (!["business", "enterprise"].includes(plan)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid plan. Choose 'business' or 'enterprise'" 
      });
    }

    if (!email || !companyId) {
      return res.status(401).json({ success: false, message: "Authentication failed" });
    }

    /* ================= FETCH COMPANY ================= */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        name,
        subscription_status,
        plan,
        zoho_customer_id,
        last_payment_link,
        last_payment_link_id
      FROM companies
      WHERE id=? LIMIT 1
      `,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const companyName = company.name || "Customer";
    const currentPlan = (company.plan || "").toLowerCase();
    const status = (company.subscription_status || "").toLowerCase();

    console.log(`🔄 Upgrade Request: Company ${companyId} | Current: ${currentPlan} | Requested: ${plan}`);

    /* ================= ENTERPRISE UPGRADE (REDIRECT TO CONTACT FORM) ================= */
    if (plan === "enterprise") {
      console.log(`📧 Redirecting Company ${companyId} to contact form for Enterprise upgrade`);

      return res.json({
        success: true,
        requiresContact: true,
        redirectTo: "/auth/contact-us",
        message: "Please fill out the contact form to discuss Enterprise plan options.",
        data: {
          plan: "enterprise",
          currentPlan: currentPlan
        }
      });
    }

    /* ================= BUSINESS UPGRADE (GENERATE PAYMENT LINK) ================= */
    if (plan === "business") {
      // Check if already on Business or Enterprise
      if (currentPlan === "business" && ["active", "trial"].includes(status)) {
        return res.status(403).json({
          success: false,
          message: "Already on Business plan"
        });
      }

      if (currentPlan === "enterprise") {
        return res.status(403).json({
          success: false,
          message: "Cannot downgrade from Enterprise to Business. Please contact support."
        });
      }

      /**
       * ======================================================
       * CHECK FOR EXISTING PENDING BUSINESS UPGRADE
       * ======================================================
       */
      if (
        status === "pending" &&
        company.last_payment_link &&
        company.last_payment_link_id
      ) {
        let client = await zohoClient();
        
        try {
          const { data } = await client.get(
            `/paymentlinks/${company.last_payment_link_id}`
          );

          const linkStatus = data?.payment_link?.status?.toLowerCase();
          console.log("🔍 Existing payment link status:", linkStatus);

          // Check if it's a business upgrade link (₹500)
          const linkAmount = parseFloat(data?.payment_link?.payment_amount || "0");
          
          if (["created", "sent"].includes(linkStatus) && linkAmount === 500.00) {
            console.log("♻️ Reusing existing Business payment link");
            return res.json({
              success: true,
              reused: true,
              redirectTo: data.payment_link.url,
              message: "Existing Business upgrade payment link still valid",
              data: {
                plan: "business",
                amount: "500.00",
                currency: "INR"
              }
            });
          }

          console.log("⚠ Old payment link expired/different amount → generating new");
        } catch (err) {
          console.log("⚠ Could not verify old link → generating new", err.message);
        }
      }

      /* ================= ENSURE ZOHO CUSTOMER ================= */
      let customerId = company.zoho_customer_id;

      if (!customerId) {
        console.log("🧾 Creating Zoho Customer…");

        let client = await zohoClient();
        const { data } = await client.post("/customers", {
          display_name: companyName,
          company_name: companyName,
          email
        });

        customerId = data?.customer?.customer_id;
        if (!customerId) throw new Error("Zoho failed to create customer");

        await db.query(
          `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
          [customerId, companyId]
        );

        console.log(`✅ Zoho Customer created: ${customerId}`);
      }

      /* ================= BUSINESS PLAN PRICING ================= */
      const payment_amount = "500.00";
      const description = "PROMEET Business Plan Upgrade";

      console.log(
        `💳 Creating Business Upgrade Payment Link → ₹${payment_amount} for Company ${companyId}`
      );

      const payload = {
        customer_id: customerId,
        customer_name: companyName,
        currency_code: "INR",
        payment_amount,
        description,
        is_partial_payment: false,
        reference_id: `BIZ-UPGRADE-${companyId}-${Date.now()}`
      };

      console.log("📤 ZOHO PAYMENT PAYLOAD:", JSON.stringify(payload, null, 2));

      /* ================= CREATE PAYMENT LINK ================= */
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
      if (!link?.url || !link?.payment_link_id) {
        throw new Error("Zoho did not return payment link");
      }

      console.log(`✅ Payment link created: ${link.payment_link_id}`);

      /* ================= UPDATE DB ================= */
      await db.query(
        `
        UPDATE companies
        SET 
          subscription_status='pending',
          plan = 'business',
          last_payment_link = ?,
          last_payment_link_id = ?,
          last_payment_created_at = NOW()
        WHERE id=?
        `,
        [link.url, link.payment_link_id, companyId]
      );

      console.log(`✅ Database updated: Company ${companyId} → Business (pending)`);

      return res.json({
        success: true,
        redirectTo: link.url,
        message: "Business upgrade payment link generated successfully",
        data: {
          plan: "business",
          amount: "500.00",
          currency: "INR"
        }
      });
    }

  } catch (err) {
    console.error("❌ UPGRADE ERROR →", err?.response?.data || err.message);
    console.error("Stack:", err.stack);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Upgrade failed"
    });
  }
});

/* ================= GET AVAILABLE UPGRADE OPTIONS ================= */
router.get("/options", authenticate, async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Authentication failed" });
    }

    const [[company]] = await db.query(
      `SELECT plan, subscription_status FROM companies WHERE id=? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const currentPlan = (company.plan || "trial").toLowerCase();
    const status = (company.subscription_status || "").toLowerCase();

    // Determine available upgrade options
    const availableUpgrades = [];

    if (currentPlan === "trial") {
      availableUpgrades.push(
        {
          plan: "business",
          name: "Business Plan",
          price: "₹500/month",
          requiresPayment: true,
          features: [
            "Unlimited visitors",
            "Unlimited conference bookings",
            "Advanced reporting",
            "Email notifications",
            "Priority support"
          ]
        },
        {
          plan: "enterprise",
          name: "Enterprise Plan",
          price: "Custom Pricing",
          requiresPayment: false,
          requiresContact: true,
          features: [
            "Everything in Business",
            "Custom integrations",
            "Dedicated account manager",
            "Custom branding",
            "SLA guarantee",
            "On-premise deployment option"
          ]
        }
      );
    } else if (currentPlan === "business") {
      availableUpgrades.push({
        plan: "enterprise",
        name: "Enterprise Plan",
        price: "Custom Pricing",
        requiresPayment: false,
        requiresContact: true,
        features: [
          "Everything in Business",
          "Custom integrations",
          "Dedicated account manager",
          "Custom branding",
          "SLA guarantee",
          "On-premise deployment option"
        ]
      });
    }

    return res.json({
      success: true,
      currentPlan,
      status,
      availableUpgrades
    });

  } catch (err) {
    console.error("❌ GET UPGRADE OPTIONS ERROR →", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch upgrade options"
    });
  }
});

export default router;
