import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */
const normalizeSlug = (v = "") => v.trim().toLowerCase();
const normalizeEmail = (v = "") => v.trim().toLowerCase();

/* ======================================================
   GET COMPANY BY SLUG (PUBLIC)
====================================================== */
router.get("/company/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    const [[company]] = await db.query(
      `SELECT id, name, logo_url FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    res.json(company);
  } catch (err) {
    console.error("[PUBLIC][GET COMPANY]", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   GET CONFERENCE ROOMS (PUBLIC)
====================================================== */
router.get("/company/:slug/rooms", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ?`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    const [rooms] = await db.query(
      `
      SELECT id, room_name, room_number
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [company.id]
    );

    res.json(rooms);
  } catch (err) {
    console.error("[PUBLIC][GET ROOMS]", err);
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/* ======================================================
   GET BOOKINGS (PUBLIC – FOR CALENDAR)
====================================================== */
router.get("/company/:slug/bookings", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const { roomId, date } = req.query;

    if (!roomId || !date) {
      return res.json([]);
    }

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ?`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    const [bookings] = await db.query(
      `
      SELECT
        id,
        room_id,
        booking_date,
        start_time,
        end_time,
        booked_by,
        purpose
      FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
      ORDER BY start_time ASC
      `,
      [company.id, roomId, date]
    );

    res.json(bookings);
  } catch (err) {
    console.error("[PUBLIC][GET BOOKINGS]", err);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

/* ======================================================
   SEND OTP (PUBLIC)
====================================================== */
router.post("/company/:slug/send-otp", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);

    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Valid email required" });
    }

    const [[company]] = await db.query(
      `SELECT id, name FROM companies WHERE slug = ?`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      `DELETE FROM public_booking_otp WHERE company_id = ? AND email = ?`,
      [company.id, email]
    );

    await db.query(
      `
      INSERT INTO public_booking_otp
      (company_id, email, otp, expires_at, verified)
      VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0)
      `,
      [company.id, email, otp]
    );

    await sendEmail({
      to: email,
      subject: `OTP for Conference Room Booking – ${company.name}`,
      html: `
        <h3>OTP Verification</h3>
        <p>Your OTP for booking at <b>${company.name}</b>:</p>
        <h2>${otp}</h2>
        <p>Valid for 10 minutes.</p>
      `
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("[PUBLIC][SEND OTP]", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ======================================================
   VERIFY OTP (PUBLIC)
====================================================== */
router.post("/company/:slug/verify-otp", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);
    const otp = req.body.otp?.trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP required" });
    }

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ?`,
      [slug]
    );

    const [[row]] = await db.query(
      `
      SELECT id
      FROM public_booking_otp
      WHERE company_id = ?
        AND email = ?
        AND otp = ?
        AND verified = 0
        AND expires_at > NOW()
      `,
      [company.id, email, otp]
    );

    if (!row) {
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }

    await db.query(
      `UPDATE public_booking_otp SET verified = 1 WHERE id = ?`,
      [row.id]
    );

    res.json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("[PUBLIC][VERIFY OTP]", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   CREATE CONFERENCE BOOKING (PUBLIC)
====================================================== */
router.post("/company/:slug/book", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const {
      room_id,
      booked_by,
      purpose = "",
      booking_date,
      start_time,
      end_time
    } = req.body;

    if (!room_id || !booked_by || !booking_date || !start_time || !end_time) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const email = normalizeEmail(booked_by);

    const [[company]] = await db.query(
      `SELECT id, name FROM companies WHERE slug = ?`,
      [slug]
    );

    /* OTP CHECK */
    const [[verified]] = await db.query(
      `
      SELECT id FROM public_booking_otp
      WHERE company_id = ?
        AND email = ?
        AND verified = 1
        AND expires_at > NOW()
      ORDER BY id DESC
      LIMIT 1
      `,
      [company.id, email]
    );

    if (!verified) {
      return res.status(401).json({
        message: "OTP verification required"
      });
    }

    /* OVERLAP CHECK */
    const [conflict] = await db.query(
      `
      SELECT id FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
      `,
      [company.id, room_id, booking_date, start_time, end_time]
    );

    if (conflict.length) {
      return res.status(409).json({ message: "Slot already booked" });
    }

    await db.query(
      `
      INSERT INTO conference_bookings
      (company_id, room_id, booked_by, purpose, booking_date, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company.id,
        room_id,
        email,
        purpose.trim(),
        booking_date,
        start_time,
        end_time
      ]
    );

    await sendEmail({
      to: email,
      subject: "Conference Room Booking Confirmed",
      html: `
        <h3>Booking Confirmed</h3>
        <p><b>Company:</b> ${company.name}</p>
        <p><b>Date:</b> ${booking_date}</p>
        <p><b>Time:</b> ${start_time} – ${end_time}</p>
        <p><b>Purpose:</b> ${purpose || "-"}</p>
      `
    });

    res.json({ message: "Booking confirmed successfully" });
  } catch (err) {
    console.error("[PUBLIC][CREATE BOOKING]", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
