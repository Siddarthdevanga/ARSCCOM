import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoAuth.service.js";

export const createPayment = async (req, res) => {
  try {
    const { companyId, email, companyName } = req.user;
    const { plan } = req.body;

    // 🚫 Enterprise never hits billing
    if (plan === "enterprise") {
      return res.status(400).json({
        message: "Enterprise plan requires contacting sales"
      });
    }

    const client = await zohoClient();

    /* ================= CHECK / CREATE CUSTOMER ================= */
    const [[company]] = await db.query(
      "SELECT zoho_customer_id FROM companies WHERE id=?",
      [companyId]
    );

    let customerId = company?.zoho_customer_id;

    if (!customerId) {
      const { data } = await client.post("/customers", {
        display_name: companyName,
        company_name: companyName,
        email
      });

      customerId = data.customer.customer_id;

      await db.query(
        "UPDATE companies SET zoho_customer_id=? WHERE id=?",
        [customerId, companyId]
      );
    }

    /* ===================== TRIAL ====================== */
    if (plan === "free" || plan === "trial") {
      const { data } = await client.post("/subscriptions", {
        customer_id: customerId,
        plan: { plan_code: "1" } // TRIAL PLAN CODE
      });

      await db.query(
        `UPDATE companies 
         SET plan='trial',
             subscription_status='trial',
             zoho_subscription_id=? 
         WHERE id=?`,
        [data.subscription.subscription_id, companyId]
      );

      return res.json({
        message: "Trial Activated",
        redirect: "/conference/dashboard"
      });
    }

    /* ===================== BUSINESS (PAID) ===================== */
    const { data } = await client.post("/paymentlinks", {
      customer_id: customerId,
      amount: 500,
      currency_code: "INR",
      description: "Business Plan Subscription"
    });

    await db.query(
      `UPDATE companies 
       SET plan='business',
           subscription_status='pending'
       WHERE id=?`,
      [companyId]
    );

    res.json({ url: data.payment_link.url });
  } catch (err) {
    console.error("PAYMENT ERROR", err?.response?.data || err);
    res.status(500).json({ message: "Payment init failed" });
  }
};
