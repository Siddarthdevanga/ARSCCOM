import jwt from "jsonwebtoken";

/**
 * JWT Authentication Middleware
 * - Validates Bearer token
 * - Attaches user context to req.user
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    /* ================= HEADER VALIDATION ================= */
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization header missing or malformed"
      });
    }

    /* ================= TOKEN EXTRACTION ================= */
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        message: "Token not provided"
      });
    }

    /* ================= TOKEN VERIFICATION ================= */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* ================= PAYLOAD VALIDATION ================= */
    if (!decoded?.userId || !decoded?.companyId) {
      return res.status(401).json({
        message: "Invalid token payload"
      });
    }

    /* ================= ATTACH USER CONTEXT ================= */
    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role || "user"
    };

    next();

  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);

    return res.status(401).json({
      message:
        error.name === "TokenExpiredError"
          ? "Token expired"
          : "Invalid or expired token"
    });
  }
};
