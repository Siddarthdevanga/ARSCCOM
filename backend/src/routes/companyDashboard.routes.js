import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ================= DASHBOARD STATS ================= */
router.get("/dashboard", authMiddleware, async (req, res) => {
  const companyId = req.user.company_id;

  const [[rooms]] = await db.query(
    "SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?",
    [companyId]
  );

  const [[bookings]] = await db.query(
    "SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?",
    [companyId]
  );

  res.json({
    rooms: rooms.total,
    bookings: bookings.total
  });
});

export default router;
