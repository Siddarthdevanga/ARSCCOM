import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */
const normalizeSlug = (v = "") => String(v).trim().toLowerCase();
const normalizeEmail = (v = "") => String(v).trim().toLowerCase();

/* ======================================================
   GET COMPANY (PUBLIC)
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
    console.error("[PUBLIC][COMPANY]", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   GET ROOMS (PUBLIC)
====================================================== */
router.get("/company/:slug/rooms", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) return res.json([]);

    const [rooms] = await db.query(
      `
      SELECT id, room_name, room_number
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [company.id]
    );

    res.json(Array.isArray(rooms) ? rooms : []);
  } catch (err) {
    console.error("[PUBLIC][ROOMS]", err);
    res.json([]);
  }
});

/* ======================================================
   GET BOOKINGS (PUBLIC – CALENDAR)
====================================================== */
router.get("/company/:slug/bookings", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const { roomId, date } = req.query;

    if (!roomId || !date) return res.json([]);

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) return res.json([]);

    const [bookings] = await db.query(
      `
      SELECT
        id,
        room_id,
        booking_date,
        start_time,
        end_time,
        department,
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

    res.json(Array.isArray(bookings) ? bookings : []);
  } catch (err) {
    console.error("[PUBLIC][BOOKINGS]", err);
    res.json([]);
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
      `SELECT id, name FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

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
      subject: `OTP for Conference Booking – ${company.name}`,
      html: `
        <h3>OTP Verification</h3>
        <p>Your OTP for <b>${company.name}</b>:</p>
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
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP required" });
    }

    const [[company]] = await db.query(
      `SELECT id FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    const [[row]] = await db.query(
      `
      SELECT id
      FROM public_booking_otp
      WHERE company_id = ?
        AND email = ?
        AND otp = ?
        AND verified = 0
        AND expires_at > NOW()
      LIMIT 1
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
   CREATE BOOKING (PUBLIC – BULLETPROOF)
====================================================== */
router.post("/company/:slug/book", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    let {
      room_id,
      booked_by,
      department,
      purpose = "",
      booking_date,
      start_time,
      end_time
    } = req.body;

    /* 🔒 HARD SAFETY */
    department = String(department || "").trim();

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
        message: "End time must be greater than start time"
      });
    }

    const email = normalizeEmail(booked_by);

    const [[company]] = await db.query(
      `SELECT id, name FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    /* OTP VERIFIED */
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
      SELECT id
      FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND start_time < ?
        AND end_time > ?
      LIMIT 1
      `,
      [company.id, room_id, booking_date, end_time, start_time]
    );

    if (conflict.length) {
      return res.status(409).json({ message: "Slot already booked" });
    }

    /* INSERT */
    await db.query(
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
        end_time,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED')
      `,
      [
        company.id,
        room_id,
        email,
        department,
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
        <p><b>Department:</b> ${department}</p>
        <p><b>Date:</b> ${booking_date}</p>
        <p><b>Time:</b> ${start_time} – ${end_time}</p>
        <p><b>Purpose:</b> ${purpose || "-"}</p>
      `
    });

    res.json({ message: "Booking confirmed successfully" });
  } catch (err) {
    console.error("[PUBLIC][BOOKING]", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

