import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";

const router = express.Router();

/* ======================================================
   ALL ROUTES REQUIRE AUTH (COMPANY ADMIN)
====================================================== */
router.use(authenticate);

/* ======================================================
   DASHBOARD STATS
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const { companyId } = req.user;

    const [[stats]] = await db.query(
      `
      SELECT
        (SELECT COUNT(*) FROM conference_rooms
         WHERE company_id = ? AND is_active = 1) AS rooms,

        (SELECT COUNT(*) FROM conference_bookings
         WHERE company_id = ?) AS totalBookings,

        (SELECT COUNT(*) FROM conference_bookings
         WHERE company_id = ?
           AND booking_date = CURDATE()
           AND status = 'BOOKED') AS todayBookings,

        (SELECT COUNT(*) FROM conference_bookings
         WHERE company_id = ?
           AND status = 'CANCELLED') AS cancelled
      `,
      [companyId, companyId, companyId, companyId]
    );

    res.json(stats || {
      rooms: 0,
      totalBookings: 0,
      todayBookings: 0,
      cancelled: 0
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ======================================================
   CONFERENCE ROOMS (ADMIN)
====================================================== */

/**
 * GET all active rooms
 */
router.get("/rooms", async (req, res) => {
  try {
    const { companyId } = req.user;

    const [rooms] = await db.query(
      `
      SELECT id, name
      FROM conference_rooms
      WHERE company_id = ?
        AND is_active = 1
      ORDER BY name ASC
      `,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    console.error("Rooms error:", err);
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/**
 * CREATE new room
 */
router.post("/rooms", async (req, res) => {
  try {
    const { companyId } = req.user;
    const name = req.body?.name?.trim();

    if (!name) {
      return res.status(400).json({ message: "Room name required" });
    }

    await db.query(
      `
      INSERT INTO conference_rooms (company_id, name)
      VALUES (?, ?)
      `,
      [companyId, name]
    );

    res.json({ message: "Conference room added" });
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

/* ======================================================
   BOOKINGS (ADMIN VIEW)
====================================================== */

/**
 * GET bookings (filterable)
 */
router.get("/bookings", async (req, res) => {
  try {
    const { companyId } = req.user;
    const roomId = req.query.roomId ? Number(req.query.roomId) : null;
    const date = req.query.date || null;

    let sql = `
      SELECT
        b.id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.purpose,
        b.status,
        r.name AS room_name,
        b.booked_by
      FROM conference_bookings b
      JOIN conference_rooms r ON r.id = b.room_id
      WHERE b.company_id = ?
    `;

    const params = [companyId];

    if (roomId) {
      sql += " AND b.room_id = ?";
      params.push(roomId);
    }

    if (date) {
      sql += " AND b.booking_date = ?";
      params.push(date);
    }

    sql += " ORDER BY b.booking_date DESC, b.start_time ASC";

    const [bookings] = await db.query(sql, params);

    res.json(bookings);
  } catch (err) {
    console.error("Bookings error:", err);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

/**
 * CANCEL booking
 */
router.patch("/bookings/:id/cancel", async (req, res) => {
  try {
    const { companyId } = req.user;
    const bookingId = Number(req.params.id);

    const [result] = await db.query(
      `
      UPDATE conference_bookings
      SET status = 'CANCELLED'
      WHERE id = ?
        AND company_id = ?
        AND status = 'BOOKED'
      `,
      [bookingId, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found or already cancelled" });
    }

    res.json({ message: "Booking cancelled" });
  } catch (err) {
    console.error("Cancel booking error:", err);
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;
