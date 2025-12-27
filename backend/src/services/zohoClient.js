import axios from "axios";
import { getZohoAccessToken } from "./zohoToken.service.js";
import { loadZohoSecrets } from "../config/secrets.js";

export const zohoClient = axios.create();

zohoClient.interceptors.request.use(async (config) => {
  const token = await getZohoAccessToken();
  const S = await loadZohoSecrets();

  config.baseURL = process.env.ZOHO_API_BASE;
  config.headers.Authorization = `Zoho-oauthtoken ${token}`;
  config.headers["X-com-zoho-subscriptions-organizationid"] =
    S.ZOHO_ORG_ID;

  return config;
});
