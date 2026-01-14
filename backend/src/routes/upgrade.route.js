import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * SUBSCRIPTION & UPGRADE FLOW
 *
 * PLANS:
 * - TRIAL     → ₹49  (One-time Processing Fee)
 * - BUSINESS  → ₹500 / Month (Recurring)
 * - ENTERPRISE → Contact Sales (Custom Pricing)
 *
 * UPGRADE PATHS:
 * - Trial → Business (Direct payment)
 * - Trial → Enterprise (Contact form submission)
 * - Business → Enterprise (Contact form submission)
 *
 * Activation happens ONLY via Zoho Webhook after payment success
 */

/* ================= INITIAL SUBSCRIPTION (Trial Only) ================= */
router.post("/subscribe", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    const email = req.user?.email;
    const companyId = req.user?.companyId;

    /* ================= VALIDATION ================= */
    if (!plan) {
      return res.status(400).json({ success: false, message: "Plan is required" });
    }

    if (plan !== "free") {
      return res.status(400).json({ 
        success: false, 
        message: "This endpoint is for trial subscription only. Use /upgrade for Business or Enterprise" 
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
    const status = (company.subscription_status || "").toLowerCase();

    /* ================= ACTIVE GUARD ================= */
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({
        success: false,
        message: "Subscription already active. Use /upgrade endpoint to upgrade your plan"
      });
    }

    let client = await zohoClient();

    /**
     * ======================================================
     * PENDING CASE → Reuse existing valid payment link
     * ======================================================
     */
    if (
      status === "pending" &&
      company.last_payment_link &&
      company.last_payment_link_id
    ) {
      try {
        const { data } = await client.get(
          `/paymentlinks/${company.last_payment_link_id}`
        );

        const linkStatus = data?.payment_link?.status?.toLowerCase();
        console.log("🔍 Zoho payment link status:", linkStatus);

        if (["created", "sent"].includes(linkStatus)) {
          return res.json({
            success: true,
            reused: true,
            message: "Existing payment link still valid",
            url: data.payment_link.url
          });
        }

        console.log("⚠ Old payment link expired/closed → will generate new");
      } catch {
        console.log("⚠ Could not verify old link → generating new");
      }
    }

    /* ================= ENSURE ZOHO CUSTOMER ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer…");

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
    }

    /* ================= TRIAL PRICING ================= */
    const payment_amount = "49.00";
    const description = "PROMEET Trial Processing Fee";

    console.log(
      `💳 Creating Trial Payment Link → ₹${payment_amount} for Company ${companyId}`
    );

    const payload = {
      customer_id: customerId,
      customer_name: companyName,
      currency_code: "INR",
      payment_amount,
      description,
      is_partial_payment: false,
      reference_id: `TRIAL-${companyId}-${Date.now()}`
    };

    console.log("📤 ZOHO PAYMENT PAYLOAD:", payload);

    /* ================= CREATE PAYMENT LINK ================= */
    let data;

    try {
      ({ data } = await client.post("/paymentlinks", payload));
    } catch (err) {
      if (err?.response?.status === 401) {
        console.warn("🔄 Zoho token expired — retrying…");
        client = await zohoClient();
        ({ data } = await client.post("/paymentlinks", payload));
      } else throw err;
    }

    const link = data?.payment_link;
    if (!link?.url || !link?.payment_link_id) {
      throw new Error("Zoho did not return payment link");
    }

    /* ================= UPDATE DB ================= */
    await db.query(
      `
      UPDATE companies
      SET 
        subscription_status='pending',
        plan = 'trial',
        last_payment_link = ?,
        last_payment_link_id = ?,
        last_payment_created_at = NOW()
      WHERE id=?
      `,
      [link.url, link.payment_link_id, companyId]
    );

    return res.json({
      success: true,
      message: "Payment link generated successfully",
      url: link.url
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR →", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Subscription failed"
    });
  }
});

/* ================= UPGRADE ENDPOINT ================= */
router.post("/upgrade", authenticate, async (req, res) => {
  try {
    const { plan, contactInfo } = req.body;
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

    /* ================= ENTERPRISE UPGRADE (CONTACT SALES) ================= */
    if (plan === "enterprise") {
      // Validate contact info for enterprise
      if (!contactInfo || !contactInfo.name || !contactInfo.phone || !contactInfo.message) {
        return res.status(400).json({
          success: false,
          message: "Contact information required for Enterprise plan (name, phone, message)"
        });
      }

      // Store upgrade request in database
      await db.query(
        `
        INSERT INTO upgrade_requests 
        (company_id, current_plan, requested_plan, contact_name, contact_phone, message, status, created_at)
        VALUES (?, ?, 'enterprise', ?, ?, ?, 'pending', NOW())
        `,
        [
          companyId,
          currentPlan || 'trial',
          contactInfo.name,
          contactInfo.phone,
          contactInfo.message
        ]
      );

      // TODO: Send email notification to sales team
      // TODO: Send confirmation email to customer

      return res.json({
        success: true,
        requiresContact: true,
        message: "Enterprise upgrade request submitted. Our sales team will contact you within 24 hours.",
        data: {
          plan: "enterprise",
          status: "pending_contact"
        }
      });
    }

    /* ================= BUSINESS UPGRADE (PAYMENT REQUIRED) ================= */
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
          message: "Cannot downgrade from Enterprise to Business. Contact support."
        });
      }

      /**
       * ======================================================
       * CHECK FOR EXISTING PENDING BUSINESS UPGRADE
       * ======================================================
       */
      if (
        currentPlan === "trial" &&
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
            return res.json({
              success: true,
              reused: true,
              message: "Existing Business upgrade payment link still valid",
              url: data.payment_link.url
            });
          }

          console.log("⚠ Old payment link expired/different amount → generating new");
        } catch {
          console.log("⚠ Could not verify old link → generating new");
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

      console.log("📤 ZOHO PAYMENT PAYLOAD:", payload);

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
        } else throw err;
      }

      const link = data?.payment_link;
      if (!link?.url || !link?.payment_link_id) {
        throw new Error("Zoho did not return payment link");
      }

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

      return res.json({
        success: true,
        message: "Business upgrade payment link generated successfully",
        url: link.url
      });
    }

  } catch (err) {
    console.error("❌ UPGRADE ERROR →", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Upgrade failed"
    });
  }
});

export default router;
