import axios from "axios";

let cachedToken = null;
let expiresAt = null;
let refreshingPromise = null; // prevents parallel refresh

/**
 * Returns Always:
 *  - valid Zoho OAuth Token
 *  - cached if still valid
 *  - auto-refresh otherwise
 */
export async function getZohoAccessToken() {
  try {
    const {
      ZOHO_ACCOUNTS_URL,
      ZOHO_REFRESH_TOKEN,
      ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET
    } = process.env;

    /* ======================================================
       VALIDATE ENV CONFIG
    ======================================================= */
    if (
      !ZOHO_ACCOUNTS_URL ||
      !ZOHO_REFRESH_TOKEN ||
      !ZOHO_CLIENT_ID ||
      !ZOHO_CLIENT_SECRET
    ) {
      throw new Error(
        "Zoho OAuth environment variables not configured properly"
      );
    }

    const now = Date.now();

    /* ======================================================
       RETURN CACHED TOKEN IF STILL VALID
    ======================================================= */
    if (cachedToken && expiresAt && now < expiresAt - 5000) {
      return cachedToken;
    }

    /* ======================================================
       PREVENT MULTIPLE SIMULTANEOUS REFRESH CALLS
    ======================================================= */
    if (refreshingPromise) {
      return refreshingPromise;
    }

    refreshingPromise = (async () => {
      const url = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

      const params = {
        refresh_token: ZOHO_REFRESH_TOKEN,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token"
      };

      console.log("🔄 Fetching new Zoho OAuth Token…");

      const { data } = await axios.post(url, null, {
        params,
        timeout: 12000
      });

      /* ---------- Validate Response ---------- */
      if (!data?.access_token) {
        console.error("❌ Zoho OAuth Failure:", data);
        throw new Error("Failed to obtain Zoho access token");
      }

      cachedToken = data.access_token;

      /* ---------- Expiry Logic ---------- */
      const ttlSeconds =
        Number(data.expires_in_sec) ||
        Number(data.expires_in) ||
        3600;

      // Apply safety buffer + enforce minimum validity
      const safeTTL = Math.max(ttlSeconds - 60, 300);

      expiresAt = Date.now() + safeTTL * 1000;

      console.log(
        `🔐 Zoho Access Token Generated (approx ${safeTTL}s validity)`
      );

      refreshingPromise = null;
      return cachedToken;
    })();

    return await refreshingPromise;

  } catch (err) {
    refreshingPromise = null;

    console.error(
      "❌ ZOHO TOKEN ERROR:",
      err?.response?.data || err?.message || err
    );

    throw new Error("Zoho Authentication Failed");
  }
}
