import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

/* ======================================================
   FIX: ALWAYS GET CORRECT COMPANY ID
====================================================== */
const getCompanyId = (u) => u?.company_id || u?.companyId;

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

/* ======================================================
   STRICT AM/PM ONLY
====================================================== */
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
   EMAIL FOOTER
====================================================== */
const emailFooter = (company = { name: "", logo_url: "" }) => `
<br/>
Regards,<br/>
<b>${company.name || ""}</b><br/>
${company.logo_url ? `<img src="${company.logo_url}" height="55" />` : ""}
<hr/>
<p style="font-size:13px;color:#666">
This email was automatically sent from the Conference Room Booking Platform.
If you did not perform this action, please contact your administrator immediately.
</p>
`;

const isEmail = (v = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* ======================================================
   FINAL — SAFE + GUARANTEED EMAIL
====================================================== */
const sendBookingMail = async ({
  adminEmail,
  userEmail,
  subject,
  heading,
  booking,
  company
}) => {
  try {
    if (!sendEmail) {
      console.warn("sendEmail not configured");
      return;
    }

    const toEmail = isEmail(userEmail)
      ? userEmail
      : (isEmail(adminEmail) ? adminEmail : null);

    if (!toEmail) {
      console.warn("No valid recipient email found");
      return;
    }

    if (!subject) subject = "Conference Room Notification";
    if (!heading) heading = "Conference Room Update";

    const html = `
      <h2>${heading}</h2>

      <p><b>Room:</b> ${booking?.room_name || ""}</p>
      <p><b>Date:</b> ${booking?.booking_date || ""}</p>
      <p><b>Time:</b> ${toAmPm(booking?.start_time)} — ${toAmPm(
        booking?.end_time
      )}</p>

      ${
        booking?.department
          ? `<p><b>Department:</b> ${booking.department}</p>`
          : ""
      }
      ${
        booking?.purpose
          ? `<p><b>Purpose:</b> ${booking.purpose}</p>`
          : ""
      }

      <p><b>Status:</b> ${booking?.status || ""}</p>

      ${emailFooter(company)}
    `;

    await sendEmail({
      to: toEmail,
      cc: isEmail(adminEmail) ? adminEmail : undefined,
      subject,
      html
    });

    console.log("MAIL SENT →", toEmail);
  } catch (err) {
    console.error("MAIL ERROR →", err?.message || err);
  }
};

/* ======================================================
   COMPANY INFO
====================================================== */
const getCompanyInfo = async (companyId) => {
  const [[company]] = await db.query(
    "SELECT name, logo_url FROM companies WHERE id = ? LIMIT 1",
    [companyId]
  );
  return company || { name: "", logo_url: "" };
};

/* ======================================================
   PLAN VALIDATION
====================================================== */
const checkConferencePlan = async (companyId) => {
  const [[company]] = await db.query(
    `
    SELECT 
      plan,
      subscription_status,
      trial_ends_at,
      subscription_ends_at
    FROM companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  if (!company) throw new Error("Company not found");

  const PLAN = (company.plan || "TRIAL").toUpperCase();
  const STATUS = (company.subscription_status || "PENDING").toUpperCase();
  const now = new Date();

  if (!["ACTIVE", "TRIAL"].includes(STATUS))
    throw new Error("Subscription inactive. Please renew subscription.");

  if (PLAN === "TRIAL") {
    if (!company.trial_ends_at)
      throw new Error("Trial not initialized");

    if (new Date(company.trial_ends_at) < now)
      throw new Error("Trial expired. Please upgrade plan.");

    const [[rooms]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    if (rooms.total >= 2)
      return { plan: PLAN, roomAllowed: false };

    const [[bookings]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`,
      [companyId]
    );

    if (bookings.total >= 100)
      throw new Error("Trial limit reached. Max 100 bookings allowed.");

    return { plan: PLAN, roomAllowed: true };
  }

  if (PLAN === "BUSINESS") {
    if (!company.subscription_ends_at)
      throw new Error("Subscription not initialized");

    if (new Date(company.subscription_ends_at) < now)
      throw new Error("Business plan expired. Please renew.");

    const [[rooms]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    return { plan: PLAN, roomAllowed: rooms.total < 6 };
  }

  return { plan: "ENTERPRISE", roomAllowed: true };
};

/* ======================================================
   PLAN USAGE
====================================================== */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    const [[company]] = await db.query(
      `SELECT plan FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) throw new Error("Company not found");

    const PLAN = (company.plan || "TRIAL").toUpperCase();

    let limit =
      PLAN === "TRIAL" ? 2 :
      PLAN === "BUSINESS" ? 6 :
      Infinity;

    const [[count]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    res.json({
      plan: PLAN,
      limit: limit === Infinity ? "UNLIMITED" : limit,
      used: count.total,
      remaining: limit === Infinity ? null : Math.max(limit - count.total, 0)
    });

  } catch (err) {
    console.error("[CONF PLAN USAGE]", err);
    res.status(403).json({ message: err.message || "Plan error" });
  }
});

/* ======================================================
   DASHBOARD
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    const [[stats]] = await db.query(
      `
      SELECT
        (SELECT COUNT(*) FROM conference_rooms WHERE company_id = ?) AS rooms,
        (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ?) AS totalBookings,
        (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ? AND booking_date = CURDATE() AND status = 'BOOKED') AS todayBookings
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

    const plan = await checkConferencePlan(companyId);

    res.json({ ...stats, departments, plan });
  } catch (err) {
    console.error("[ADMIN][DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
});

/* ======================================================
   GET ROOMS
====================================================== */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [companyId]
    );

    res.json(rooms || []);
  } catch (err) {
    console.error("[ADMIN][GET ROOMS]", err);
    res.status(500).json({ message: "Unable to fetch rooms" });
  }
});

/* ======================================================
   GET BOOKINGS
====================================================== */
router.get("/bookings", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const { roomId, date } = req.query;

    let sql = `
      SELECT b.*, r.room_name, r.room_number
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
    res.json(rows || []);
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
    const companyId = getCompanyId(req.user);
    const { email: adminEmail } = req.user;

    try {
      await checkConferencePlan(companyId);
    } catch (e) {
      return res.status(403).json({ message: e.message });
    }

    let { room_id, booked_by, department, purpose = "", booking_date, start_time, end_time } = req.body;

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

    const planRoom = await checkConferencePlan(companyId);
    if (!planRoom.roomAllowed) {
      await conn.rollback();
      return res.status(403).json({ message: "Your plan does not allow booking more rooms" });
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
      [companyId, room_id, booked_by, department.trim(), purpose.trim(), booking_date, start_time, end_time]
    );

    await conn.commit();

    const companyInfo = await getCompanyInfo(companyId);

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
      company: companyInfo
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
    const companyId = getCompanyId(req.user);
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

    const companyInfo = await getCompanyInfo(companyId);

    await sendBookingMail({
      adminEmail: req.user.email,
      userEmail: booking.booked_by,
      subject: "Conference Room Booking Rescheduled",
      heading: "Meeting Rescheduled 🔄",
      booking: { ...booking, start_time, end_time, status: "RESCHEDULED" },
      company: companyInfo
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
    const companyId = getCompanyId(req.user);
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

    const companyInfo = await getCompanyInfo(companyId);

    await sendBookingMail({
      adminEmail: req.user.email,
      userEmail: booking.booked_by,
      subject: "Conference Room Booking Cancelled",
      heading: "Meeting Cancelled ❌",
      booking: { ...booking, status: "CANCELLED" },
      company: companyInfo
    });

    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    console.error("[ADMIN][CANCEL BOOKING]", err);
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;
