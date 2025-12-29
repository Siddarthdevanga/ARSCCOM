import axios from "axios";

let cachedToken = null;
let expiresAt = null;

export async function getZohoAccessToken() {
  try {
    const {
      ZOHO_ACCOUNTS_URL,
      ZOHO_REFRESH_TOKEN,
      ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET
    } = process.env;

    if (!ZOHO_ACCOUNTS_URL || !ZOHO_REFRESH_TOKEN || !ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
      throw new Error("Zoho OAuth environment variables not configured properly");
    }

    const now = Date.now();

    // Use cached token if valid
    if (cachedToken && expiresAt && now < expiresAt) {
      return cachedToken;
    }

    const url = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

    const params = {
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token"
    };

    const { data } = await axios.post(url, null, {
      params,
      timeout: 8000
    });

    if (!data?.access_token) {
      console.error("❌ Zoho OAuth Failure:", data);
      throw new Error("Failed to obtain Zoho access token");
    }

    cachedToken = data.access_token;

    const ttlSeconds =
      Number(data.expires_in_sec) ||
      Number(data.expires_in) ||
      3600;

    // refresh slightly earlier than expiry
    expiresAt = now + (ttlSeconds - 60) * 1000;

    console.log("🔐 Zoho Access Token Generated");

    return cachedToken;

  } catch (err) {
    console.error("❌ ZOHO TOKEN ERROR:", err?.response?.data || err.message || err);
    throw new Error("Zoho Authentication Failed");
  }
}
