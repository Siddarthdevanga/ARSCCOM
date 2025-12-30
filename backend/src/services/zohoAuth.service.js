import axios from "axios";

let cachedToken = null;
let tokenExpiry = null;
let refreshingToken = null; // prevents parallel refresh calls

/* ======================================================
   FETCH NEW TOKEN FROM ZOHO
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

    /* ---------- RETURN CACHED TOKEN IF VALID ---------- */
    if (
      cachedToken &&
      tokenExpiry &&
      Date.now() < tokenExpiry - 5000 // small buffer
    ) {
      return cachedToken;
    }

    /* ---------- PREVENT MULTIPLE REFRESH CALLS ---------- */
    if (refreshingToken) {
      return refreshingToken;
    }

    refreshingToken = (async () => {
      const url = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

      const params = {
        refresh_token: ZOHO_REFRESH_TOKEN,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token"
      };

      const { data } = await axios.post(url, null, { params, timeout: 10000 });

      if (!data?.access_token) {
        console.error("❌ Zoho OAuth Failed:", data);
        throw new Error("Failed to fetch Zoho OAuth Token");
      }

      cachedToken = data.access_token;

      const ttlSeconds =
        Number(data.expires_in_sec) ||
        Number(data.expires_in) ||
        3500; // fallback

      tokenExpiry = Date.now() + ttlSeconds * 1000;

      console.log("🔐 Zoho OAuth Token Fetched (valid for", ttlSeconds, "sec)");

      refreshingToken = null;
      return cachedToken;
    })();

    return await refreshingToken;

  } catch (err) {
    refreshingToken = null;
    console.error("❌ ZOHO TOKEN ERROR:", err?.response?.data || err.message);
    throw new Error("Zoho Authentication Failed");
  }
};

/* ======================================================
   AXIOS CLIENT WRAPPER
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
      if (error?.response?.status === 401) {
        console.warn("🔄 Zoho token expired — refreshing...");

        const newToken = await getZohoToken();

        error.config.headers.Authorization = `Zoho-oauthtoken ${newToken}`;

        return axios.request(error.config);
      }

      throw error;
    }
  );

  return client;
};
