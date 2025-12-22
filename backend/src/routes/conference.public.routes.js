import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */
const normalizeSlug = (slug) => slug?.trim().toLowerCase();

/* ======================================================
   GET COMPANY BY SLUG (PUBLIC)
====================================================== */
router.get("/company/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    if (!slug) {
      return res.status(400).json({ message: "Invalid booking link" });
    }

    const [[company]] = await db.query(
      `SELECT id, name, logo_url
       FROM companies
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    res.json(company);
  } catch (err) {
    console.error("❌ Public company fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   GET ACTIVE ROOMS (PUBLIC)
====================================================== */
router.get("/company/:slug/rooms", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
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
    console.error("❌ Public rooms fetch error:", err);
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/* ======================================================
   GET BOOKINGS FOR ROOM + DATE (PUBLIC)
====================================================== */
router.get("/company/:slug/bookings", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const roomId = Number(req.query.roomId);
    const date = req.query.date?.trim();

    if (!roomId || !date) {
      return res.status(400).json({
        message: "roomId and date are required"
      });
    }

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    const [bookings] = await db.query(
      `SELECT start_time, end_time, booked_by, purpose
       FROM conference_bookings
       WHERE company_id = ?
         AND room_id = ?
         AND booking_date = ?
         AND status = 'BOOKED'
       ORDER BY start_time`,
      [company.id, roomId, date]
    );

    res.json(bookings);
  } catch (err) {
    console.error("❌ Public bookings fetch error:", err);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

/* ======================================================
   CREATE BOOKING (PUBLIC)
====================================================== */
router.post("/company/:slug/book", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const {
      roomId,
      bookedBy,
      purpose = "",
      date,
      startTime,
      endTime
    } = req.body;

    /* ================= VALIDATION ================= */
    if (!roomId || !bookedBy || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: "All required fields must be provided"
      });
    }

    const email = bookedBy.trim().toLowerCase();

    const [[company]] = await db.query(
      `SELECT id, name FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    /* ================= OVERLAP CHECK ================= */
    const [conflicts] = await db.query(
      `SELECT id
       FROM conference_bookings
       WHERE company_id = ?
         AND room_id = ?
         AND booking_date = ?
         AND status = 'BOOKED'
         AND NOT (
           end_time <= ?
           OR start_time >= ?
         )
       LIMIT 1`,
      [company.id, roomId, date, startTime, endTime]
    );

    if (conflicts.length) {
      return res.status(409).json({
        message: "Selected time slot is already booked"
      });
    }

    /* ================= CREATE BOOKING ================= */
    await db.query(
      `INSERT INTO conference_bookings
       (company_id, room_id, booked_by, purpose, booking_date, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        company.id,
        roomId,
        email,
        purpose.trim(),
        date,
        startTime,
        endTime
      ]
    );

    /* ================= CONFIRMATION EMAIL ================= */
    try {
      await sendEmail({
        to: email,
        subject: "Conference Room Booking Confirmed",
        html: `
          <h3>Booking Confirmed</h3>
          <p><b>Company:</b> ${company.name}</p>
          <p><b>Date:</b> ${date}</p>
          <p><b>Time:</b> ${startTime} – ${endTime}</p>
          <p><b>Purpose:</b> ${purpose || "-"}</p>
        `
      });
    } catch (mailErr) {
      console.error("⚠️ Booking email failed:", mailErr.message);
    }

    res.json({ message: "Booking confirmed successfully" });
  } catch (err) {
    console.error("❌ Public booking create error:", err);
    res.status(500).json({
      message: "Unable to create booking"
    });
  }
});

export default router;
