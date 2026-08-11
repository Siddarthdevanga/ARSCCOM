import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { calcPrice } from "../constants/pricing.js";

const router = express.Router();

/**
 * SUBSCRIPTION PAYMENT FLOW
 *
 * TRIAL              → ₹49   base + 18% GST = ₹57.82  (one-time, 15 days)
 * BUSINESS / monthly → ₹500  base + 18% GST = ₹590.00
 * BUSINESS / annual  → ₹6000 base + 18% GST = ₹7080.00
 *
 * Activation happens ONLY via Zoho Webhook after payment success
 */

router.post("/subscribe", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    // Interval only applies to the business plan — trial is always a fixed
    // one-time charge regardless of what's sent here.
    const interval = req.body.interval === "annual" ? "annual" : "monthly";
    const email = req.user?.email;
    const companyId = req.user?.companyId;

    /* ================= VALIDATION ================= */
    if (!plan) {
      return res.status(400).json({ success: false, message: "Plan is required" });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan selected" });
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
        message: "Subscription already active"
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

        const linkAmount = parseFloat(data?.payment_link?.payment_amount || "0");
        const expectedPricing = calcPrice(plan === "business" ? "business" : "trial", interval);

        // Only reuse the old link if its amount matches what THIS request
        // would generate — otherwise a pending monthly link would get
        // silently reused for an annual request (or vice versa).
        if (["created", "sent"].includes(linkStatus) && expectedPricing && linkAmount === expectedPricing.total) {
          return res.json({
            success: true,
            reused:  true,
            message: "Existing payment link still valid",
            url:     data.payment_link.url,
            pricing: expectedPricing,
          });
        }

        console.log("⚠ Old payment link expired/closed or amount mismatch → generating new");
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

    /* ================= PLAN PRICING (with GST) ================= */
    const planDescriptions = {
      free:     "Hai Visitor Trial Processing Fee",
      business: interval === "annual" ? "Hai Visitor Business Subscription (Annual)" : "Hai Visitor Business Subscription (Monthly)",
    };

    const pricing = calcPrice(plan === "business" ? "business" : "trial", interval);
    if (!pricing) {
      return res.status(400).json({ success: false, message: "Invalid plan pricing" });
    }

    // Zoho requires amount as string "590.00"
    const payment_amount = pricing.totalStr;

    if (!payment_amount || Number(payment_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount"
      });
    }

    console.log(
      `💳 Creating Zoho Payment Link → Base ₹${pricing.base} + GST ₹${pricing.gst} = ₹${pricing.total} (${plan}/${interval}) for Company ${companyId}`
    );

    const payload = {
      customer_id:       customerId,
      customer_name:     companyName,
      currency_code:     "INR",
      payment_amount,                    // total including 18% GST
      description:       `${planDescriptions[plan]} (incl. 18% GST)`,
      is_partial_payment: false,
      reference_id:      `COMP-${companyId}-${Date.now()}`
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
        plan = ?,
        billing_interval = ?,
        last_payment_link = ?,
        last_payment_link_id = ?,
        last_payment_created_at = NOW()
      WHERE id=?
      `,
      [
        plan === "business" ? "business" : "trial",
        plan === "business" ? interval : "monthly",
        link.url,
        link.payment_link_id,
        companyId
      ]
    );

    return res.json({
      success:  true,
      message:  "Payment link generated successfully",
      url:      link.url,
      pricing,          // { base, gst, total } — use in frontend to display breakdown
    });

  } catch (err) {
    console.error("❌ SUBSCRIPTION ERROR →", err?.response?.data || err);

    return res.status(500).json({
      success:  false,
      message:  err?.response?.data?.message || err?.message || "Subscription failed"
    });
  }
});

export default router;
