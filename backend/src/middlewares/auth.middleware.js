import jwt from "jsonwebtoken";

/**
 * JWT Authentication Middleware
 * - Validates Bearer token
 * - Verifies signature
 * - Ensures required claims exist
 * - Attaches user context to req.user
 */
export const authenticate = (req, res, next) => {
  try {
    /* ================= ENV SAFETY ================= */
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is missing in environment");
      return res.status(500).json({
        message: "Server authentication configuration error"
      });
    }

    const authHeader = req.headers.authorization;

    /* ================= HEADER VALIDATION ================= */
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization header missing or malformed"
      });
    }

    /* ================= TOKEN EXTRACTION ================= */
    const token = authHeader.split(" ")[1];

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        message: "Token not provided"
      });
    }

    /* ================= TOKEN VERIFICATION ================= */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* ================= VALIDATE CLAIMS ================= */
    if (!decoded?.userId || !decoded?.companyId) {
      return res.status(401).json({
        message: "Invalid authentication token"
      });
    }

    /* ================= ATTACH USER CONTEXT ================= */
    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email || null,
      companyName: decoded.companyName || null,
      role: decoded.role || "user"
    };

    // OPTIONAL (future): You can also pre-attach subscription info here
    // req.user.subscriptionStatus = decoded.subscriptionStatus || null;

    return next();

  } catch (error) {
    console.error("❌ AUTH ERROR:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired — please login again" });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    return res.status(401).json({
      message: "Authentication failed"
    });
  }
};
