import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import QRCode from "qrcode";

const router = express.Router();

/* ======================================================
   PLAN CONFIGURATION (matches database enum: lowercase)
====================================================== */
const PLANS = {
  trial: { rooms: 2, bookings: 100 },
  business: { rooms: 6, bookings: 1000 },
  enterprise: { rooms: Infinity, bookings: Infinity },
};

const ACTIVE_STATUSES = ["active", "trial"];

/* ======================================================
   MIDDLEWARE
====================================================== */
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(authenticate);

/* ======================================================
   UTILITY FUNCTIONS
====================================================== */

const getCompanyId = (user) => user?.company_id || user?.companyId;

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const isExpired = (date) => {
  if (!date) return true;
  return new Date(date).getTime() < Date.now();
};

const normalizeTime = (t) => {
  if (!t) throw new Error("Time is required");

  const s = String(t).trim().toUpperCase();
  const match = s.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);

  if (!match) {
    throw new Error("Only 12-hour format allowed (example: 11:30 AM)");
  }

  let [_, hh, mm, ampm] = match;
  let h = Number(hh);
  const m = Number(mm);

  if (h < 1 || h > 12) throw new Error("Invalid hour (must be 1-12)");
  if (m < 0 || m > 59) throw new Error("Invalid minutes (must be 0-59)");

  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return `${String(h).padStart(2, "0")}:${mm.padStart(2, "0")}`;
};

const toAmPm = (time) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const isEmail = (v = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const normalizePlan = (plan) => (plan || "trial").toLowerCase();

const normalizeStatus = (status) => (status || "pending").toLowerCase();

/* ======================================================
   EMAIL FUNCTIONS
====================================================== */

const emailFooter = (company = { name: "", logo_url: "" }) => `
<br/>
Regards,<br/>
<b>${company.name || ""}</b><br/>
${company.logo_url ? `<img src="${company.logo_url}" height="55" alt="Company Logo" />` : ""}
<hr/>
<p style="font-size:13px;color:#666">
This email was automatically sent from the Conference Room Booking Platform.
If you did not perform this action, please contact your administrator immediately.
</p>
`;

const sendBookingMail = async ({
  adminEmail,
  userEmail,
  subject,
  heading,
  booking,
  company,
}) => {
  try {
    if (!sendEmail) {
      console.warn("[EMAIL] sendEmail function not configured");
      return;
    }

    const toEmail = isEmail(userEmail)
      ? userEmail
      : isEmail(adminEmail)
      ? adminEmail
      : null;

    if (!toEmail) {
      console.warn("[EMAIL] No valid recipient email found");
      return;
    }

    subject = subject || "Conference Room Notification";
    heading = heading || "Conference Room Update";

    const html = `
      <h2>${heading}</h2>

      <p><b>Room:</b> ${booking?.room_name || "N/A"}</p>
      <p><b>Date:</b> ${booking?.booking_date || "N/A"}</p>
      <p><b>Time:</b> ${toAmPm(booking?.start_time)} — ${toAmPm(booking?.end_time)}</p>

      ${booking?.department ? `<p><b>Department:</b> ${booking.department}</p>` : ""}
      ${booking?.purpose ? `<p><b>Purpose:</b> ${booking.purpose}</p>` : ""}

      <p><b>Status:</b> ${booking?.status || "N/A"}</p>

      ${emailFooter(company)}
    `;

    await sendEmail({
      to: toEmail,
      cc: isEmail(adminEmail) && adminEmail !== toEmail ? adminEmail : undefined,
      subject,
      html,
    });

    console.log("[EMAIL] Sent to:", toEmail);
  } catch (err) {
    console.error("[EMAIL] Error:", err?.message || err);
  }
};

/* ======================================================
   CORE BUSINESS LOGIC
====================================================== */

const getCompanyInfo = async (companyId) => {
  try {
    const [[company]] = await db.query(
      `SELECT name, logo_url FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    return company || { name: "", logo_url: "" };
  } catch (error) {
    console.error("[getCompanyInfo]", error.message);
    return { name: "", logo_url: "" };
  }
};

const validateCompanySubscription = async (companyId) => {
  try {
    const [[company]] = await db.query(
      `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at
       FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      throw new Error("Company not found");
    }

    const plan = normalizePlan(company.plan);
    const status = normalizeStatus(company.subscription_status);

    if (!ACTIVE_STATUSES.includes(status)) {
      throw new Error("Subscription inactive. Please upgrade your plan.");
    }

    if (status === "trial" && isExpired(company.trial_ends_at)) {
      throw new Error("Trial period has expired. Please upgrade to continue.");
    }

    if (status === "active" && isExpired(company.subscription_ends_at)) {
      throw new Error("Subscription has expired. Please renew to continue.");
    }

    const limits = PLANS[plan] || PLANS.trial;

    return {
      plan,
      roomLimit: limits.rooms,
      bookingLimit: limits.bookings,
      isUnlimited: limits.rooms === Infinity,
    };
  } catch (error) {
    console.error("[validateCompanySubscription]", error.message);
    throw error;
  }
};

const canAddRoom = async (companyId, roomLimit) => {
  if (roomLimit === Infinity) return true;

  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
    [companyId]
  );

  return count.total < roomLimit;
};

const canAddBooking = async (companyId, bookingLimit) => {
  if (bookingLimit === Infinity) return true;

  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`,
    [companyId]
  );

  return count.total < bookingLimit;
};

const getRoomStats = async (companyId) => {
  try {
    const [[stats]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(is_active) AS active
       FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    return {
      total: stats?.total || 0,
      active: stats?.active || 0,
      locked: (stats?.total || 0) - (stats?.active || 0),
    };
  } catch (error) {
    console.error("[getRoomStats]", error.message);
    throw error;
  }
};

export const syncRoomActivationByPlan = async (companyId, plan) => {
  try {
    const limits = PLANS[plan] || PLANS.trial;
    const limit = limits.rooms;

    await db.query(
      `UPDATE conference_rooms SET is_active = 0 WHERE company_id = ?`,
      [companyId]
    );

    if (limit === Infinity) {
      await db.query(
        `UPDATE conference_rooms SET is_active = 1 WHERE company_id = ?`,
        [companyId]
      );
      return;
    }

    if (limit > 0) {
      await db.query(
        `UPDATE conference_rooms SET is_active = 1
         WHERE id IN (
           SELECT id FROM (
             SELECT id FROM conference_rooms
             WHERE company_id = ?
             ORDER BY room_number ASC, id ASC
             LIMIT ?
           ) AS temp
         )`,
        [companyId, limit]
      );
    }
  } catch (error) {
    console.error("[syncRoomActivationByPlan]", error.message);
    throw error;
  }
};

const verifyRoomAccess = async (roomId, companyId, requireActive = true) => {
  try {
    const [[room]] = await db.query(
      `SELECT id, is_active, room_name, room_number, capacity
       FROM conference_rooms WHERE id = ? AND company_id = ?`,
      [roomId, companyId]
    );

    if (!room) {
      throw new Error("Room not found or access denied");
    }

    if (requireActive && !room.is_active) {
      throw new Error("This room is locked under your current plan. Please upgrade to edit.");
    }

    return room;
  } catch (error) {
    console.error("[verifyRoomAccess]", error.message);
    throw error;
  }
};

/**
 * Get or create public booking slug (TRANSACTION SAFE)
 * Uses existing 'slug' column from companies table
 */
const getOrCreatePublicSlug = async (companyId) => {
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // Lock company row and get slug
    const [[company]] = await conn.execute(
      `SELECT slug, name FROM companies WHERE id = ? FOR UPDATE`,
      [companyId]
    );

    if (!company) {
      throw new Error("Company not found");
    }

    // If slug exists, return it
    if (company.slug) {
      await conn.commit();
      return company.slug;
    }

    // Generate new slug
    const slug = `${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${companyId}`;

    // Update company with new slug
    await conn.execute(
      `UPDATE companies SET slug = ? WHERE id = ?`,
      [slug, companyId]
    );

    await conn.commit();
    return slug;

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   API ROUTES
====================================================== */

router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const { plan, roomLimit, bookingLimit, isUnlimited } = await validateCompanySubscription(companyId);
    const roomStats = await getRoomStats(companyId);

    const [[bookingCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`,
      [companyId]
    );

    res.json({
      plan: plan.toUpperCase(), // Return uppercase for frontend display
      limit: isUnlimited ? "Unlimited" : roomLimit,
      totalRooms: roomStats.total,
      activeRooms: roomStats.active,
      lockedRooms: roomStats.locked,
      slotsAvailable: isUnlimited ? null : Math.max(0, roomLimit - roomStats.total),
      upgradeRequired: !isUnlimited && roomStats.total >= roomLimit,
      bookingsUsed: bookingCount.total,
      bookingsLimit: bookingLimit === Infinity ? "Unlimited" : bookingLimit,
    });
  } catch (err) {
    console.error("[GET /plan-usage]", err.message);
    res.status(403).json({ message: err.message });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    await validateCompanySubscription(companyId);

    const [[stats]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM conference_rooms WHERE company_id = ?) AS rooms,
         (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ?) AS totalBookings,
         (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ? AND booking_date = CURDATE() AND status = 'BOOKED') AS todayBookings`,
      [companyId, companyId, companyId]
    );

    const [departments] = await db.query(
      `SELECT department, COUNT(*) AS total
       FROM conference_bookings WHERE company_id = ?
       GROUP BY department ORDER BY total DESC`,
      [companyId]
    );

    res.json({
      rooms: stats?.rooms || 0,
      totalBookings: stats?.totalBookings || 0,
      todayBookings: stats?.todayBookings || 0,
      departments: departments || [],
    });
  } catch (err) {
    console.error("[GET /dashboard]", err.message);
    res.status(500).json({ message: "Failed to load dashboard statistics" });
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    await validateCompanySubscription(companyId);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity
       FROM conference_rooms WHERE company_id = ? AND is_active = 1
       ORDER BY room_number ASC`,
      [companyId]
    );

    res.json(rooms || []);
  } catch (err) {
    console.error("[GET /rooms]", err.message);
    res.status(err.message.includes("not found") ? 404 : 403).json({
      message: err.message,
    });
  }
});

router.get("/rooms/all", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity, is_active
       FROM conference_rooms WHERE company_id = ?
       ORDER BY room_number ASC, id ASC`,
      [companyId]
    );

    res.json(rooms || []);
  } catch (err) {
    console.error("[GET /rooms/all]", err.message);
    res.status(500).json({ message: "Unable to load rooms" });
  }
});

router.post("/rooms", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const { room_name, room_number, capacity } = req.body;

    if (!room_name?.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    if (!room_number) {
      return res.status(400).json({ message: "Room number is required" });
    }

    const { plan, roomLimit } = await validateCompanySubscription(companyId);

    const canAdd = await canAddRoom(companyId, roomLimit);
    if (!canAdd) {
      return res.status(403).json({
        message: `Your ${plan} plan allows only ${roomLimit} room(s). Please upgrade to add more.`,
      });
    }

    const [[existing]] = await db.query(
      `SELECT id FROM conference_rooms WHERE company_id = ? AND room_number = ?`,
      [companyId, room_number]
    );

    if (existing) {
      return res.status(409).json({
        message: "Room number already exists. Please use a different number.",
      });
    }

    const [result] = await db.query(
      `INSERT INTO conference_rooms
       (company_id, room_number, room_name, capacity, is_active)
       VALUES (?, ?, ?, ?, 0)`,
      [companyId, room_number, room_name.trim(), capacity || 0]
    );

    await syncRoomActivationByPlan(companyId, plan);

    res.status(201).json({
      message: "Room created successfully. Activation depends on your current plan.",
      roomId: result.insertId,
    });
  } catch (err) {
    console.error("[POST /rooms]", err.message);
    res.status(err.message.includes("expired") ? 403 : 500).json({
      message: err.message,
    });
  }
});

router.patch("/rooms/:id", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const roomId = parseInt(req.params.id);
    const { room_name, capacity } = req.body;

    if (isNaN(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    if (!room_name?.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    await validateCompanySubscription(companyId);
    await verifyRoomAccess(roomId, companyId, true);

    await db.query(
      `UPDATE conference_rooms SET room_name = ?, capacity = ?
       WHERE id = ? AND company_id = ?`,
      [room_name.trim(), capacity || 0, roomId, companyId]
    );

    res.json({ message: "Room updated successfully" });
  } catch (err) {
    console.error("[PATCH /rooms/:id]", err.message);

    const statusCode = err.message.includes("not found")
      ? 404
      : err.message.includes("locked")
      ? 403
      : 500;

    res.status(statusCode).json({ message: err.message });
  }
});

router.delete("/rooms/:id", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const roomId = parseInt(req.params.id);

    if (isNaN(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    await verifyRoomAccess(roomId, companyId, false);

    const [[bookingCheck]] = await db.query(
      `SELECT COUNT(*) AS count FROM conference_bookings WHERE room_id = ?`,
      [roomId]
    );

    if (bookingCheck.count > 0) {
      return res.status(409).json({
        message: "Cannot delete room with existing bookings. Please cancel all bookings first.",
      });
    }

    await db.query(
      `DELETE FROM conference_rooms WHERE id = ? AND company_id = ?`,
      [roomId, companyId]
    );

    res.json({ message: "Room deleted successfully" });
  } catch (err) {
    console.error("[DELETE /rooms/:id]", err.message);
    res.status(err.message.includes("not found") ? 404 : 500).json({
      message: err.message,
    });
  }
});

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

    sql += " ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 500";

    const [rows] = await db.query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error("[GET /bookings]", err.message);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

router.post("/bookings", async (req, res) => {
  const conn = await db.getConnection();

  try {
    const companyId = getCompanyId(req.user);
    const { email: adminEmail } = req.user;

    const { plan, bookingLimit } = await validateCompanySubscription(companyId);

    const canBook = await canAddBooking(companyId, bookingLimit);
    if (!canBook) {
      return res.status(403).json({
        message: `Your ${plan} plan allows only ${bookingLimit} booking(s). Please upgrade.`,
      });
    }

    let { room_id, booked_by, department, purpose = "", booking_date, start_time, end_time } = req.body;

    if (!room_id || !booked_by || !department || !booking_date || !start_time || !end_time) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    start_time = normalizeTime(start_time);
    end_time = normalizeTime(end_time);

    if (end_time <= start_time) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    await conn.beginTransaction();

    const [[room]] = await conn.query(
      `SELECT id, room_name FROM conference_rooms WHERE id = ? AND company_id = ? LIMIT 1`,
      [room_id, companyId]
    );

    if (!room) {
      await conn.rollback();
      return res.status(403).json({ message: "Invalid room or access denied" });
    }

    const [[conflict]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM conference_bookings
       WHERE company_id = ? AND room_id = ? AND booking_date = ? AND status = 'BOOKED'
       AND start_time < ? AND end_time > ?`,
      [companyId, room_id, booking_date, end_time, start_time]
    );

    if (conflict.cnt > 0) {
      await conn.rollback();
      return res.status(409).json({ message: "Time slot already booked for this room" });
    }

    await conn.query(
      `INSERT INTO conference_bookings
       (company_id, room_id, booked_by, department, purpose, booking_date, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
        status: "CONFIRMED",
      },
      company: companyInfo,
    });

    res.status(201).json({ message: "Booking created successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("[POST /bookings]", err.message);
    res.status(500).json({ message: err.message || "Unable to create booking" });
  } finally {
    conn.release();
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const bookingId = Number(req.params.id);

    let { start_time, end_time } = req.body;

    if (!start_time || !end_time) {
      return res.status(400).json({ message: "Start and end times are required" });
    }

    start_time = normalizeTime(start_time);
    end_time = normalizeTime(end_time);

    if (end_time <= start_time) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    const [[booking]] = await db.query(
      `SELECT b.*, r.room_name FROM conference_bookings b
       JOIN conference_rooms r ON r.id = b.room_id
       WHERE b.id = ? AND b.company_id = ? LIMIT 1`,
      [bookingId, companyId]
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (booking.booking_date === today && start_time <= nowTime()) {
      return res.status(400).json({ message: "Cannot schedule booking in the past" });
    }

    const [[conflict]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM conference_bookings
       WHERE company_id = ? AND room_id = ? AND booking_date = ? AND id <> ? AND status = 'BOOKED'
       AND start_time < ? AND end_time > ?`,
      [companyId, booking.room_id, booking.booking_date, bookingId, end_time, start_time]
    );

    if (conflict.cnt > 0) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

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
      company: companyInfo,
    });

    res.json({ message: "Booking updated successfully" });
  } catch (err) {
    console.error("[PATCH /bookings/:id]", err.message);
    res.status(500).json({ message: err.message || "Unable to update booking" });
  }
});

router.patch("/bookings/:id/cancel", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const bookingId = Number(req.params.id);

    const [[booking]] = await db.query(
      `SELECT b.*, r.room_name FROM conference_bookings b
       JOIN conference_rooms r ON r.id = b.room_id
       WHERE b.id = ? AND b.company_id = ? LIMIT 1`,
      [bookingId, companyId]
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

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
      company: companyInfo,
    });

    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    console.error("[PATCH /bookings/:id/cancel]", err.message);
    res.status(500).json({ message: err.message || "Unable to cancel booking" });
  }
});

router.post("/sync-rooms", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const { plan } = await validateCompanySubscription(companyId);

    await syncRoomActivationByPlan(companyId, plan);

    res.json({ message: "Room activation synced successfully" });
  } catch (err) {
    console.error("[POST /sync-rooms]", err.message);
    res.status(500).json({ message: "Failed to sync room activation" });
  }
});

/* ======================================================
   QR CODE ROUTES (NEW)
====================================================== */

/**
 * GET /api/conference/public-booking-info
 * Returns public booking URL and generates QR code
 */
router.get("/public-booking-info", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    // Validate subscription
    await validateCompanySubscription(companyId);

    // Get or create public slug (transaction-safe)
    const slug = await getOrCreatePublicSlug(companyId);

    // Construct public URL
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.promeet.zodopt.com";
    const publicUrl = `${baseUrl}/book/${slug}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: 512,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    res.json({
      publicUrl,
      slug,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("[GET /public-booking-info]", error.message);

    const statusCode = error.message.includes("expired") || 
                       error.message.includes("inactive")
      ? 403
      : 500;

    res.status(statusCode).json({
      message: error.message || "Failed to generate public booking information",
    });
  }
});

/**
 * GET /api/conference/qr-code/download
 * Downloads QR code as PNG file
 */
router.get("/qr-code/download", async (req, res) => {
  const conn = await db.getConnection();
  
  try {
    const companyId = getCompanyId(req.user);

    // Validate subscription
    await validateCompanySubscription(companyId);

    await conn.beginTransaction();

    // Lock and get company info
    const [[company]] = await conn.execute(
      `SELECT name, slug FROM companies WHERE id = ? FOR UPDATE`,
      [companyId]
    );

    if (!company) {
      await conn.rollback();
      return res.status(404).json({ message: "Company not found" });
    }

    // Get or generate slug
    let slug = company.slug;
    
    if (!slug) {
      slug = `${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${companyId}`;
      await conn.execute(
        `UPDATE companies SET slug = ? WHERE id = ?`,
        [slug, companyId]
      );
    }

    await conn.commit();

    // Construct public URL
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.promeet.zodopt.com";
    const publicUrl = `${baseUrl}/book/${slug}`;

    // Generate QR code as buffer
    const qrCodeBuffer = await QRCode.toBuffer(publicUrl, {
      errorCorrectionLevel: "M",
      type: "png",
      width: 1024,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Create safe filename
    const safeFileName = company.name
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();

    // Set headers for download
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFileName}-booking-qr.png"`
    );

    res.send(qrCodeBuffer);

  } catch (error) {
    await conn.rollback();
    console.error("[GET /qr-code/download]", error.message);

    const statusCode = error.message.includes("expired") || 
                       error.message.includes("inactive")
      ? 403
      : 500;

    res.status(statusCode).json({
      message: error.message || "Failed to download QR code",
    });
  } finally {
    conn.release();
  }
});

export default router;
