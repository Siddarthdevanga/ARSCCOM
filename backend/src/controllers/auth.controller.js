import * as service from "../services/auth.service.js";

const EMAIL_RE    = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_RE    = /^[6-9]\d{9}$/;
const IS_PROD     = process.env.NODE_ENV === "production";

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: "strict",
  path:     "/",
};

/* ======================================================
   REGISTER
   POST /api/auth/register
====================================================== */
export const register = async (req, res) => {
  try {
    /* ---------- FILE VALIDATION ---------- */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Company logo is required",
      });
    }

    /* ---------- FIELD VALIDATION ---------- */
    const {
      companyName,
      email,
      phone,
      conferenceRooms,
      password,
      whatsappUrl, // Optional field
    } = req.body;

    if (!companyName || !email || !phone || !conferenceRooms || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    /* ---------- BACKEND FIELD VALIDATION ---------- */
    if (!EMAIL_RE.test(email.trim().toLowerCase())) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const phoneDigits = String(phone).replace(/\D/g, "");
    const cleanPhone  = phoneDigits.startsWith("91") && phoneDigits.length === 12
      ? phoneDigits.slice(2)
      : phoneDigits;
    if (!PHONE_RE.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: "Enter a valid 10-digit Indian mobile number starting with 6-9" });
    }

    const rooms = Number(conferenceRooms);
    if (!Number.isInteger(rooms) || rooms < 1 || rooms > 100) {
      return res.status(400).json({ success: false, message: "Conference rooms must be a number between 1 and 100" });
    }

    const pwdStr = String(password);
    if (pwdStr.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }
    if (!/[A-Z]/.test(pwdStr) || !/[0-9]/.test(pwdStr) || !/[^A-Za-z0-9]/.test(pwdStr)) {
      return res.status(400).json({ success: false, message: "Password must contain uppercase, number and special character" });
    }

    const cName = String(companyName).trim();
    if (cName.length < 3) {
      return res.status(400).json({ success: false, message: "Company name must be at least 3 characters" });
    }
    if (/^\d+$/.test(cName)) {
      return res.status(400).json({ success: false, message: "Company name cannot be numbers only" });
    }

    /* ---------- WHATSAPP URL VALIDATION (Optional) ---------- */
    if (whatsappUrl && whatsappUrl.trim()) {
      // Basic validation for WhatsApp URL format
      const whatsappPattern = /^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com\/channel)\/.+/i;
      if (!whatsappPattern.test(whatsappUrl.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid WhatsApp URL. Accepted: https://wa.me/..., https://chat.whatsapp.com/... or https://whatsapp.com/channel/...",
        });
      }
    }

    /* ---------- REGISTER SERVICE ---------- */
    const result = await service.registerCompany(req.body, req.file);

    return res.status(201).json({
      success: true,
      message: "Company registered successfully. Proceed to subscription.",
      company: result.company,
      user: result.user,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);

    return res.status(err?.statusCode || 400).json({
      success: false,
      message: err?.message || "Registration failed",
    });
  }
};

/* ======================================================
   LOGIN
   POST /api/auth/login
====================================================== */
export const login = async (req, res) => {
  try {
    const email    = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const result = await service.login({ email, password });

    /**
     * result MUST contain:
     * token
     * user
     * company {
     *  id
     *  name
     *  slug
     *  logo_url
     *  whatsapp_url (optional)
     *  subscription_status   ---> MUST BE one of:
     *     active | trial | pending | expired | cancelled | none
     *  plan
     * }
     */

    if (!result?.company) {
      console.warn("⚠ LOGIN WARNING: No company attached to user:", email);
    }

    if (!result?.company?.slug) {
      console.warn("⚠ LOGIN WARNING: Company slug missing");
    }

    res.cookie("token", result.token, { ...COOKIE_OPTS, maxAge: 12 * 60 * 60 * 1000 });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      ...result,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err?.message);

    return res.status(401).json({
      success: false,
      message: err?.message || "Invalid email or password",
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
        success: false,
        message: "Email is required",
      });
    }

    // Security: Do not expose if email exists
    await service.forgotPassword(email);

    return res.status(200).json({
      success: true,
      message: "If the email exists, a reset code has been sent",
    });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err?.message);

    return res.status(400).json({
      success: false,
      message: err?.message || "Unable to process request",
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
        success: false,
        message: "Email, verification code, and password are required",
      });
    }

    await service.resetPassword({ email, code, password });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err?.message);

    return res.status(400).json({
      success: false,
      message: err?.message || "Unable to reset password",
    });
  }
};

/* ======================================================
   LOGOUT
   POST /api/auth/logout
====================================================== */
export const logout = (_req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};
