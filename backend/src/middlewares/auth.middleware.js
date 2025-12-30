import jwt from "jsonwebtoken";

/**
 * JWT Authentication Middleware
 * - Validates Bearer token or HttpOnly Cookie
 * - Verifies signature
 * - Ensures required claims exist
 * - Attaches user context to req.user
 */
export const authenticate = (req, res, next) => {
  try {
    /* ================= ENV SAFETY ================= */
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("❌ JWT_SECRET is missing in environment");
      return res.status(500).json({
        message: "Server authentication configuration error"
      });
    }

    /* ================= TOKEN SOURCE ================= */
    const authHeader = req.headers.authorization;
    let token = null;

    // Bearer Token Support
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // Optional Cookie Support (if you enable HttpOnly cookies later)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    /* ================= TOKEN VALIDATION ================= */
    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        message: "Authentication token missing"
      });
    }

    /* ================= VERIFY TOKEN ================= */
    const decoded = jwt.verify(token, secret);

    /* ================= CLAIM VALIDATION ================= */
    if (!decoded?.userId || !decoded?.companyId) {
      return res.status(401).json({
        message: "Invalid authentication token payload"
      });
    }

    /* ================= ATTACH USER CONTEXT ================= */
    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email ?? null,
      companyName: decoded.companyName ?? null,
      role: decoded.role ?? "user",
      issuedAt: decoded.iat,
      expiresAt: decoded.exp
    };

    return next();
  } catch (error) {
    console.error("❌ AUTH ERROR:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expired — please login again"
      });
    }

    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
      return res.status(401).json({
        message: "Invalid authentication token"
      });
    }

    return res.status(401).json({
      message: "Authentication failed"
    });
  }
};
