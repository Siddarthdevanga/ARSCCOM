import axios from "axios";
import { getZohoAccessToken } from "./zohoToken.service.js";

const BASE = process.env.ZOHO_API_BASE;

/* ======================================================
   AUTH HEADER
====================================================== */
async function headers() {
  const token = await getZohoAccessToken();
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
  };
}

/* ======================================================
   CREATE CUSTOMER
====================================================== */
export async function createCustomer(company, email, phone) {
  const res = await axios.post(
    `${BASE}/customers`,
    {
      display_name: company,
      company_name: company,
      email,
      phone: phone || "",
    },
    { headers: await headers() }
  );

  return res.data.customer.customer_id;
}

/* ======================================================
   CREATE TRIAL SUBSCRIPTION
====================================================== */
export async function createTrial(customerId) {
  const res = await axios.post(
    `${BASE}/subscriptions`,
    {
      customer_id: customerId,
      plan: {
        plan_code: process.env.ZOHO_PLAN_TRIAL_CODE, // Must be "1"
      },
    },
    { headers: await headers() }
  );

  return res.data.subscription.subscription_id;
}

/* ======================================================
   BUSINESS SUBSCRIPTION (NOT READY)
====================================================== */
export async function createBusinessSubscription() {
  throw new Error(
    "Business subscription integration is not yet enabled. Please use Free Trial."
  );
}

/* ======================================================
   PAYMENT LINK (OPTIONAL FUTURE USE)
====================================================== */
export async function createPaymentLink(customerId, amount) {
  const res = await axios.post(
    `${BASE}/paymentlinks`,
    {
      customer_id: customerId,
      amount,
      description: "PROMEET Business Subscription",
    },
    { headers: await headers() }
  );

  return res.data.payment_link.url;
}
