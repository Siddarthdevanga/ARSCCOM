import { db } from "../config/db.js";

/**
 * Create conference room booking
 */
export const createConferenceBooking = async (req, res) => {
  try {
    const {
      company_id,
      room_id,
      booked_by,
      purpose,
      booking_date,
      start_time,
      end_time
    } = req.body;

    /* ======================================================
       1️⃣ VALIDATION
    ====================================================== */
    if (
      !company_id ||
      !room_id ||
      !booked_by ||
      !booking_date ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    if (start_time >= end_time) {
      return res.status(400).json({
        message: "End time must be greater than start time"
      });
    }

    /* ======================================================
       2️⃣ Ensure Room belongs to company
    ====================================================== */
    const [[roomExists]] = await db.query(
      `
      SELECT id 
      FROM conference_rooms
      WHERE id = ?
      AND company_id = ?
      `,
      [room_id, company_id]
    );

    if (!roomExists) {
      return res.status(404).json({
        message: "Room not found or not authorized"
      });
    }

    /* ======================================================
       3️⃣ Prevent overlapping bookings
          Condition:
          A --- B overlaps C --- D if:
          A < D  AND  B > C
    ====================================================== */
    const [[{ conflict }]] = await db.query(
      `
      SELECT COUNT(*) AS conflict
      FROM conference_bookings
      WHERE room_id = ?
        AND company_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND start_time < ?
        AND end_time > ?
      `,
      [room_id, company_id, booking_date, end_time, start_time]
    );

    if (conflict > 0) {
      return res.status(409).json({
        message: "Conference room already booked for this time slot"
      });
    }

    /* ======================================================
       4️⃣ OPTIONAL: Prevent user double-booking same time
    ====================================================== */
    const [[{ selfConflict }]] = await db.query(
      `
      SELECT COUNT(*) AS selfConflict
      FROM conference_bookings
      WHERE booked_by = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND start_time < ?
        AND end_time > ?
      `,
      [booked_by, booking_date, end_time, start_time]
    );

    if (selfConflict > 0) {
      return res.status(409).json({
        message: "You already have a booking in this time slot"
      });
    }

    /* ======================================================
       5️⃣ INSERT BOOKING
    ====================================================== */
    const [insertResult] = await db.query(
      `
      INSERT INTO conference_bookings
      (company_id, room_id, booked_by, purpose, booking_date, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        room_id,
        booked_by,
        purpose || null,
        booking_date,
        start_time,
        end_time
      ]
    );

    /* Fetch inserted booking */
    const [[newBooking]] = await db.query(
      `
      SELECT id, company_id, room_id, booked_by, purpose,
             booking_date, start_time, end_time
      FROM conference_bookings
      WHERE id = ?
      `,
      [insertResult.insertId]
    );

    return res.status(201).json({
      message: "Conference room booked successfully",
      booking: newBooking
    });

  } catch (error) {
    console.error("BOOKING ERROR:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};
