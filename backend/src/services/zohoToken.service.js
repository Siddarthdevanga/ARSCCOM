import axios from "axios";

let cachedToken = null;
let expiresAt = null;

export async function getZohoAccessToken() {
  const now = Date.now();

  if (cachedToken && expiresAt && now < expiresAt) {
    return cachedToken;
  }

  const url = `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

  const params = {
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token"
  };

  const { data } = await axios.post(url, null, { params });

  cachedToken = data.access_token;
  expiresAt = now + (data.expires_in - 60) * 1000;

  return cachedToken;
}
