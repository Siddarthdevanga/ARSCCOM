import { db } from "../config/db.js";

export const zohoWebhook = async (req, res) => {
  const { event_type, data } = req.body;

  if (event_type === "subscription_activated") {
    const planCode = data.subscription.plan.plan_code;

    let plan = "trial";
    if (planCode === "BUSINESS_500") plan = "business";

    await db.query(
      `UPDATE companies
       SET plan=?,
           subscription_status='active',
           zoho_subscription_id=?
       WHERE zoho_customer_id=?`,
      [
        plan,
        data.subscription.subscription_id,
        data.subscription.customer_id
      ]
    );
  }

  res.send("OK");
};
