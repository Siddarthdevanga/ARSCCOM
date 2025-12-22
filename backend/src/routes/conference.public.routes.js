import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* ======================================================
   GET COMPANY BY SLUG (PUBLIC)
   GET /api/public/conference/company/:slug
====================================================== */
router.get("/company/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[company]] = await db.query(
      `SELECT id, name, logo_url
       FROM companies
       WHERE slug = ?`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(company);

  } catch (err) {
    console.error("Public company fetch error:", err);
    res.status(500).json({ message: "Failed to fetch company" });
  }
});

/* ======================================================
   GET ACTIVE ROOMS (PUBLIC)
   GET /api/public/conference/company/:slug/rooms
====================================================== */
router.get("/company/:slug/rooms", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ?`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [rooms] = await db.query(
      `SELECT id, name
       FROM conference_rooms
       WHERE company_id = ?
         AND is_active = 1
       ORDER BY name`,
      [company.id]
    );

    res.json(rooms);

  } catch (err) {
    console.error("Public rooms fetch error:", err);
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/* ======================================================
   GET BOOKINGS FOR A ROOM & DATE (PUBLIC)
   GET /api/public/conference/company/:slug/bookings
====================================================== */
router.get("/company/:slug/bookings", async (req, res) => {
  try {
    const { slug } = req.params;
    const { roomId, date } = req.query;

    if (!roomId || !date) {
      return res.status(400).json({
        message: "roomId and date are required"
      });
    }

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ?`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [bookings] = await db.query(
      `
      SELECT
        start_time,
        end_time,
        booked_by,
        purpose
      FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
      ORDER BY start_time
      `,
      [company.id, roomId, date]
    );

    res.json(bookings);

  } catch (err) {
    console.error("Public bookings fetch error:", err);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

/* ======================================================
   CREATE BOOKING (PUBLIC)
   POST /api/public/conference/company/:slug/book
====================================================== */
router.post("/company/:slug/book", async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      roomId,
      bookedBy,
      purpose,
      date,
      startTime,
      endTime
    } = req.body;

    /* ================= VALIDATION ================= */
    if (!roomId || !bookedBy || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ?`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    /* ================= OVERLAP CHECK ================= */
    const [conflicts] = await db.query(
      `
      SELECT id
      FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND NOT (
          end_time <= ?
          OR start_time >= ?
        )
      `,
      [company.id, roomId, date, startTime, endTime]
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        message: "Selected slot is already booked"
      });
    }

    /* ================= CREATE BOOKING ================= */
    await db.query(
      `
      INSERT INTO conference_bookings
      (company_id, room_id, booked_by, purpose, booking_date, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company.id,
        roomId,
        bookedBy,
        purpose || "",
        date,
        startTime,
        endTime
      ]
    );

    res.json({
      message: "Booking confirmed"
    });

  } catch (err) {
    console.error("Public booking error:", err);
    res.status(500).json({
      message: "Unable to create booking"
    });
  }
});

export default router;

