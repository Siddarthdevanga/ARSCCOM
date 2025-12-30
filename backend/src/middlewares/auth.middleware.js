import jwt from "jsonwebtoken";

/**
 * JWT Authentication Middleware
 * -----------------------------------------
 * - Accepts:
 *      Authorization: Bearer <token>
 *      Cookie: token=<jwt>
 *      Header: x-access-token (fallback)
 *
 * - Verifies signature
 * - Validates claims
 * - Attaches user context to req.user
 */
export const authenticate = (req, res, next) => {
  try {
    /* ================= ENV VALIDATION ================= */
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("❌ CRITICAL: JWT_SECRET missing in environment");
      return res.status(500).json({
        success: false,
        message: "Server authentication not configured"
      });
    }

    /* ================= TOKEN SOURCES ================= */
    let token = null;

    // Authorization Header
    const auth = req.headers?.authorization;
    if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
      token = auth.substring(7).trim();
    }

    // Cookie Support
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    // Fallback Support
    if (!token && req.headers["x-access-token"]) {
      token = req.headers["x-access-token"];
    }

    /* ================= TOKEN CHECK ================= */
    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({
        success: false,
        message: "Authentication token missing"
      });
    }

    /* ================= VERIFY TOKEN ================= */
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      console.warn("⚠️ Invalid JWT:", err?.message);

      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired — please login again"
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid authentication token"
      });
    }

    /* ================= CLAIM VALIDATION ================= */
    if (!decoded?.userId || !decoded?.companyId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication payload"
      });
    }

    /* ================= ATTACH USER CONTEXT ================= */
    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email ?? null,
      companyName: decoded.companyName ?? null,
      role: decoded.role ?? "user",
      issuedAt: decoded.iat || null,
      expiresAt: decoded.exp || null
    };

    return next();
  } catch (error) {
    console.error("❌ AUTH MIDDLEWARE ERROR:", error);

    return res.status(401).json({
      success: false,
      message: "Authentication failed"
    });
  }
};
