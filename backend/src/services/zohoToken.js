import axios from "axios";

let cachedToken = null;
let tokenExpiry = null;

export async function getZohoToken() {
  const now = Date.now();

  // reuse token if still valid
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  const url = `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token"
  });

  const { data } = await axios.post(url, params);

  if (!data.access_token) {
    throw new Error("Zoho token generation failed");
  }

  cachedToken = data.access_token;

  // expire 50 mins
  tokenExpiry = now + 50 * 60 * 1000;

  console.log("🔐 Zoho Access Token Generated");

  return cachedToken;
}
