import * as service from "../services/auth.service.js";
import { updateRazorpayCustomerName } from "../services/razorpayTrialSubscription.service.js";

const EMAIL_RE    = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_RE    = /^[6-9]\d{9}$/;
const IS_PROD     = process.env.NODE_ENV === "production";

// No explicit `domain` meant this cookie was host-only — scoped to whichever
// exact hostname served the login response (www.promeet.zodopt.com). Anyone
// who ended up on the bare apex domain (promeet.zodopt.com, no www — typed
// directly, bookmarked, or shared without www) got a page that loaded fine
// but could never carry an auth cookie there, since one was never set for
// that host.
//
// Derived from the actual request host rather than gated on NODE_ENV — a
// static production flag is one more thing that can be misconfigured
// (wrong value, not set, deploy-specific env drift) and silently disables
// this fix with no visible error. Reading req.hostname means it's correct
// regardless of how NODE_ENV is set on any given deploy.
const cookieDomainFor = (req) => {
  const host = (req.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return undefined;
  // Strip a leading "www." to get the registrable domain — RFC 6265: a
  // Domain attribute always covers the domain itself and all subdomains,
  // so this one value covers both www.promeet.zodopt.com and the bare apex.
  return host.replace(/^www\./, "");
};

const cookieOptsFor = (req) => ({
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: "strict",
  path:     "/",
  domain:   cookieDomainFor(req),
});

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
      password,
      whatsappUrl, // Optional field
    } = req.body;

    if (!companyName || !email || !phone || !password) {
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

    res.cookie("token", result.token, { ...cookieOptsFor(req), maxAge: 12 * 60 * 60 * 1000 });

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
      code: err?.code || undefined,
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
    // identifier can be an email or a 10-digit phone number — the Razorpay
    // payment-link flow issues temp passwords a person may check via either
    // channel, so login needs to accept whichever they have on hand.
    const identifier = (req.body?.identifier ?? req.body?.email ?? "").trim().toLowerCase();
    const password    = req.body?.password;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Email or phone number, and password, are required" });
    }
    if (!EMAIL_RE.test(identifier) && !PHONE_RE.test(identifier)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address or 10-digit phone number" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const result = await service.login({ identifier, password });

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
     *  registration_source (web | razorpay)
     *  registration_complete (bool)
     * }
     */

    if (!result?.company) {
      console.warn("⚠ LOGIN WARNING: No company attached to user:", identifier);
    }

    if (!result?.company?.slug) {
      console.warn("⚠ LOGIN WARNING: Company slug missing");
    }

    res.cookie("token", result.token, { ...cookieOptsFor(req), maxAge: 12 * 60 * 60 * 1000 });

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
   COMPLETE REGISTRATION
   POST /api/auth/complete-registration
   --------------------------------------------------------
   Protected route (authenticate middleware) — for companies that
   started via the Razorpay payment-link flow and still need to set
   a real password, company name, logo and WhatsApp URL.
====================================================== */
export const completeRegistration = async (req, res) => {
  try {
    const { companyName, password, whatsappUrl } = req.body || {};

    if (whatsappUrl && whatsappUrl.trim()) {
      const whatsappPattern = /^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com\/channel)\/.+/i;
      if (!whatsappPattern.test(whatsappUrl.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid WhatsApp URL. Accepted: https://wa.me/..., https://chat.whatsapp.com/... or https://whatsapp.com/channel/...",
        });
      }
    }

    const result = await service.completeRegistration(
      {
        companyId: req.user.companyId,
        userId: req.user.userId,
        companyName,
        password,
        whatsappUrl,
      },
      req.file
    );

    // Best-effort — keeps Razorpay's own Customer record showing the real
    // company name instead of whatever placeholder it was created with at
    // trial signup. Never blocks the response; a company with no
    // razorpay_customer_id on file is a silent no-op.
    updateRazorpayCustomerName(result.company.id, result.company.name).catch((err) =>
      console.error("[COMPLETE REGISTRATION] Razorpay customer name update failed:", err.message)
    );

    return res.status(200).json({
      success: true,
      message: "Registration completed",
      company: result.company,
    });
  } catch (err) {
    console.error("COMPLETE REGISTRATION ERROR:", err);

    return res.status(err?.statusCode || 400).json({
      success: false,
      message: err?.message || "Failed to complete registration",
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
export const logout = (req, res) => {
  res.clearCookie("token", cookieOptsFor(req));
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};
