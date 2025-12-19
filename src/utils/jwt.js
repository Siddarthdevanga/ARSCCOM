import jwt from "jsonwebtoken";
import { loadSecrets } from "../config/secrets.js";

export const generateToken = async (user) => {
  const s = await loadSecrets();

  return jwt.sign(
    { user_id: user.id, company_id: user.company_id },
    s.JWT_SECRET,
    { expiresIn: "1d" }
  );
};
