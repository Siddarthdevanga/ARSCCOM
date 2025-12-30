import express from "express";
import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * Subscription Payment Handler
 * TRIAL  → ₹49 Processing Fee
 * BUSINESS  → ₹500 Subscription Fee
 *
 * Activation happens ONLY via Zoho Webhook after payment success.
 */
router.post("/subscribe", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;

    const email = req.user?.email;
    const companyId = req.user?.companyId;

    /* ================= VALIDATION ================= */
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Plan is required"
      });
    }

    if (!["free", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected"
      });
    }

    if (!email || !companyId) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed"
      });
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
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    const companyName = company.name;
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
     * If status = pending → check if last link is still valid
     * If valid → reuse
     * If expired/used → create new link
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
        console.log("Zoho Existing Link Status:", linkStatus);

        if (["created", "sent"].includes(linkStatus)) {
          return res.json({
            success: true,
            reused: true,
            message: "Existing payment link still valid",
            url: data.payment_link.url
          });
        }

        console.log("Old payment link expired / closed → generating new…");
      } catch (err) {
        console.log("Failed to verify old payment link → creating new");
      }
    }

    /* ================= ENSURE CUSTOMER EXISTS ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("Creating Zoho Customer…");

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

    /* ================= PRICING ================= */
    const pricing = {
      free: { amount: 49, description: "PROMEET Trial Processing Fee" },
      business: { amount: 500, description: "PROMEET Business Subscription" }
    };

    const price = pricing[plan];
    const amount = Number(Number(price.amount).toFixed(2));

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount"
      });
    }

    console.log(`Creating New Payment Link → ₹${amount} (${plan})`);

    const payload = {
      customer_id: customerId,
      currency_code: "INR",
      amount,
      description: price.description,
      is_partial_payment: false,
      reference_id: `COMP-${companyId}-${Date.now()}`
    };

    /* ================= CREATE PAYMENT LINK ================= */
    let data;

    try {
      ({ data } = await client.post("/paymentlinks", payload));
    } catch (err) {
      if (err?.response?.status === 401) {
        console.warn("Zoho token expired — retrying…");
        client = await zohoClient();
        ({ data } = await client.post("/paymentlinks", payload));
      } else throw err;
    }

    const paymentLink = data?.payment_link;
    if (!paymentLink?.url || !paymentLink?.payment_link_id) {
      throw new Error("Zoho did not return payment link");
    }

    /* ================= UPDATE COMPANY ================= */
    await db.query(
      `
      UPDATE companies
      SET 
        subscription_status='pending',
        plan = ?,
        last_payment_link = ?,
        last_payment_link_id = ?,
        last_payment_created_at = NOW()
      WHERE id=?
      `,
      [
        plan === "business" ? "business" : "trial",
        paymentLink.url,
        paymentLink.payment_link_id,
        companyId
      ]
    );

    return res.json({
      success: true,
      message: "Payment link generated successfully",
      url: paymentLink.url
    });

  } catch (err) {
    console.error("SUBSCRIPTION ERROR →", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Subscription failed"
    });
  }
});

export default router;
