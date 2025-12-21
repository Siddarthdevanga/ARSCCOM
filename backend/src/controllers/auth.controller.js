import * as service from "../services/auth.service.js";

/* ======================================================
   REGISTER
   POST /api/auth/register
====================================================== */
export const register = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Company logo is required"
      });
    }

    const result = await service.registerCompany(
      req.body,
      req.file
    );

    return res.status(201).json({
      message: "Company registered successfully",
      ...result
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);

    return res.status(400).json({
      message: err.message || "Registration failed"
    });
  }
};

/* ======================================================
   LOGIN
   POST /api/auth/login
====================================================== */
export const login = async (req, res) => {
  try {
    const result = await service.login(req.body);

    return res.status(200).json(result);

  } catch (err) {
    console.error("LOGIN ERROR:", err.message);

    return res.status(401).json({
      message: err.message || "Invalid email or password"
    });
  }
};

/* ======================================================
   FORGOT PASSWORD
   POST /api/auth/forgot-password
====================================================== */
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    // 🔐 Security: do NOT reveal whether email exists
    await service.forgotPassword(email);

    return res.status(200).json({
      message: "If the email exists, a reset code has been sent"
    });

  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err.message);

    return res.status(400).json({
      message: err.message || "Unable to process request"
    });
  }
};

/* ======================================================
   RESET PASSWORD
   POST /api/auth/reset-password
====================================================== */
export const resetPassword = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const code = req.body?.code?.trim();
    const password = req.body?.password?.trim();

    if (!email || !code || !password) {
      return res.status(400).json({
        message: "Email, code and new password are required"
      });
    }

    await service.resetPassword({
      email,
      code,
      password
    });

    return res.status(200).json({
      message: "Password updated successfully"
    });

  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err.message);

    return res.status(400).json({
      message: err.message || "Unable to reset password"
    });
  }
};
