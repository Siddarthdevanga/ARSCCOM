import jwt from "jsonwebtoken";
import { loadSecrets } from "../config/secrets.js";

export const generateToken = async (user) => {
  const s = await loadSecrets();

  return jwt.sign(
    { userId: user.id, companyId: user.company_id },
    s.JWT_SECRET,
    { expiresIn: "12h" }
  );
};
