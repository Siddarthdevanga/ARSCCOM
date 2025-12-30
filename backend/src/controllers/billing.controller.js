import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

/**
 * Subscription Payment Handler
 *
 * free / trial → ₹49 Processing Fee
 * business     → ₹500 Subscription Fee
 *
 * Subscription becomes ACTIVE only after Zoho Webhook confirmation
 */
export const createPayment = async (req, res) => {
  try {
    let companyId = req.user?.companyId || null;
    let email = req.user?.email || req.body?.email || null;
    let companyName = req.user?.companyName || null;

    const { plan } = req.body;

    /* ================= INPUT VALIDATION ================= */
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Plan is required"
      });
    }

    if (plan === "enterprise") {
      return res.status(400).json({
        success: false,
        message: "Enterprise plan requires contacting sales team"
      });
    }

    /** =====================================================
     *  🔥 Legacy Support (Old Companies)
     *  If request came without JWT → fetch using email
     * ===================================================== */
    if (!companyId) {
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required"
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      const [[user]] = await db.query(
        `SELECT id, company_id FROM users WHERE email=? LIMIT 1`,
        [cleanEmail]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      companyId = user.company_id;
      email = cleanEmail;
    }

    /* ================= FETCH COMPANY ================= */
    const [[company]] = await db.query(
      `
      SELECT 
        id,
        name,
        subscription_status,
        zoho_customer_id,
        last_payment_link
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    companyName = companyName || company.name;

    const status = (company.subscription_status || "").toLowerCase();

    /* ================= BLOCK ACTIVE USERS ================= */
    if (["trial", "active"].includes(status)) {
      return res.status(403).json({
        success: false,
        message: "Subscription already active"
      });
    }

    /**
     * If pending & payment link already exists → reuse
     */
    if (
      status === "pending" &&
      company.last_payment_link &&
      company.last_payment_link.trim() !== ""
    ) {
      return res.json({
        success: true,
        reused: true,
        message: "Payment already initiated",
        url: company.last_payment_link
      });
    }

    /* ================= ZOHO CLIENT ================= */
    let client = await zohoClient();

    /* ================= ENSURE ZOHO CUSTOMER ================= */
    let customerId = company.zoho_customer_id;

    if (!customerId) {
      console.log("🧾 Creating Zoho Customer…");

      let response;

      try {
        response = await client.post("/customers", {
          display_name: companyName,
          company_name: companyName,
          email
        });
      } catch (err) {
        if (err?.response?.status === 401) {
          console.warn("🔄 Zoho token expired — retrying create customer…");
          client = await zohoClient();
          response = await client.post("/customers", {
            display_name: companyName,
            company_name: companyName,
            email
          });
        } else throw err;
      }

      customerId = response?.data?.customer?.customer_id;
      if (!customerId) throw new Error("Failed to create Zoho customer");

      await db.query(
        `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
        [customerId, companyId]
      );
    }

    /* ================= PLAN PRICING ================= */
    const pricing = {
      free: { amount: 49.0, description: "PROMEET Trial Processing Fee" },
      trial: { amount: 49.0, description: "PROMEET Trial Processing Fee" },
      business: { amount: 500.0, description: "PROMEET Business Subscription" }
    };

    const selected = pricing[plan];

    if (!selected) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected"
      });
    }

    /**
     * ZOHO RULE 🔥
     * payment_amount MUST be STRING WITH 2 DECIMALS
     */
    const paymentAmount = Number(selected.amount).toFixed(2);

    console.log(
      `💳 Creating Zoho Payment Link → ₹${paymentAmount} (${plan}) for Company ${companyId}`
    );

    /* ================= PAYMENT PAYLOAD ================= */
    const payload = {
      customer_id: customerId,
      customer_name: companyName,
      currency_code: "INR",
      payment_amount: paymentAmount,
      description: selected.description,
      is_partial_payment: false,
      reference_id: `COMP-${companyId}-${Date.now()}`
    };

    console.log("📤 ZOHO PAYMENT PAYLOAD:", payload);

    /* ================= CREATE PAYMENT LINK ================= */
    let data;
    try {
      ({ data } = await client.post("/paymentlinks", payload));
    } catch (err) {
      if (err?.response?.status === 401) {
        console.warn("🔄 Zoho token expired — retrying payment link…");
        client = await zohoClient();
        ({ data } = await client.post("/paymentlinks", payload));
      } else {
        console.error("ZOHO PAYMENT ERROR:", err?.response?.data || err);
        throw err;
      }
    }

    const paymentUrl = data?.payment_link?.url;
    if (!paymentUrl) throw new Error("Zoho failed to return payment link");

    /* ================= UPDATE COMPANY ================= */
    await db.query(
      `
      UPDATE companies
      SET 
        plan = ?,
        subscription_status = 'pending',
        last_payment_link = ?
      WHERE id = ?
      `,
      [plan === "business" ? "business" : "trial", paymentUrl, companyId]
    );

    return res.json({
      success: true,
      message: "Payment link generated successfully",
      url: paymentUrl
    });

  } catch (err) {
    console.error("❌ PAYMENT ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err?.response?.data?.message ||
        err?.message ||
        "Payment initialization failed"
    });
  }
};
