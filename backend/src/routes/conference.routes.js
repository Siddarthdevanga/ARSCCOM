import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   AUTH — COMPANY ADMIN ONLY
====================================================== */
router.use(authenticate);

/* ======================================================
   TIME UTILS
====================================================== */
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/* ======================================================
   EMAIL FOOTER
====================================================== */
const emailFooter = (company) => `
<br/>
Regards,<br/>
<b>${company?.name || "Conference Platform"}</b><br/>

${
  company?.logo_url
    ? `<img src="${company.logo_url}" height="65" style="margin:10px 0;display:block" />`
    : ""
}

<hr style="border:0;border-top:1px solid #ddd;margin:10px 0;" />

<p style="font-size:13px;color:#666">
This email was automatically sent from the PROMEET
Conference & Visitor Management Platform.<br/>
If this wasn’t you, please contact your administrator immediately.
</p>
`;

/* ======================================================
   AM/PM FORMATTER
====================================================== */
const toAmPm = (time) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = (h % 12) || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

/* ======================================================
   EMAIL SENDER
====================================================== */
const sendBookingMail = async ({ to, subject, heading, booking, company }) => {
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject,
      html: `
      <div style="font-family:Arial;padding:18px">
        
        <h2 style="color:#6c2bd9;margin-bottom:6px">
          ${heading}
        </h2>

        <p style="font-size:14px;color:#444;margin-top:0">
          Below are your meeting details:
        </p>

        <div style="
          background:#f7f7ff;
          border-radius:12px;
          border:1px solid #ddd;
          padding:16px;
          margin:12px 0">

          <p><b>Room:</b> ${booking.room_name}</p>
          <p><b>Date:</b> ${booking.booking_date}</p>
          <p><b>Time:</b> ${toAmPm(booking.start_time)} – ${toAmPm(booking.end_time)}</p>
          <p><b>Department:</b> ${booking.department}</p>
          ${booking.purpose ? `<p><b>Purpose:</b> ${booking.purpose}</p>` : ""}
        </div>

        <p style="font-size:13px;color:#444">
          Thank you for using PROMEET.
        </p>

        ${emailFooter(company)}
      </div>
      `
    });
  } catch (err) {
    console.log("❌ EMAIL FAILED:", err.message);
  }
};

/* ======================================================
   DASHBOARD
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
            AND status = 'BOOKED') AS todayBookings
      `,
      [companyId, companyId, companyId]
    );

    const [departments] = await db.query(
      `
      SELECT department, COUNT(*) AS total
      FROM conference_bookings
      WHERE company_id = ?
      GROUP BY department
      ORDER BY total DESC
      `,
      [companyId]
    );

    res.json({ ...stats, departments });
  } catch (err) {
    console.error("[ADMIN][DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
});

/* ======================================================
   ROOMS LIST
====================================================== */
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

/* ======================================================
   BOOKINGS LIST
====================================================== */
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

/* ======================================================
   CREATE BOOKING
====================================================== */
router.post("/bookings", async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { companyId, company } = req.user;
    const {
      room_id,
      booked_by,
      department,
      purpose = "",
      booking_date,
      start_time,
      end_time
    } = req.body;

    if (!room_id || !booked_by || !department || !booking_date || !start_time || !end_time) {
      return res.status(400).json({
        message: "Room, department, date and time are required"
      });
    }

    if (end_time <= start_time)
      return res.status(400).json({ message: "End time must be after start time" });

    await conn.beginTransaction();

    const [[room]] = await conn.query(
      `
      SELECT id, room_name
      FROM conference_rooms
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [room_id, companyId]
    );

    if (!room) {
      await conn.rollback();
      return res.status(403).json({ message: "Invalid room selection" });
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

    await sendBookingMail({
      to: booked_by?.includes("@") ? booked_by : null,
      subject: "Conference Room Booking Confirmed",
      heading: "Booking Confirmed",
      booking: {
        room_name: room.room_name,
        booking_date,
        start_time,
        end_time,
        department,
        purpose
      },
      company
    });

    res.status(201).json({ message: "Booking created successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("[ADMIN][CREATE BOOKING]", err);
    res.status(500).json({ message: "Unable to create booking" });
  } finally {
    conn.release();
  }
});

/* ======================================================
   EDIT BOOKING — REAL TIME VALIDATION
====================================================== */
router.patch("/bookings/:id", async (req, res) => {
  try {
    const { companyId, company } = req.user;
    const bookingId = Number(req.params.id);
    const { start_time, end_time } = req.body;

    if (!bookingId || !start_time || !end_time)
      return res.status(400).json({ message: "Start time and end time are required" });

    if (end_time <= start_time)
      return res.status(400).json({ message: "End must be after start" });

    const [[booking]] = await db.query(
      `
      SELECT b.*, r.room_name
      FROM conference_bookings b
      JOIN conference_rooms r ON r.id = b.room_id
      WHERE b.id = ? AND b.company_id = ?
      LIMIT 1
      `,
      [bookingId, companyId]
    );

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    // Prevent editing into past if booking is today
    const today = new Date().toISOString().slice(0, 10);
    if (booking.booking_date === today) {
      const now = nowTime();
      if (start_time <= now)
        return res.status(400).json({ message: "Cannot move booking into past time" });
    }

    const [[conflict]] = await db.query(
      `
      SELECT COUNT(*) AS cnt
      FROM conference_bookings
      WHERE company_id = ?
        AND room_id = ?
        AND booking_date = ?
        AND id <> ?
        AND status = 'BOOKED'
        AND start_time < ?
        AND end_time > ?
      `,
      [
        companyId,
        booking.room_id,
        booking.booking_date,
        bookingId,
        end_time,
        start_time
      ]
    );

    if (conflict.cnt > 0)
      return res.status(409).json({ message: "Slot already booked" });

    await db.query(
      `
      UPDATE conference_bookings
      SET start_time = ?, end_time = ?
      WHERE id = ? AND company_id = ?
      `,
      [start_time, end_time, bookingId, companyId]
    );

    await sendBookingMail({
      to: booking.booked_by?.includes("@") ? booking.booked_by : null,
      subject: "Conference Room Booking Rescheduled",
      heading: "Your Meeting Has Been Rescheduled",
      booking: {
        room_name: booking.room_name,
        booking_date: booking.booking_date,
        start_time,
        end_time,
        department: booking.department,
        purpose: booking.purpose
      },
      company
    });

    res.json({ message: "Booking updated successfully" });
  } catch (err) {
    console.error("[ADMIN][EDIT BOOKING]", err);
    res.status(500).json({ message: "Unable to update booking" });
  }
});

/* ======================================================
   CANCEL BOOKING
====================================================== */
router.patch("/bookings/:id/cancel", async (req, res) => {
  try {
    const { companyId, company } = req.user;
    const bookingId = Number(req.params.id);

    const [[booking]] = await db.query(
      `
      SELECT b.*, r.room_name
      FROM conference_bookings b
      JOIN conference_rooms r ON r.id = b.room_id
      WHERE b.id = ? AND b.company_id = ?
      LIMIT 1
      `,
      [bookingId, companyId]
    );

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    await db.query(
      `
      UPDATE conference_bookings
      SET status = 'CANCELLED'
      WHERE id = ? AND company_id = ?
      `,
      [bookingId, companyId]
    );

    await sendBookingMail({
      to: booking.booked_by?.includes("@") ? booking.booked_by : null,
      subject: "Conference Room Booking Cancelled",
      heading: "Your Meeting Has Been Cancelled",
      booking,
      company
    });

    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    console.error("[ADMIN][CANCEL BOOKING]", err);
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;
