import jwt from "jsonwebtoken";
import { db } from "../config/db.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ===== HEADER CHECK =====
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Authorization header missing or malformed" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token not provided" });
    }

    // ===== VERIFY TOKEN =====
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.userId || !decoded?.companyId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // ===== LOAD COMPANY =====
    const [rows] = await db.query(
      "SELECT * FROM companies WHERE id = ? LIMIT 1",
      [decoded.companyId]
    );

    if (!rows?.length) {
      return res.status(401).json({ message: "Company not found" });
    }

    // ===== CONTEXT ATTACH =====
    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role || "user"
    };

    req.company = rows[0];

    return next();
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
