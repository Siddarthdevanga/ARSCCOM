import jwt from "jsonwebtoken";

/**
 * SuperAdmin Middleware
 * - Does NOT require companyId (superadmin has none)
 * - Requires role === 'superadmin' in JWT
 * - Completely separate from existing authenticate middleware
 */
export const authenticateSuperAdmin = (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "Server authentication not configured" });
    }

    /* ── TOKEN EXTRACTION (same sources as existing middleware) ── */
    let token = null;

    const auth = req.headers?.authorization;
    if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
      token = auth.substring(7).trim();
    }
    if (!token && req.cookies?.token) token = req.cookies.token;
    if (!token && req.headers["x-access-token"]) token = req.headers["x-access-token"];

    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({ success: false, message: "Authentication token missing" });
    }

    /* ── VERIFY ── */
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "Session expired — please login again" });
      }
      return res.status(401).json({ success: false, message: "Invalid authentication token" });
    }

    /* ── SUPERADMIN ROLE CHECK ──
       'superadmin_readonly' is a restricted sub-role (Landing Page
       Conversions view only) — allowed past this gate, but blocked from
       every other route by requireFullSuperAdmin below. */
    if (!decoded?.userId || !["superadmin", "superadmin_readonly"].includes(decoded?.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email ?? null,
      role: decoded.role,
      companyId: null,
    };

    return next();
  } catch (error) {
    console.error("❌ SUPERADMIN MIDDLEWARE ERROR:", error);
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }
};

/**
 * Gate for full-superadmin-only routes — everything except the read-only
 * Landing Page Conversions view. Must run after authenticateSuperAdmin.
 */
export const requireFullSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  return next();
};
