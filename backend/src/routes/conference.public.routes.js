import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */
const normalizeSlug = (slug) =>
  typeof slug === "string" ? slug.trim().toLowerCase() : "";

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

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
      `SELECT id, name, logo_url FROM companies WHERE slug = ? LIMIT 1`,
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
   SEND OTP (PUBLIC)
====================================================== */
router.post("/company/:slug/send-otp", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);

    if (!slug || !email || !email.includes("@")) {
      return res.status(400).json({ message: "Valid email required" });
    }

    const [[company]] = await db.query(
      `SELECT id, name FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // invalidate previous OTPs
    await db.query(
      `
      UPDATE public_booking_otp
      SET verified = 1
      WHERE company_id = ? AND email = ?
      `,
      [company.id, email]
    );

    // insert new OTP
    await db.query(
      `
      INSERT INTO public_booking_otp
      (company_id, email, otp, expires_at)
      VALUES (?, ?, ?, ?)
      `,
      [company.id, email, otp, expiresAt]
    );

    await sendEmail({
      to: email,
      subject: "Conference Booking OTP",
      html: `
        <h3>OTP Verification</h3>
        <p>Your OTP for booking at <b>${company.name}</b>:</p>
        <h2>${otp}</h2>
        <p>Valid for 10 minutes.</p>
      `
    });

    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error("❌ Send OTP error:", err);
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

    if (!slug || !email || !otp) {
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
      ORDER BY id DESC
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
    console.error("❌ Verify OTP error:", err);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

/* ======================================================
   CREATE BOOKING (PUBLIC)
====================================================== */
router.post("/company/:slug/book", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const { roomId, bookedBy, purpose = "", date, startTime, endTime } = req.body;

    if (!slug || !roomId || !bookedBy || !date || !startTime || !endTime) {
      return res.status(400).json({ message: "All fields required" });
    }

    const email = normalizeEmail(bookedBy);

    const [[company]] = await db.query(
      `SELECT id, name FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company) {
      return res.status(404).json({ message: "Invalid booking link" });
    }

    /* ===== OTP MUST BE VERIFIED ===== */
    const [[otpVerified]] = await db.query(
      `
      SELECT id
      FROM public_booking_otp
      WHERE company_id = ?
        AND email = ?
        AND verified = 1
        AND expires_at > NOW()
      ORDER BY id DESC
      LIMIT 1
      `,
      [company.id, email]
    );

    if (!otpVerified) {
      return res.status(401).json({
        message: "OTP verification required before booking"
      });
    }

    /* ===== OVERLAP CHECK ===== */
    const [conflicts] = await db.query(
      `
      SELECT id FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND status = 'BOOKED'
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
      `,
      [company.id, roomId, date, startTime, endTime]
    );

    if (conflicts.length) {
      return res.status(409).json({ message: "Slot already booked" });
    }

    /* ===== CREATE BOOKING ===== */
    await db.query(
      `
      INSERT INTO conference_bookings
      (company_id, room_id, booked_by, purpose, booking_date, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [company.id, roomId, email, purpose.trim(), date, startTime, endTime]
    );

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

    res.json({ message: "Booking confirmed successfully" });

  } catch (err) {
    console.error("❌ Public booking error:", err);
    res.status(500).json({ message: "Unable to create booking" });
  }
});

export default router;
