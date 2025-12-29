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
   AUTH HEADERS
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
====================================================== */
async function zohoRequest(method, url, body = null) {
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
    if (err?.response?.status === 401) {
      console.warn("🔄 Zoho token expired — retrying …");

      return (
        await client.request({
          method,
          url,
          data: body,
          headers: await withAuth(),
        })
      ).data;
    }

    handleZohoError(err);
  }
}

/* ======================================================
   CUSTOMER
====================================================== */
export async function createCustomer(companyName, email, phone = "") {
  try {
    if (!companyName || !email)
      throw new Error("Company name & email are required");

    const data = await zohoRequest("post", "/customers", {
      display_name: companyName,
      company_name: companyName,
      email: email.toLowerCase(),
      phone,
    });

    return data?.customer?.customer_id || null;
  } catch (err) {
    handleZohoError(err);
  }
}

/* ======================================================
   TRIAL SUBSCRIPTION
====================================================== */
export async function createTrial(customerId) {
  try {
    if (!customerId)
      throw new Error("Customer ID is required for trial subscription");

    const planCode =
      process.env.ZOHO_PLAN_TRIAL_CODE ||
      process.env.ZOHO_TRIAL_PLAN_CODE;

    if (!planCode)
      throw new Error("Trial plan code is not configured");

    const data = await zohoRequest("post", "/subscriptions", {
      customer_id: customerId,
      plan: { plan_code: planCode },
    });

    return data?.subscription?.subscription_id || null;
  } catch (err) {
    handleZohoError(err);
  }
}

/* ======================================================
   PAYMENT LINK (Zoho Billing)
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
      payment_amount: numericAmount.toFixed(2),   // STRING ✔ required by Zoho Billing
      description
    };

    console.log("📤 Creating Zoho Payment Link:", payload);

    const data = await zohoRequest("post", "/paymentlinks", payload);

    return data?.payment_link?.url || null;
  } catch (err) {
    handleZohoError(err);
  }
}
