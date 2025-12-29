import axios from "axios";
import { getZohoAccessToken } from "./zohoToken.service.js";

const BASE = process.env.ZOHO_API_BASE;

if (!BASE) {
  throw new Error("ZOHO_API_BASE is not configured");
}

/* ======================================================
   INTERNAL — AUTH HEADER
====================================================== */
async function authHeaders() {
  const token = await getZohoAccessToken();
  if (!token) throw new Error("Failed to obtain Zoho Access Token");

  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };
}

/* ======================================================
   HELPER — HANDLE ZOHO ERRORS
====================================================== */
function handleZohoError(err) {
  const apiError = err?.response?.data;

  const message =
    apiError?.message ||
    apiError?.error ||
    err?.message ||
    "Zoho API Request Failed";

  console.error("❌ ZOHO ERROR:", apiError || err);

  throw new Error(message);
}

/* ======================================================
   CREATE CUSTOMER
====================================================== */
export async function createCustomer(companyName, email, phone = "") {
  try {
    if (!companyName || !email) {
      throw new Error("Company name and email are required to create customer");
    }

    const { data } = await axios.post(
      `${BASE}/customers`,
      {
        display_name: companyName,
        company_name: companyName,
        email: email.toLowerCase(),
        phone,
      },
      { headers: await authHeaders() }
    );

    return data?.customer?.customer_id;
  } catch (err) {
    handleZohoError(err);
  }
}

/* ======================================================
   CREATE TRIAL SUBSCRIPTION
====================================================== */
export async function createTrial(customerId) {
  try {
    if (!customerId) {
      throw new Error("Customer ID is required for trial subscription");
    }

    const planCode =
      process.env.ZOHO_PLAN_TRIAL_CODE ||
      process.env.ZOHO_TRIAL_PLAN_CODE || // fallback if old env name
      "1";

    if (!planCode) {
      throw new Error("Trial plan code is not configured");
    }

    const { data } = await axios.post(
      `${BASE}/subscriptions`,
      {
        customer_id: customerId,
        plan: { plan_code: planCode },
      },
      { headers: await authHeaders() }
    );

    return data?.subscription?.subscription_id;
  } catch (err) {
    handleZohoError(err);
  }
}

/* ======================================================
   BUSINESS SUBSCRIPTION (FUTURE USE)
====================================================== */
export async function createBusinessSubscription() {
  throw new Error(
    "Business subscription billing flow is currently disabled. Please enable integration before using."
  );
}

/* ======================================================
   PAYMENT LINK — IF NEEDED IN FUTURE
====================================================== */
export async function createPaymentLink(customerId, amount) {
  try {
    if (!customerId) throw new Error("Customer ID required");
    if (!amount) throw new Error("Payment amount required");

    const { data } = await axios.post(
      `${BASE}/paymentlinks`,
      {
        customer_id: customerId,
        amount,
        currency_code: "INR",
        description: "PROMEET Subscription Payment",
      },
      { headers: await authHeaders() }
    );

    return data?.payment_link?.url;
  } catch (err) {
    handleZohoError(err);
  }
}
