import * as service from "../services/auth.service.js";
import { generateToken } from "../utils/jwt.js";

export const register = async (req, res) => {
  try {
    const result = await service.registerCompany(req.body, req.file);
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

export const login = async (req, res) => {
  try {
    const user = await service.login(req.body);
    const token = await generateToken(user);
    res.json({ token });
  } catch (e) {
    res.status(401).json({ message: e.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    await service.sendResetLink(req.body.email);
    res.json({ message: "Reset link sent" });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};
