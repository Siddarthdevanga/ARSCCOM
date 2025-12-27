import axios from "axios";

let cachedToken = null;
let tokenExpiry = null;

/**
 * Get Fresh Zoho OAuth Token Using Refresh Token
 */
export const getZohoAccessToken = async () => {
  const now = Date.now();

  // reuse token if valid
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  const url = `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const { data } = await axios.post(url, params);

  if (!data.access_token) {
    throw new Error("Failed to retrieve Zoho Access Token");
  }

  cachedToken = data.access_token;

  // expires in seconds → convert to ms
  tokenExpiry = now + (data.expires_in - 60) * 1000;

  return cachedToken;
};

/**
 * Helper Axios Client
 */
export const zohoClient = async () => {
  const token = await getZohoAccessToken();

  return axios.create({
    baseURL: process.env.ZOHO_API_BASE,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  });
};
