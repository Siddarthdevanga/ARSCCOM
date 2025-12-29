import axios from "axios";

let cachedToken = null;
let tokenExpiry = null;

/* ======================================================
   FETCH NEW TOKEN
====================================================== */
export const getZohoToken = async () => {
  try {
    const {
      ZOHO_ACCOUNTS_URL,
      ZOHO_REFRESH_TOKEN,
      ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET
    } = process.env;

    if (!ZOHO_ACCOUNTS_URL || !ZOHO_REFRESH_TOKEN || !ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
      throw new Error("Zoho OAuth environment variables missing");
    }

    /** If token is cached & valid → reuse */
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
      return cachedToken;
    }

    const url = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

    const params = {
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token"
    };

    const { data } = await axios.post(url, null, { params, timeout: 8000 });

    if (!data?.access_token) {
      console.error("❌ Zoho OAuth Failed:", data);
      throw new Error("Failed to fetch Zoho OAuth Token");
    }

    cachedToken = data.access_token;

    // Zoho usually returns expires_in_sec
    const ttl = Number(data.expires_in_sec || 3500) * 1000;
    tokenExpiry = Date.now() + ttl;

    console.log("🔐 Zoho OAuth Token Fetched");

    return cachedToken;

  } catch (err) {
    console.error("❌ ZOHO TOKEN ERROR:", err?.response?.data || err.message);
    throw new Error("Zoho Authentication Failed");
  }
};

/* ======================================================
   AXIOS CLIENT WRAPPER
====================================================== */
export const zohoClient = async () => {
  const token = await getZohoToken();

  if (!process.env.ZOHO_API_BASE) {
    throw new Error("ZOHO_API_BASE not configured");
  }

  return axios.create({
    baseURL: process.env.ZOHO_API_BASE,
    timeout: 12000,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json"
    }
  });
};
