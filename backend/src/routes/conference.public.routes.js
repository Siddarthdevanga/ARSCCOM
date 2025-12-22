import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */
const normalizeSlug = (v) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";

const normalizeEmail = (v) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";

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
    console.error("❌ Company fetch error:", err);
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

    /* ❗ Properly invalidate old OTPs */
    await db.query(
      `
      DELETE FROM public_booking_otp
      WHERE company_id = ? AND email = ?
      `,
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

    /* ✅ SEND OTP EMAIL */
    try {
      await sendEmail({
        to: email,
        subject: `OTP for Conference Booking – ${company.name}`,
        html: `
          <h3>OTP Verification</h3>
          <p>Your OTP for booking at <b>${company.name}</b>:</p>
          <h2>${otp}</h2>
          <p>This OTP is valid for <b>10 minutes</b>.</p>
        `
      });

      console.log("📧 OTP email sent to", email);
    } catch (mailErr) {
      console.error("❌ OTP email failed:", mailErr.message);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error("❌ Send OTP error:", err);
    res.status(500).json({ message: "Server error" });
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
    console.error("❌ Verify OTP error:", err);
    res.status(500).json({ message: "Server error" });
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

    /* 🔐 OTP CHECK */
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
        message: "OTP verification required before booking"
      });
    }

    /* ⛔ OVERLAP CHECK */
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

    /* ✅ CREATE BOOKING */
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
    console.error("❌ Booking error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
