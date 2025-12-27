import { zohoClient } from "./zohoClient.js";

export const findOrCreateCustomer = async (company) => {
  const existing = await zohoClient.get("/customers", {
    params: { email: company.email }
  });

  if (existing.data.customers?.length > 0)
    return existing.data.customers[0].customer_id;

  const res = await zohoClient.post("/customers", {
    display_name: company.companyName,
    company_name: company.companyName,
    email: company.email,
    phone: company.phone
  });

  return res.data.customer.customer_id;
};
