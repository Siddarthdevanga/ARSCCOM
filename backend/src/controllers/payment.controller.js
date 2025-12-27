import { db } from "../config/db.js";
import { zohoClient } from "../services/zohoClient.js";
import { findOrCreateCustomer } from "../services/zohoCustomer.service.js";

const PLAN_CODE = {
  trial: "TRIAL_15",
  business: "BUSINESS_500"
};

export const createPaymentLink = async (req, res) => {
  const { plan } = req.body;
  const company = req.company;

  if (!PLAN_CODE[plan])
    return res.status(400).json({ message: "Invalid Plan" });

  const customerId =
    company.zoho_customer_id ||
    await findOrCreateCustomer(company);

  await db.query(
    `UPDATE companies SET zoho_customer_id=? WHERE id=?`,
    [customerId, company.id]
  );

  const hosted = await zohoClient.post(
    "/hostedpages/newsubscription",
    {
      customer_id: customerId,
      plan: { plan_code: PLAN_CODE[plan] },
      redirect_url: "https://yourdomain.com/payment/success",
      cancel_url: "https://yourdomain.com/payment/failed"
    }
  );

  res.json({
    url: hosted.data.hostedpage.url
  });
};
