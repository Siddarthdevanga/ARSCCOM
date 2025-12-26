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
    console.error("[ADMIN][DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
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

    res.json(Array.isArray(rooms) ? rooms : []);
  } catch (err) {
    console.error("[ADMIN][GET ROOMS]", err);
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/**
 * CREATE room (PLAN LIMITED)
 */
router.post("/rooms", async (req, res) => {
  try {
    const { companyId } = req.user;
    const { room_name, room_number } = req.body;

    if (!room_name || !room_number || Number(room_number) <= 0) {
      return res.status(400).json({
        message: "Room name and valid room number are required"
      });
    }

    const [[company]] = await db.query(
      `SELECT rooms FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [[count]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    if (count.cnt >= company.rooms) {
      return res.status(403).json({
        message: `Your plan allows only ${company.rooms} conference rooms`
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

    res.status(201).json({ message: "Conference room created successfully" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Room number already exists for this company"
      });
    }

    console.error("[ADMIN][CREATE ROOM]", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

/**
 * UPDATE (Rename / Renumber) ROOM
 */
router.put("/rooms/:id", async (req, res) => {
  try {
    const { companyId } = req.user;
    const roomId = Number(req.params.id);
    const { room_name, room_number } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    if (!room_name && !room_number) {
      return res.status(400).json({
        message: "Provide room_name or room_number to update"
      });
    }

    const [[room]] = await db.query(
      `
      SELECT id
      FROM conference_rooms
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [roomId, companyId]
    );

    if (!room) {
      return res
        .status(404)
        .json({ message: "Room not found or unauthorized" });
    }

    if (room_number) {
      const [[exists]] = await db.query(
        `
        SELECT id FROM conference_rooms
        WHERE company_id = ?
        AND room_number = ?
        AND id <> ?
        LIMIT 1
        `,
        [companyId, room_number, roomId]
      );

      if (exists) {
        return res.status(409).json({
          message: "Room number already exists for your company"
        });
      }
    }

    await db.query(
      `
      UPDATE conference_rooms
      SET 
        room_name = COALESCE(?, room_name),
        room_number = COALESCE(?, room_number)
      WHERE id = ? AND company_id = ?
      `,
      [room_name?.trim() || null, room_number || null, roomId, companyId]
    );

    res.json({ message: "Room updated successfully" });
  } catch (err) {
    console.error("[ADMIN][UPDATE ROOM]", err);
    res.status(500).json({ message: "Unable to update room" });
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
        b.room_id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.department,
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

    sql += " ORDER BY b.booking_date ASC, b.start_time ASC";

    const [rows] = await db.query(sql, params);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("[ADMIN][GET BOOKINGS]", err);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

/**
 * CREATE booking
 */
router.post("/bookings", async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { companyId } = req.user;
    const {
      room_id,
      booked_by,
      department,
      purpose = "",
      booking_date,
      start_time,
      end_time
    } = req.body;

    if (
      !room_id ||
      !booked_by ||
      !department ||
      !booking_date ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        message: "Room, department, date and time are required"
      });
    }

    if (end_time <= start_time) {
      return res.status(400).json({
        message: "End time must be after start time"
      });
    }

    await conn.beginTransaction();

    const [[room]] = await conn.query(
      `
      SELECT id
      FROM conference_rooms
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [room_id, companyId]
    );

    if (!room) {
      await conn.rollback();
      return res.status(403).json({
        message: "Invalid room selection"
      });
    }

    const [[conflict]] = await conn.query(
      `
      SELECT COUNT(*) AS cnt
      FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND start_time < ?
        AND end_time > ?
      `,
      [companyId, room_id, booking_date, end_time, start_time]
    );

    if (conflict.cnt > 0) {
      await conn.rollback();
      return res.status(409).json({
        message: "Room already booked for this time slot"
      });
    }

    await conn.query(
      `
      INSERT INTO conference_bookings
      (
        company_id,
        room_id,
        booked_by,
        department,
        purpose,
        booking_date,
        start_time,
        end_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        room_id,
        booked_by,
        department.trim(),
        purpose.trim(),
        booking_date,
        start_time,
        end_time
      ]
    );

    await conn.commit();

    res.status(201).json({
      message: "Booking created successfully"
    });
  } catch (err) {
    await conn.rollback();
    console.error("[ADMIN][CREATE BOOKING]", err);
    res.status(500).json({
      message: "Unable to create booking"
    });
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

    if (!bookingId) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

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
    console.error("[ADMIN][CANCEL BOOKING]", err);
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;
