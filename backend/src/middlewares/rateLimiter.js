import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/* ======================================================
   SHARED HANDLER — consistent 429 response
====================================================== */
const handler = (_req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please wait and try again.",
  });
};

const keyByIp = (req) => ipKeyGenerator(req);
const keyByIpAndCompany = (req) =>
  `${ipKeyGenerator(req)}-${req.user?.companyId || req.user?.company_id || "anon"}`;

/* ======================================================
   AUTH ROUTES  — login, register, forgot-password
   Tight: brute-force protection
====================================================== */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   OTP SEND  — visitor public + conference public
   Prevents OTP flooding / SMS abuse
====================================================== */
export const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   OTP VERIFY  — prevent brute-forcing 6-digit OTP
====================================================== */
export const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 10,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   PUBLIC BOOKING  — conference public book endpoint
====================================================== */
export const publicBookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   PUBLIC VISITOR REGISTRATION
====================================================== */
export const publicVisitorLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   PAYMENT / UPGRADE  — prevent link spam to Zoho
====================================================== */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  keyGenerator: keyByIpAndCompany,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   ADMIN WRITE OPS  — visitor create, booking create
   Per company+IP to avoid one tenant flooding
====================================================== */
export const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  keyGenerator: keyByIpAndCompany,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   GENERAL API  — catch-all for authenticated routes
====================================================== */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
  keyGenerator: keyByIpAndCompany,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   SUPERADMIN  — extra tight, low volume expected
====================================================== */
export const superAdminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   EXPORTS / REPORTS  — heavy operations
====================================================== */
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  keyGenerator: keyByIpAndCompany,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   WEBHOOK  — Zoho payment/subscription callbacks
   High enough for bursts but limits flooding
====================================================== */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   WHATSAPP INBOUND  — Gupshup bot callbacks
   Higher volume expected (replies from users)
====================================================== */
export const whatsappInboundLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
  keyGenerator: keyByIp,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});
