import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

console.log("REQUEST DEBUG >>>", {
  method: req.method,
  url: req.originalUrl,
  headers: req.headers["content-type"],
  body: req.body
});


/* ================= REQUIRED (Fixes Failed Rename) ================= */
router.use(express.json());

/* ================= AUTH ================= */
router.use(authMiddleware);

/* ================= DASHBOARD STATS ================= */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;

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
    const companyId = req.user.company_id;

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
    const companyId = req.user.company_id;
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
/* Supports PUT & PATCH */
router.put("/rooms/:id", renameRoom);
router.patch("/rooms/:id", renameRoom);

async function renameRoom(req, res) {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.params.id);
    const { room_name } = req.body;

    console.log("RENAME HIT", { roomId, body: req.body });

    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: "Invalid room id" });
    }

    if (!room_name || !room_name.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    const newName = room_name.trim();

    // Check room exists
    const [[room]] = await db.query(
      `
      SELECT id, room_name
      FROM conference_rooms
      WHERE id = ? AND company_id = ?
      `,
      [roomId, companyId]
    );

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // If same name
    if (room.room_name === newName) {
      return res.json({ message: "Room name unchanged", room });
    }

    // Update
    const [result] = await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [newName, roomId, companyId]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ message: "Rename failed" });
    }

    res.json({
      message: "Room renamed successfully",
      room: { id: roomId, room_name: newName }
    });

  } catch (err) {
    console.error("[CONF RENAME ROOM]", err);
    res.status(500).json({ message: err.message || "Unable to rename room" });
  }
}

export default router;
