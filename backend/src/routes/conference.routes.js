import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";

const router = express.Router();

/* ======================================================
   AUTH (COMPANY ADMIN)
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
        (SELECT COUNT(*) FROM conference_rooms WHERE company_id = ?) AS rooms,
        (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ?) AS totalBookings,
        (SELECT COUNT(*) 
           FROM conference_bookings 
          WHERE company_id = ?
            AND booking_date = CURDATE()
            AND status = 'BOOKED') AS todayBookings,
        (SELECT COUNT(*) 
           FROM conference_bookings 
          WHERE company_id = ?
            AND status = 'CANCELLED') AS cancelled
      `,
      [companyId, companyId, companyId, companyId]
    );

    res.json(stats);
  } catch (err) {
    console.error("[DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ======================================================
   CONFERENCE ROOMS
====================================================== */

/**
 * GET rooms
 */
router.get("/rooms", async (req, res) => {
  try {
    const { companyId } = req.user;

    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    console.error("[GET ROOMS]", err);
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/**
 * CREATE room
 */
router.post("/rooms", async (req, res) => {
  try {
    const { companyId } = req.user;
    const { room_name, room_number } = req.body;

    if (!room_name || !room_number || room_number <= 0) {
      return res.status(400).json({
        message: "Valid room name and room number are required"
      });
    }

    await db.query(
      `
      INSERT INTO conference_rooms (company_id, room_number, room_name)
      VALUES (?, ?, ?)
      `,
      [companyId, room_number, room_name.trim()]
    );

    res.status(201).json({ message: "Conference room created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Room number already exists for this company"
      });
    }

    console.error("[CREATE ROOM]", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

/* ======================================================
   BOOKINGS
====================================================== */

/**
 * GET bookings
 */
router.get("/bookings", async (req, res) => {
  try {
    const { companyId } = req.user;
    const { roomId, date } = req.query;

    let sql = `
      SELECT
        b.id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.purpose,
        b.status,
        b.booked_by,
        r.room_name,
        r.room_number
      FROM conference_bookings b
      JOIN conference_rooms r ON r.id = b.room_id
      WHERE b.company_id = ?
    `;

    const params = [companyId];

    if (roomId) {
      sql += " AND b.room_id = ?";
      params.push(Number(roomId));
    }

    if (date) {
      sql += " AND b.booking_date = ?";
      params.push(date);
    }

    sql += " ORDER BY b.booking_date DESC, b.start_time ASC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("[GET BOOKINGS]", err);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

/**
 * CREATE booking (ADMIN)
 */
router.post("/bookings", async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { companyId } = req.user;
    const {
      room_id,
      booked_by,
      purpose,
      booking_date,
      start_time,
      end_time
    } = req.body;

    if (!room_id || !booked_by || !booking_date || !start_time || !end_time) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await conn.beginTransaction();

    /* ---- Ensure room belongs to company ---- */
    const [[room]] = await conn.query(
      `
      SELECT id FROM conference_rooms
      WHERE id = ? AND company_id = ?
      `,
      [room_id, companyId]
    );

    if (!room) {
      await conn.rollback();
      return res.status(403).json({ message: "Invalid room selection" });
    }

    /* ---- Conflict check ---- */
    const [[conflict]] = await conn.query(
      `
      SELECT COUNT(*) AS cnt
      FROM conference_bookings
      WHERE room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND start_time < ?
        AND end_time > ?
      `,
      [room_id, booking_date, end_time, start_time]
    );

    if (conflict.cnt > 0) {
      await conn.rollback();
      return res.status(409).json({
        message: "Room already booked for this time slot"
      });
    }

    /* ---- Insert booking ---- */
    await conn.query(
      `
      INSERT INTO conference_bookings
      (company_id, room_id, booked_by, purpose, booking_date, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        room_id,
        booked_by,
        purpose || null,
        booking_date,
        start_time,
        end_time
      ]
    );

    await conn.commit();
    res.status(201).json({ message: "Booking created successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("[CREATE BOOKING]", err);
    res.status(500).json({ message: "Unable to create booking" });
  } finally {
    conn.release();
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

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Booking not found or already cancelled"
      });
    }

    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    console.error("[CANCEL BOOKING]", err);
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;
