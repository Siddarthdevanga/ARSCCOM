import axios from "axios";
import { getZohoAccessToken } from "./zohoToken.service.js";

const BASE = process.env.ZOHO_API_BASE;

if (!BASE) {
  throw new Error("ZOHO_API_BASE is not configured");
}

/* ======================================================
   AXIOS INSTANCE
====================================================== */
const client = axios.create({
  baseURL: BASE,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});

/* ======================================================
   AUTH HANDLER + AUTO TOKEN REFRESH
====================================================== */
async function withAuth(headers = {}) {
  const token = await getZohoAccessToken();
  if (!token) throw new Error("Failed to obtain Zoho Access Token");

  return {
    ...headers,
    Authorization: `Zoho-oauthtoken ${token}`,
  };
}

/* ======================================================
   ERROR HANDLER
====================================================== */
function handleZohoError(err) {
  const apiError = err?.response?.data;

  console.error("❌ ZOHO ERROR:", apiError || err);

  throw new Error(
    apiError?.message ||
      apiError?.error ||
      err?.message ||
      "Zoho API Request Failed"
  );
}

/* ======================================================
   SAFE REQUEST WRAPPER
   - retries once if token expires
====================================================== */
async function zohoRequest(method, url, body = {}) {
  try {
    return (
      await client.request({
        method,
        url,
        data: body,
        headers: await withAuth(),
      })
    ).data;
  } catch (err) {
    // Retry once on invalid token
    if (err?.response?.status === 401) {
      console.warn("🔄 Retrying Zoho request after token refresh…");

      return (
        await client.request({
          method,
          url,
          data: body,
          headers: await withAuth(), // refresh happens inside
        })
      ).data;
    }

    handleZohoError(err);
  }
}

/* ======================================================
   CREATE CUSTOMER
====================================================== */
export async function createCustomer(companyName, email, phone = "") {
  try {
    if (!companyName || !email) {
      throw new Error("Company name and email are required");
    }

    const data = await zohoRequest("post", "/customers", {
      display_name: companyName,
      company_name: companyName,
      email: email.toLowerCase(),
      phone,
    });

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
    if (!customerId)
      throw new Error("Customer ID is required for trial subscription");

    const planCode =
      process.env.ZOHO_PLAN_TRIAL_CODE ||
      process.env.ZOHO_TRIAL_PLAN_CODE;

    if (!planCode) throw new Error("Trial plan code is not configured");

    const data = await zohoRequest("post", "/subscriptions", {
      customer_id: customerId,
      plan: { plan_code: planCode },
    });

    return data?.subscription?.subscription_id;
  } catch (err) {
    handleZohoError(err);
  }
}

/* ======================================================
   BUSINESS SUBSCRIPTION (DISABLED)
====================================================== */
export async function createBusinessSubscription() {
  throw new Error(
    "Business subscription billing flow is currently disabled. Enable integration before using."
  );
}

/* ======================================================
   PAYMENT LINK
   ⛔ IMPORTANT:
   Zoho Payment Links expects amount AS NUMBER
====================================================== */
export async function createPaymentLink(customerId, amount) {
  try {
    if (!customerId) throw new Error("Customer ID required");
    if (!amount) throw new Error("Payment amount required");

    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid payment amount");
    }

    const payload = {
      customer_id: customerId,
      amount: Number(numericAmount.toFixed(2)), // NUMBER (not string)
      currency_code: "INR",
      description: "PROMEET Subscription Payment",
      is_partial_payment: false,
    };

    console.log("📤 Creating Zoho Payment Link:", payload);

    const data = await zohoRequest("post", "/paymentlinks", payload);

    return data?.payment_link?.url;
  } catch (err) {
    handleZohoError(err);
  }
}
