import axios from "axios";

export const getZohoToken = async () => {
  const url = `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`;

  const params = {
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token"
  };

  const { data } = await axios.post(url, null, { params });

  if (!data.access_token) throw new Error("Failed to fetch Zoho OAuth Token");

  return data.access_token;
};

export const zohoClient = async () => {
  const token = await getZohoToken();

  return axios.create({
    baseURL: process.env.ZOHO_API_BASE,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json"
    }
  });
};
