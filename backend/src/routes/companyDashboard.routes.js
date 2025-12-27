import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { subscriptionGuard } from "../middleware/subscriptionGuard.js";

const router = express.Router();

/* ================= PROTECT ALL ROUTES ================= */
// Must be in this order
router.use(authMiddleware, subscriptionGuard);

/* ================= DASHBOARD STATS ================= */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.company.id;   // 🔥 available because authMiddleware sets req.company

    const [[rooms]] = await db.query(
      "SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?",
      [companyId]
    );

    const [[bookings]] = await db.query(
      "SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?",
      [companyId]
    );

    const [[today]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM conference_bookings
      WHERE company_id = ?
      AND booking_date = CURDATE()
      `,
      [companyId]
    );

    res.json({
      rooms: rooms.total,
      totalBookings: bookings.total,
      todayBookings: today.total
    });
  } catch (err) {
    console.error("[CONF DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ================= GET ROOMS ================= */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = req.company.id;

    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [companyId]
    );

    res.json(rooms || []);
  } catch (err) {
    console.error("[CONF GET ROOMS]", err);
    res.status(500).json({ message: "Unable to load rooms" });
  }
});

/* ================= CREATE ROOM ================= */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.company.id;
    const { room_name, room_number } = req.body;

    if (!room_name || !room_number) {
      return res.status(400).json({
        message: "Room name and room number are required"
      });
    }

    await db.query(
      `
      INSERT INTO conference_rooms
      (company_id, room_number, room_name)
      VALUES (?, ?, ?)
      `,
      [companyId, room_number, room_name.trim()]
    );

    res.status(201).json({ message: "Room created successfully" });
  } catch (err) {
    console.error("[CONF CREATE ROOM]", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

/* ================= RENAME ROOM ================= */
router.put("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.company.id;
    const roomId = req.params.id;
    const { room_name } = req.body;

    if (!room_name || !room_name.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    const [result] = await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [room_name.trim(), roomId, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Room not found or not authorized"
      });
    }

    res.json({ message: "Room renamed successfully" });
  } catch (err) {
    console.error("[CONF RENAME ROOM]", err);
    res.status(500).json({ message: "Unable to rename room" });
  }
});

export default router;

