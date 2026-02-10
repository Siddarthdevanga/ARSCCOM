import * as service from "../services/auth.service.js";

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
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    /* ---------- WHATSAPP URL VALIDATION (Optional) ---------- */
    if (whatsappUrl && whatsappUrl.trim()) {
      // Basic validation for WhatsApp URL format
      const whatsappPattern = /^https:\/\/(wa\.me|api\.whatsapp\.com)\/.+/i;
      if (!whatsappPattern.test(whatsappUrl.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid WhatsApp URL format. Must start with https://wa.me/ or https://api.whatsapp.com/",
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
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password?.trim();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
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
