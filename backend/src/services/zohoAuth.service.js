import axios from "axios";

let cachedToken = null;
let tokenExpiry = null;
let refreshingPromise = null; // prevents multiple refresh attempts

/* ======================================================
   FETCH NEW TOKEN FROM ZOHO
====================================================== */
export const getZohoToken = async () => {
  const {
    ZOHO_ACCOUNTS_URL,
    ZOHO_REFRESH_TOKEN,
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET
  } = process.env;

  if (
    !ZOHO_ACCOUNTS_URL ||
    !ZOHO_REFRESH_TOKEN ||
    !ZOHO_CLIENT_ID ||
    !ZOHO_CLIENT_SECRET
  ) {
    throw new Error("Zoho OAuth environment variables missing");
  }

  /**
   * Return cached token if valid
   */
  if (
    cachedToken &&
    tokenExpiry &&
    Date.now() < tokenExpiry - 5000 // 5s buffer
  ) {
    return cachedToken;
  }

  /**
   * If another request is already refreshing → wait for it
   */
  if (refreshingPromise) {
    return refreshingPromise;
  }

  /**
   * Refresh token
   */
  refreshingPromise = (async () => {
    try {
      const url = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

      const params = {
        refresh_token: ZOHO_REFRESH_TOKEN,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token"
      };

      const { data } = await axios.post(url, null, {
        params,
        timeout: 10000
      });

      if (!data?.access_token) {
        console.error("❌ Zoho OAuth Response:", data);
        throw new Error("Failed to obtain Zoho OAuth Token");
      }

      cachedToken = data.access_token;

      /**
       * Fallback hierarchy:
       * expires_in_sec > expires_in > 3500
       */
      const ttlSeconds =
        Number(data.expires_in_sec) ||
        Number(data.expires_in) ||
        3500;

      tokenExpiry = Date.now() + ttlSeconds * 1000;

      console.log(
        `🔐 Zoho OAuth Token refreshed — valid for ${ttlSeconds}s`
      );

      refreshingPromise = null;
      return cachedToken;
    } catch (err) {
      refreshingPromise = null;

      console.error(
        "❌ ZOHO TOKEN ERROR:",
        err?.response?.data || err.message
      );

      // prevent infinite retry loop by clearing cache
      cachedToken = null;
      tokenExpiry = null;

      throw new Error("Zoho Authentication Failed");
    }
  })();

  return refreshingPromise;
};

/* ======================================================
   ZOHO AXIOS CLIENT
====================================================== */
export const zohoClient = async () => {
  const token = await getZohoToken();

  const base = process.env.ZOHO_API_BASE;
  if (!base) throw new Error("ZOHO_API_BASE not configured");

  const client = axios.create({
    baseURL: base,
    timeout: 15000,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json"
    }
  });

  /* ======================================================
     AUTO REFRESH TOKEN ON 401
  ======================================================= */
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;

      // Prevent infinite retry loop
      if (originalRequest._retry) {
        throw error;
      }

      if (error?.response?.status === 401) {
        console.warn("🔄 Zoho token expired — refreshing…");

        originalRequest._retry = true;

        const newToken = await getZohoToken();
        originalRequest.headers.Authorization = `Zoho-oauthtoken ${newToken}`;

        return axios.request(originalRequest);
      }

      throw error;
    }
  );

  return client;
};
