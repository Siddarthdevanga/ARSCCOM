import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ================= AUTH ================= */
router.use(authMiddleware);

/* ================= DEBUG LOGGER (keeps sanity) ================= */
router.use((req, res, next) => {
  console.log("✔ Conference API:", req.method, req.originalUrl);
  next();
});

/* ======================================================
   DASHBOARD STATS
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [[rooms]] = await db.query(
      `SELECT COUNT(*) AS total 
       FROM conference_rooms 
       WHERE company_id = ?`,
      [companyId]
    );

    const [[bookings]] = await db.query(
      `SELECT COUNT(*) AS total 
       FROM conference_bookings 
       WHERE company_id = ?`,
      [companyId]
    );

    const [[today]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM conference_bookings
       WHERE company_id = ?
       AND booking_date = CURDATE()`,
      [companyId]
    );

    return res.json({
      rooms: rooms?.total || 0,
      totalBookings: bookings?.total || 0,
      todayBookings: today?.total || 0
    });

  } catch (err) {
    console.error("[CONF DASHBOARD ERROR]", err);
    return res.status(500).json({ message: "Failed to load dashboard" });
  }
});


/* ======================================================
   GET ROOMS
====================================================== */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name
       FROM conference_rooms
       WHERE company_id = ?
       ORDER BY room_number ASC`,
      [companyId]
    );

    return res.json(rooms || []);

  } catch (err) {
    console.error("[CONF GET ROOMS ERROR]", err);
    return res.status(500).json({ message: "Unable to load rooms" });
  }
});


/* ======================================================
   CREATE ROOM
====================================================== */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number } = req.body;

    if (!room_name?.trim() || !room_number) {
      return res.status(400).json({
        message: "Room name and room number are required"
      });
    }

    await db.query(
      `INSERT INTO conference_rooms
       (company_id, room_number, room_name)
       VALUES (?, ?, ?)`,
      [companyId, room_number, room_name.trim()]
    );

    return res.status(201).json({
      message: "Room created successfully"
    });

  } catch (err) {
    console.error("[CONF CREATE ROOM ERROR]", err);
    return res.status(500).json({ message: "Unable to create room" });
  }
});


/* ======================================================
   RENAME ROOM
====================================================== */
router.put("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.params.id);
    const { room_name } = req.body;

    console.log("🛠 Rename Attempt:", { roomId, room_name, companyId });

    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    if (!room_name?.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    const [result] = await db.query(
      `UPDATE conference_rooms
       SET room_name = ?
       WHERE id = ?
       AND company_id = ?`,
      [room_name.trim(), roomId, companyId]
    );

    if (!result.affectedRows) {
      console.log("❌ Room not found / wrong company / inactive");
      return res.status(404).json({
        message: "Room not found or not authorized"
      });
    }

    const [[updatedRoom]] = await db.query(
      `SELECT id, room_number, room_name
       FROM conference_rooms
       WHERE id = ?
       AND company_id = ?`,
      [roomId, companyId]
    );

    return res.json({
      message: "Room renamed successfully",
      room: updatedRoom
    });

  } catch (err) {
    console.error("[CONF RENAME ROOM ERROR]", err);
    return res.status(500).json({ message: "Unable to rename room" });
  }
});


export default router;
