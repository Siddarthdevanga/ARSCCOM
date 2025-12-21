import jwt from "jsonwebtoken";

/**
 * JWT Authentication Middleware
 * - Validates Bearer token
 * - Attaches user context to req.user
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1️⃣ Validate header format
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization header missing or malformed"
      });
    }

    // 2️⃣ Extract token
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token not provided" });
    }

    // 3️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4️⃣ Validate required claims
    if (!decoded?.userId || !decoded?.companyId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // 5️⃣ Attach user context
    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role || "user" // optional, future-ready
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({
      message: err.name === "TokenExpiredError"
        ? "Token expired"
        : "Invalid or expired token"
    });
  }
};
