import axios from "axios";
import { getZohoAccessToken } from "./zohoToken.service.js";

const BASE = process.env.ZOHO_API_BASE;

if (!BASE) {
  throw new Error("ZOHO_API_BASE is not configured");
}

/* ======================================================
   AXIOS CLIENT
====================================================== */
const client = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { "Content-Type": "application/json" }
});

/* ======================================================
   AUTH HEADER
====================================================== */
async function withAuth(extra = {}) {
  const token = await getZohoAccessToken();
  if (!token) throw new Error("Failed to obtain Zoho Access Token");

  return {
    ...extra,
    Authorization: `Zoho-oauthtoken ${token}`
  };
}

/* ======================================================
   STANDARDIZED ERROR HANDLER
====================================================== */
function handleZohoError(err) {
  const res = err?.response;
  const api = res?.data;

  console.error("❌ ZOHO API ERROR:", api || err?.message || err);

  const message =
    api?.message ||
    api?.error ||
    api?.errors?.[0]?.message ||
    res?.statusText ||
    err?.message ||
    "Zoho API Request Failed";

  const e = new Error(message);
  e.status = res?.status || 500;

  throw e;
}

/* ======================================================
   SAFE REQUEST (Handles Token Refresh Once)
====================================================== */
async function zohoRequest(method, url, body = null) {
  try {
    return (
      await client.request({
        method,
        url,
        data: body,
        headers: await withAuth()
      })
    ).data;

  } catch (err) {
    // Retry ONCE if token expired
    if (err?.response?.status === 401) {
      console.warn("🔄 Zoho token expired — refreshing & retrying...");

      try {
        return (
          await client.request({
            method,
            url,
            data: body,
            headers: await withAuth()
          })
        ).data;
      } catch (retryErr) {
        return handleZohoError(retryErr);
      }
    }

    return handleZohoError(err);
  }
}

/* ======================================================
   CREATE CUSTOMER
====================================================== */
export async function createCustomer(companyName, email, phone = "") {
  try {
    if (!companyName || !email)
      throw new Error("Company name & email are required");

    const payload = {
      display_name: companyName,
      company_name: companyName,
      email: email.toLowerCase(),
      phone: phone || undefined
    };

    console.log("🧾 Creating Zoho Customer…");

    const data = await zohoRequest("post", "/customers", payload);

    return data?.customer?.customer_id || null;

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

    if (!planCode)
      throw new Error("Trial plan code is not configured in env");

    console.log("🎟 Creating Zoho Trial Subscription…");

    const data = await zohoRequest("post", "/subscriptions", {
      customer_id: customerId,
      plan: { plan_code: planCode }
    });

    return {
      subscriptionId: data?.subscription?.subscription_id || null,
      status: data?.subscription?.status || null
    };

  } catch (err) {
    handleZohoError(err);
  }
}

/* ======================================================
   CREATE PAYMENT LINK
====================================================== */
export async function createPaymentLink(
  customerId,
  amount,
  customerName = "",
  description = "PROMEET Subscription Payment"
) {
  try {
    if (!customerId) throw new Error("Customer ID required");
    if (amount == null) throw new Error("Payment amount required");

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid payment amount");
    }

    const payload = {
      customer_id: customerId,
      customer_name: customerName || undefined,
      currency_code: "INR",
      amount: Number(numericAmount.toFixed(2)),
      description,
      is_partial_payment: false,
      reference_id: `PAY-${customerId}-${Date.now()}`
    };

    console.log("💳 Creating Zoho Payment Link…");

    const data = await zohoRequest("post", "/paymentlinks", payload);

    const link = data?.payment_link;

    return {
      url: link?.url || null,
      paymentLinkId: link?.payment_link_id || null,
      status: link?.status || null
    };

  } catch (err) {
    handleZohoError(err);
  }
}
