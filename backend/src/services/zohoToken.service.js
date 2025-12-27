import axios from "axios";
import { loadZohoSecrets } from "../config/secrets.js";

let token = null;
let expiry = 0;

export const getZohoAccessToken = async () => {
  if (token && Date.now() < expiry) return token;

  const S = await loadZohoSecrets();

  const res = await axios.post(
    process.env.ZOHO_ACCOUNTS_URL + "/oauth/v2/token",
    null,
    {
      params: {
        refresh_token: S.ZOHO_REFRESH_TOKEN,
        client_id: S.ZOHO_CLIENT_ID,
        client_secret: S.ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token"
      }
    }
  );

  token = res.data.access_token;
  expiry = Date.now() + res.data.expires_in * 1000 - 60000;

  return token;
};
