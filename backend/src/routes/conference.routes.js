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

/*
  STRICT AM/PM ONLY
*/
const normalizeTime = (t) => {
  if (!t) throw new Error("Time is required");

  let s = String(t).trim().toUpperCase();

  const match = s.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);
  if (!match)
    throw new Error("Only 12-hour format allowed (example: 11:30 AM)");

  let [_, hh, mm, ampm] = match;
  let h = Number(hh);
  let m = Number(mm);

  if (h < 1 || h > 12) throw new Error("Invalid hour");
  if (m < 0 || m > 59) throw new Error("Invalid minutes");

  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/* ======================================================
   AM/PM FOR MAILS
====================================================== */
const toAmPm = (time) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = (h % 12) || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

/* ======================================================
   REQUIRED FOOTER ✔️
====================================================== */
const emailFooter = company => `
<br/>
Regards,<br/>
<b>${company.name}</b><br/>
${company.logo_url ? `<img src="${company.logo_url}" height="55" />` : ""}
<hr/>
<p style="font-size:13px;color:#666">
This email was automatically sent from the Conference Room Booking Platform.
If you did not perform this action, please contact your administrator immediately.
</p>
`;

/* ======================================================
   EMAIL VALIDATION
====================================================== */
const isEmail = (v = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* ======================================================
   SEND EMAIL TO ADMIN + USER
====================================================== */
const sendBookingMail = async ({ adminEmail, userEmail, subject, heading, booking, company }) => {
  const recipients = [];

  if (isEmail(adminEmail)) recipients.push(adminEmail);
  if (isEmail(userEmail) && userEmail !== adminEmail) recipients.push(userEmail);

  if (!recipients.length) {
    console.log("🚫 No valid recipients — skipping email");
    return;
  }

  const safeCompany = company || { name: "", logo_url: "" };

  try {
    await sendEmail({
      to: recipients,
      subject,
      html: `
      <div style="font-family:Arial;padding:18px">

        <h2 style="color:#6c2bd9;margin-bottom:6px">${heading}</h2>

        <p style="font-size:14px;color:#444">
          Below are the meeting details:
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
          <p><b>Status:</b> ${booking.status || "CONFIRMED"}</p>
        </div>

        ${emailFooter(safeCompany)}
      </div>
      `
    });

    console.log("📨 EMAIL SENT TO:", recipients.join(", "));
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
   ROOMS
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
        b.*,
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
    const { companyId, company, email: adminEmail } = req.user;

    let {
      room_id,
      booked_by,
      department,
      purpose = "",
      booking_date,
      start_time,
      end_time
    } = req.body;

    if (!room_id || !booked_by || !department || !booking_date || !start_time || !end_time)
      return res.status(400).json({ message: "Required fields missing" });

    start_time = normalizeTime(start_time);
    end_time = normalizeTime(end_time);

    if (end_time <= start_time)
      return res.status(400).json({ message: "End time must be after start time" });

    await conn.beginTransaction();

    const [[room]] = await conn.query(
      `SELECT id, room_name FROM conference_rooms WHERE id = ? AND company_id = ? LIMIT 1`,
      [room_id, companyId]
    );

    if (!room) {
      await conn.rollback();
      return res.status(403).json({ message: "Invalid room" });
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
      return res.status(409).json({ message: "Room already booked" });
    }

    await conn.query(
      `
      INSERT INTO conference_bookings
      (company_id, room_id, booked_by, department, purpose, booking_date, start_time, end_time)
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
      adminEmail,
      userEmail: booked_by,
      subject: "Conference Room Booking Confirmed",
      heading: "Booking Confirmed 🎉",
      booking: {
        room_name: room.room_name,
        booking_date,
        start_time,
        end_time,
        department,
        purpose,
        status: "CONFIRMED"
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
   EDIT BOOKING
====================================================== */
router.patch("/bookings/:id", async (req, res) => {
  try {
    const { companyId, company, email: adminEmail } = req.user;
    const bookingId = Number(req.params.id);

    let { start_time, end_time } = req.body;

    if (!start_time || !end_time)
      return res.status(400).json({ message: "Times required" });

    start_time = normalizeTime(start_time);
    end_time = normalizeTime(end_time);

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

    const today = new Date().toISOString().slice(0, 10);
    if (booking.booking_date === today) {
      if (start_time <= nowTime())
        return res.status(400).json({ message: "Cannot move into past time" });
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
      [companyId, booking.room_id, booking.booking_date, bookingId, end_time, start_time]
    );

    if (conflict.cnt > 0)
      return res.status(409).json({ message: "Slot already booked" });

    await db.query(
      `UPDATE conference_bookings SET start_time = ?, end_time = ? WHERE id = ?`,
      [start_time, end_time, bookingId]
    );

    await sendBookingMail({
      adminEmail,
      userEmail: booking.booked_by,
      subject: "Conference Room Booking Rescheduled",
      heading: "Meeting Rescheduled 🔄",
      booking: {
        ...booking,
        start_time,
        end_time,
        status: "RESCHEDULED"
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
    const { companyId, company, email: adminEmail } = req.user;
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
      `UPDATE conference_bookings SET status = 'CANCELLED' WHERE id = ?`,
      [bookingId]
    );

    await sendBookingMail({
      adminEmail,
      userEmail: booking.booked_by,
      subject: "Conference Room Booking Cancelled",
      heading: "Meeting Cancelled ❌",
      booking: {
        ...booking,
        status: "CANCELLED"
      },
      company
    });

    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    console.error("[ADMIN][CANCEL BOOKING]", err);
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;



