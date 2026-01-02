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

    if (
      !company_id ||
      !room_id ||
      !booked_by ||
      !booking_date ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ===============================
       1️⃣ CHECK FOR TIME CONFLICT
    =============================== */
    const [conflicts] = await db.query(
      `
      SELECT COUNT(*) AS conflict
      FROM conference_bookings
      WHERE room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND start_time < ?
        AND end_time > ?
      `,
      [room_id, booking_date, end_time, start_time]
    );

    if (conflicts[0].conflict > 0) {
      return res.status(409).json({
        message: "Conference room already booked for this time slot"
      });
    }

    /* ===============================
       2️⃣ INSERT BOOKING
    =============================== */
    await db.query(
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

    return res.status(201).json({
      message: "Conference room booked successfully"
    });
  } catch (error) {
    console.error("BOOKING ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
