import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";

const router = express.Router();

/* ======================================================
   ALL ROUTES REQUIRE AUTH (COMPANY ADMIN)
====================================================== */
router.use(authenticate);

/* ======================================================
   GET DASHBOARD STATS
   GET /api/conference/dashboard
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const { companyId } = req.user;

    const [[stats]] = await db.query(
      `
      SELECT
        (SELECT COUNT(*) FROM conference_rooms WHERE company_id = ?) AS rooms,
        (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ?) AS totalBookings,
        (SELECT COUNT(*) FROM conference_bookings
         WHERE company_id = ? AND DATE(date) = CURDATE()) AS todayBookings,
        (SELECT COUNT(*) FROM conference_bookings
         WHERE company_id = ? AND status = 'CANCELLED') AS cancelled
      `,
      [companyId, companyId, companyId, companyId]
    );

    res.json(stats);
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ======================================================
   CONFERENCE ROOMS
====================================================== */

/**
 * GET all rooms (company specific)
 */
router.get("/rooms", async (req, res) => {
  try {
    const { companyId } = req.user;

    const [rooms] = await db.query(
      `SELECT id, name FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/**
 * CREATE new room
 */
router.post("/rooms", async (req, res) => {
  try {
    const { companyId } = req.user;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Room name required" });
    }

    await db.query(
      `INSERT INTO conference_rooms (company_id, name)
       VALUES (?, ?)`,
      [companyId, name]
    );

    res.json({ message: "Conference room added" });
  } catch (err) {
    res.status(500).json({ message: "Unable to create room" });
  }
});

/* ======================================================
   BOOKINGS (ADMIN VIEW)
====================================================== */

/**
 * GET bookings for a room/date
 */
router.get("/bookings", async (req, res) => {
  try {
    const { companyId } = req.user;
    const { roomId, date } = req.query;

    const [bookings] = await db.query(
      `
      SELECT id, room_id, date, start_time, end_time, purpose, status
      FROM conference_bookings
      WHERE company_id = ?
        AND (? IS NULL OR room_id = ?)
        AND (? IS NULL OR date = ?)
      ORDER BY start_time
      `,
      [companyId, roomId, roomId, date, date]
    );

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

/**
 * CANCEL booking
 */
router.patch("/bookings/:id/cancel", async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    await db.query(
      `
      UPDATE conference_bookings
      SET status = 'CANCELLED'
      WHERE id = ? AND company_id = ?
      `,
      [id, companyId]
    );

    res.json({ message: "Booking cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;
