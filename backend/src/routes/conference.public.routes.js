import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */
const normalizeSlug = (v = "") => String(v).trim().toLowerCase();
const normalizeEmail = (v = "") => String(v).trim().toLowerCase();

const prettyTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

/* TEMPLATE FOOTER */
const emailFooter = `
<hr/>
<p style="font-size:13px;color:#666">
This email was sent automatically from the Conference Room Booking System.  
If you have any queries, please contact your organization administrator.
</p>
`;

/* ======================================================
   ALL EXISTING ROUTES ABOVE REMAIN SAME AS YOUR CODE
   Only below 3 routes updated
====================================================== */


/* ======================================================
   CREATE BOOKING — Detailed Email
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

    department = String(department || "").trim();
    const email = normalizeEmail(booked_by);

    if (!room_id || !email || !department || !booking_date || !start_time || !end_time)
      return res.status(400).json({ message: "Missing required fields" });

    if (end_time <= start_time)
      return res.status(400).json({ message: "End time must be after start time" });

    const [[company]] = await db.query(
      `SELECT id, name, logo_url FROM companies WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!company)
      return res.status(404).json({ message: "Invalid booking link" });

    /* OTP VERIFIED */
    const [[verified]] = await db.query(
      `SELECT id FROM public_booking_otp
       WHERE company_id=? AND email=? AND verified=1 AND expires_at>NOW()
       ORDER BY id DESC LIMIT 1`,
      [company.id, email]
    );

    if (!verified)
      return res.status(401).json({ message: "OTP verification required" });

    /* CONFLICT CHECK */
    const [conflict] = await db.query(
      `SELECT id FROM conference_bookings
       WHERE company_id=? AND room_id=? AND booking_date=? 
       AND status='BOOKED' 
       AND start_time < ? AND end_time > ?
       LIMIT 1`,
      [company.id, room_id, booking_date, end_time, start_time]
    );

    if (conflict.length)
      return res.status(409).json({ message: "Slot already booked" });

    /* GET ROOM INFO */
    const [[room]] = await db.query(
      `SELECT room_name, room_number FROM conference_rooms WHERE id=? LIMIT 1`,
      [room_id]
    );

    /* INSERT */
    await db.query(
      `INSERT INTO conference_bookings
       (company_id, room_id, booked_by, department, purpose,
        booking_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED')`,
      [company.id, room_id, email, department, purpose.trim(), booking_date, start_time, end_time]
    );

    /* EMAIL */
    await sendEmail({
      to: email,
      subject: `Booking Confirmed – ${room.room_name} | ${company.name}`,
      html: `
        <h2 style="color:#3c007a">${company.name}</h2>
        ${company.logo_url ? `<img src="${company.logo_url}" height="60" />` : ""}
        <h3>Conference Room Booking Confirmed</h3>

        <p>Your conference room has been successfully booked.</p>

        <table style="padding:10px;font-size:15px">
          <tr><td><b>Room</b></td><td>: ${room.room_name} ( #${room.room_number} )</td></tr>
          <tr><td><b>Date</b></td><td>: ${booking_date}</td></tr>
          <tr><td><b>Time</b></td>
              <td>: ${prettyTime(start_time)} – ${prettyTime(end_time)}</td></tr>
          <tr><td><b>Department</b></td><td>: ${department}</td></tr>
          <tr><td><b>Purpose</b></td><td>: ${purpose || "-"}</td></tr>
        </table>

        <p style="color:green;font-weight:bold">
          ✔ Please arrive on time and vacate the room after your session.
        </p>

        ${emailFooter}
      `
    });

    res.json({ message: "Booking confirmed successfully" });

  } catch (err) {
    console.error("[PUBLIC][BOOK]", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* ======================================================
   UPDATE BOOKING — Detailed Email
====================================================== */
router.patch("/company/:slug/bookings/:id", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const bookingId = Number(req.params.id);
    const { start_time, end_time, email } = req.body;

    if (!start_time || !end_time || !email)
      return res.status(400).json({ message: "Missing fields" });

    if (end_time <= start_time)
      return res.status(400).json({ message: "End time must be after start" });

    const normalizedEmail = normalizeEmail(email);

    const [[company]] = await db.query(
      `SELECT id,name,logo_url FROM companies WHERE slug=? LIMIT 1`,
      [slug]
    );

    if (!company)
      return res.status(404).json({ message: "Invalid link" });

    const [[booking]] = await db.query(
      `SELECT * FROM conference_bookings 
       WHERE id=? AND company_id=? AND status='BOOKED' LIMIT 1`,
      [bookingId, company.id]
    );

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    if (booking.booked_by !== normalizedEmail)
      return res.status(403).json({ message: "Unauthorized" });

    /* CONFLICT CHECK */
    const [conflict] = await db.query(
      `SELECT id FROM conference_bookings
       WHERE company_id=? AND room_id=? AND booking_date=?
       AND id<>? AND status='BOOKED'
       AND start_time < ? AND end_time > ?
       LIMIT 1`,
      [
        company.id,
        booking.room_id,
        booking.booking_date,
        bookingId,
        end_time,
        start_time
      ]
    );

    if (conflict.length)
      return res.status(409).json({ message: "Slot already booked" });

    await db.query(
      `UPDATE conference_bookings SET start_time=?, end_time=? WHERE id=?`,
      [start_time, end_time, bookingId]
    );

    /* ROOM INFO */
    const [[room]] = await db.query(
      `SELECT room_name, room_number FROM conference_rooms WHERE id=? LIMIT 1`,
      [booking.room_id]
    );

    await sendEmail({
      to: normalizedEmail,
      subject: `Booking Updated – ${room.room_name} | ${company.name}`,
      html: `
        <h2 style="color:#3c007a">${company.name}</h2>
        ${company.logo_url ? `<img src="${company.logo_url}" height="60" />` : ""}
        <h3>Conference Booking Time Updated</h3>

        <p>Your booking has been successfully rescheduled.</p>

        <table style="padding:10px;font-size:15px">
          <tr><td><b>Room</b></td><td>: ${room.room_name} ( #${room.room_number} )</td></tr>
          <tr><td><b>Date</b></td><td>: ${booking.booking_date}</td></tr>
          <tr><td><b>Previous Time</b></td>
              <td>: ${prettyTime(booking.start_time)} – ${prettyTime(booking.end_time)}</td></tr>
          <tr><td><b>New Time</b></td>
              <td style="color:#007bff">
              : ${prettyTime(start_time)} – ${prettyTime(end_time)}
              </td></tr>
          <tr><td><b>Department</b></td><td>: ${booking.department}</td></tr>
          <tr><td><b>Purpose</b></td><td>: ${booking.purpose || "-"}</td></tr>
        </table>

        <p style="color:#ff8c00;font-weight:bold">
          ⏰ Please note the updated timings.
        </p>

        ${emailFooter}
      `
    });

    res.json({ message: "Booking updated successfully" });

  } catch (err) {
    console.error("[PUBLIC][UPDATE BOOKING]", err);
    res.status(500).json({ message: "Server Error" });
  }
});


/* ======================================================
   CANCEL BOOKING — Detailed Email
====================================================== */
router.patch("/company/:slug/bookings/:id/cancel", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const bookingId = Number(req.params.id);
    const email = normalizeEmail(req.body?.email || "");

    const [[company]] = await db.query(
      `SELECT id,name,logo_url FROM companies WHERE slug=? LIMIT 1`,
      [slug]
    );

    if (!company)
      return res.status(404).json({ message: "Invalid link" });

    const [[booking]] = await db.query(
      `SELECT * FROM conference_bookings
       WHERE id=? AND company_id=? AND status='BOOKED' LIMIT 1`,
      [bookingId, company.id]
    );

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    if (booking.booked_by !== email)
      return res.status(403).json({ message: "Unauthorized" });

    await db.query(
      `UPDATE conference_bookings SET status='CANCELLED' WHERE id=?`,
      [bookingId]
    );

    const [[room]] = await db.query(
      `SELECT room_name, room_number FROM conference_rooms WHERE id=? LIMIT 1`,
      [booking.room_id]
    );

    await sendEmail({
      to: email,
      subject: `Booking Cancelled – ${room.room_name} | ${company.name}`,
      html: `
        <h2 style="color:#3c007a">${company.name}</h2>
        ${company.logo_url ? `<img src="${company.logo_url}" height="60" />` : ""}
        <h3>Conference Booking Cancelled</h3>

        <p>Your booking has been cancelled successfully.</p>

        <table style="padding:10px;font-size:15px">
          <tr><td><b>Room</b></td><td>: ${room.room_name} ( #${room.room_number} )</td></tr>
          <tr><td><b>Date</b></td><td>: ${booking.booking_date}</td></tr>
          <tr><td><b>Time</b></td>
              <td>: ${prettyTime(booking.start_time)} – ${prettyTime(booking.end_time)}</td></tr>
          <tr><td><b>Department</b></td><td>: ${booking.department}</td></tr>
        </table>

        <p style="color:red;font-weight:bold">
          ❌ This time slot is now free and available for others to book.
        </p>

        ${emailFooter}
      `
    });

    res.json({ message: "Booking cancelled successfully" });

  } catch (err) {
    console.error("[PUBLIC][CANCEL BOOKING]", err);
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
