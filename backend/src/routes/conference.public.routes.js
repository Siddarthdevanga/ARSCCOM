import express from "express";
import { randomUUID } from "crypto";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { getPresignedUrl } from "../services/s3.service.js";

const router = express.Router();

/* ======================================================
   CONSTANTS & CONFIGURATION
====================================================== */
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

const PLAN_LIMITS = {
  TRIAL: { 
    bookings: 100, 
    rooms: 2
  },
  BUSINESS: { 
    bookings: 1000, 
    rooms: 6
  },
  ENTERPRISE: { 
    bookings: Infinity, 
    rooms: Infinity
  }
};

const ERROR_MESSAGES = {
  INVALID_EMAIL: "Valid email address required",
  INVALID_LINK: "Invalid booking link",
  MISSING_FIELDS: "Missing required fields",
  INVALID_TIME_RANGE: "End time must be after start time",
  INVALID_TIME_FORMAT: "Only AM/PM format allowed (Example: 4:30 PM)",
  SLOT_CONFLICT: "This time slot is already booked",
  TIME_CONFLICT: "Time slot conflicts with existing booking",
  OTP_REQUIRED: "OTP verification required",
  OTP_INVALID: "Invalid or expired OTP",
  BOOKING_NOT_FOUND: "Booking not found",
  UNAUTHORIZED: "You are not authorized to modify this booking",
  SERVER_ERROR: "Server error occurred",
  
  // User-friendly messages for public interface
  SERVICE_UNAVAILABLE: "Service temporarily unavailable. Please contact your organization for assistance.",
  BOOKING_UNAVAILABLE: "Booking is currently unavailable. Please try again later or contact support.",
  FEATURE_LIMITED: "Some features may be limited. Please contact your organization if you need assistance."
};

/* ======================================================
   UTILITY FUNCTIONS
====================================================== */
const normalizeSlug = (value) => String(value || "").trim().toLowerCase();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

/**
 * Validates email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Converts AM/PM time format to 24-hour HH:MM:SS format
 * @throws {Error} If format is invalid
 */
const normalizeAmPmTime = (input = "") => {
  const value = String(input).trim().toUpperCase();
  const match = value.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);

  if (!match) {
    throw new Error(ERROR_MESSAGES.INVALID_TIME_FORMAT);
  }

  let [_, hh, mm, period] = match;
  let hour = Number(hh);
  const minute = Number(mm);

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error(ERROR_MESSAGES.INVALID_TIME_FORMAT);
  }

  // Convert to 24-hour format
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
};

/**
 * Converts 24-hour time to pretty AM/PM format
 */
const prettyTime = (timeString = "") => {
  const [h, m] = timeString.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

/**
 * Generates a random OTP
 */
const generateOtp = () => {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

/* ======================================================
   EMAIL TEMPLATES
====================================================== */
const emailFooter = (company, logoUrl = null) => `
<br/>
<br/>
Regards,<br/>
<b>${company.name}</b><br/>
${logoUrl ? `<img src="${logoUrl}" alt="${company.name} Logo" height="55" />` : ""}
<hr/>
<p style="font-size:13px;color:#666;margin-top:15px;">
This email was automatically sent from the Conference Room Booking Platform.
If you did not perform this action, please contact your administrator immediately.
</p>
`;

const getLogoUrl = async (company) =>
  company.logo_url ? getPresignedUrl(company.logo_url, 3600) : null;

const sendOtpEmail = async (email, otp, company) => {
  const logoUrl = await getLogoUrl(company);
  await sendEmail({
    to: email,
    subject: `Your OTP for Conference Booking – ${company.name}`,
    html: `
      <h3>Your One-Time Password</h3>
      <div style="background:#f5f5f5;padding:20px;text-align:center;margin:20px 0;">
        <h1 style="margin:0;letter-spacing:5px;color:#333;">${otp}</h1>
      </div>
      <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
      <p style="color:#666;font-size:14px;">Please do not share this code with anyone.</p>
      ${emailFooter(company, logoUrl)}
    `
  });
};

/* ── shared: get a presigned room image URL (null if none) ── */
const getRoomImageUrl = async (room) => {
  if (!room?.image_url) return null;
  try { return await getPresignedUrl(room.image_url, 86400); } catch { return null; }
};

/* ── shared: 16:9 room image block or branded placeholder ── */
const roomImageBlock = (imageUrl, roomName) =>
  imageUrl
    ? `<img src="${imageUrl}" alt="${roomName}" style="width:100%;max-width:560px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;margin:0 auto 20px;" />`
    : `<div style="width:100%;max-width:560px;aspect-ratio:16/9;background:linear-gradient(135deg,#6c2bd9,#a78bfa);border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
         <span style="color:#fff;font-size:28px;font-weight:800;letter-spacing:1px;">${roomName.charAt(0).toUpperCase()}</span>
       </div>`;

/* ── shared: booking details table ── */
const bookingTable = (room, booking, accentColor = "#6c2bd9") => `
  <table style="border-collapse:collapse;margin:0;font-size:14px;width:100%;max-width:560px;border-radius:8px;overflow:hidden;border:1px solid #ede9fe;">
    <tr style="background:${accentColor};color:#fff;">
      <td colspan="2" style="padding:10px 14px;font-weight:700;font-size:15px;">Booking Summary</td>
    </tr>
    <tr style="border-bottom:1px solid #ede9fe;">
      <td style="padding:10px 14px;font-weight:600;color:#6b7280;width:130px;">Room</td>
      <td style="padding:10px 14px;color:#1f2937;font-weight:600;">${room.room_name}${room.room_number ? ` <span style="color:#9ca3af;font-weight:400;">#${room.room_number}</span>` : ""}${room.capacity ? ` <span style="color:#9ca3af;font-size:12px;margin-left:6px;">&bull; ${room.capacity} people</span>` : ""}</td>
    </tr>
    <tr style="border-bottom:1px solid #ede9fe;background:#faf5ff;">
      <td style="padding:10px 14px;font-weight:600;color:#6b7280;">Date</td>
      <td style="padding:10px 14px;color:#1f2937;">${booking.booking_date}</td>
    </tr>
    <tr style="border-bottom:1px solid #ede9fe;">
      <td style="padding:10px 14px;font-weight:600;color:#6b7280;">Time</td>
      <td style="padding:10px 14px;color:#1f2937;font-weight:600;">${prettyTime(booking.start_time)} &ndash; ${prettyTime(booking.end_time)}</td>
    </tr>
    ${booking.department ? `<tr style="border-bottom:1px solid #ede9fe;background:#faf5ff;"><td style="padding:10px 14px;font-weight:600;color:#6b7280;">Department</td><td style="padding:10px 14px;color:#1f2937;">${booking.department}</td></tr>` : ""}
    ${booking.purpose ? `<tr><td style="padding:10px 14px;font-weight:600;color:#6b7280;">Purpose</td><td style="padding:10px 14px;color:#1f2937;">${booking.purpose}</td></tr>` : ""}
  </table>`;

const sendBookingEmail = async (email, company, room, booking) => {
  const [logoUrl, roomImageUrl] = await Promise.all([getLogoUrl(company), getRoomImageUrl(room)]);
  await sendEmail({
    to: email,
    subject: `Booking Confirmed – ${room.room_name} | ${company.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ede9fe;">
        <div style="background:linear-gradient(135deg,#6c2bd9,#7c3aed);padding:24px 28px;">
          <div style="color:#c4b5fd;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${company.name}</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Booking Confirmed</h1>
          <p style="color:#ddd6fe;margin:6px 0 0;font-size:14px;">Your conference room is reserved</p>
        </div>
        <div style="padding:24px 28px;">
          ${roomImageBlock(roomImageUrl, room.room_name)}
          ${bookingTable(room, booking, "#6c2bd9")}
        </div>
        ${emailFooter(company, logoUrl)}
      </div>`
  });
};

const sendUpdateEmail = async (email, company, room, booking) => {
  const [logoUrl, roomImageUrl] = await Promise.all([getLogoUrl(company), getRoomImageUrl(room)]);
  await sendEmail({
    to: email,
    subject: `Booking Updated – ${room.room_name} | ${company.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0f2fe;">
        <div style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:24px 28px;">
          <div style="color:#bfdbfe;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${company.name}</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Booking Updated</h1>
          <p style="color:#dbeafe;margin:6px 0 0;font-size:14px;">Your booking details have changed</p>
        </div>
        <div style="padding:24px 28px;">
          ${roomImageBlock(roomImageUrl, room.room_name)}
          ${bookingTable(room, booking, "#1d4ed8")}
        </div>
        ${emailFooter(company, logoUrl)}
      </div>`
  });
};

const sendCancelEmail = async (email, company, room, booking) => {
  const [logoUrl, roomImageUrl] = await Promise.all([getLogoUrl(company), getRoomImageUrl(room)]);
  await sendEmail({
    to: email,
    subject: `Booking Cancelled – ${room.room_name} | ${company.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #fee2e2;">
        <div style="background:linear-gradient(135deg,#b91c1c,#ef4444);padding:24px 28px;">
          <div style="color:#fecaca;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${company.name}</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">Booking Cancelled</h1>
          <p style="color:#fee2e2;margin:6px 0 0;font-size:14px;">Your conference room booking has been cancelled</p>
        </div>
        <div style="padding:24px 28px;">
          ${roomImageBlock(roomImageUrl, room.room_name)}
          ${bookingTable(room, booking, "#b91c1c")}
        </div>
        ${emailFooter(company, logoUrl)}
      </div>`
  });
};

const sendTeamMemberEmail = async (memberEmail, memberName, organiserEmail, company, room, booking) => {
  const [logoUrl, roomImageUrl] = await Promise.all([getLogoUrl(company), getRoomImageUrl(room)]);
  await sendEmail({
    to: memberEmail,
    subject: `You've been added to a meeting – ${room.room_name} | ${company.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ede9fe;">
        <div style="background:linear-gradient(135deg,#6c2bd9,#7c3aed);padding:24px 28px;">
          <div style="color:#c4b5fd;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${company.name}</div>
          <h1 style="color:#fff;margin:0;font-size:22px;">You've Been Added to a Meeting</h1>
          <p style="color:#ddd6fe;margin:6px 0 0;font-size:14px;">Hi <b>${memberName}</b> — <b>${organiserEmail}</b> has invited you</p>
        </div>
        <div style="padding:24px 28px;">
          ${roomImageBlock(roomImageUrl, room.room_name)}
          ${bookingTable(room, booking, "#6c2bd9")}
        </div>
        ${emailFooter(company, logoUrl)}
      </div>`
  });
};

/* ======================================================
   DATABASE HELPERS
====================================================== */
/**
 * Fetches company by slug
 */
const getCompanyBySlug = async (slug, fields = "id, name, logo_url") => {
  const [[company]] = await db.query(
    `SELECT ${fields} FROM companies WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return company;
};

/**
 * Fetches room by ID
 */
const getRoomById = async (roomId) => {
  const [[room]] = await db.query(
    `SELECT room_name, room_number, capacity, image_url FROM conference_rooms WHERE id = ? LIMIT 1`,
    [roomId]
  );
  return room;
};

/**
 * Checks if time slot conflicts with existing bookings
 */
const hasTimeConflict = async (companyId, roomId, date, startTime, endTime, excludeBookingId = null) => {
  const query = excludeBookingId
    ? `SELECT id FROM conference_bookings
       WHERE company_id = ? AND room_id = ? AND booking_date = ?
       AND id != ? AND status = 'BOOKED'
       AND NOT (end_time <= ? OR start_time >= ?)
       LIMIT 1`
    : `SELECT id FROM conference_bookings
       WHERE company_id = ? AND room_id = ? AND booking_date = ?
       AND status = 'BOOKED'
       AND start_time < ? AND end_time > ?
       LIMIT 1`;

  const params = excludeBookingId
    ? [companyId, roomId, date, excludeBookingId, startTime, endTime]
    : [companyId, roomId, date, endTime, startTime];

  const [conflicts] = await db.query(query, params);
  return conflicts.length > 0;
};

/**
 * Verifies OTP for email
 */
const isOtpVerified = async (companyId, email) => {
  const [[verified]] = await db.query(
    `SELECT id FROM public_booking_otp
     WHERE company_id = ? AND email = ? AND verified = 1 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [companyId, email]
  );
  return !!verified;
};

/* ======================================================
   ENHANCED GRACEFUL SUBSCRIPTION VALIDATION
====================================================== */

/**
 * Enhanced subscription validation with graceful degradation for public users
 * Returns status info but doesn't always throw errors for public access
 */
const checkSubscriptionStatus = async (companyId) => {
  console.log(`[SUBSCRIPTION_CHECK] Checking company:`, companyId);

  const [[company]] = await db.query(
    `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at,
            grace_period_ends_at
     FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );

  if (!company) {
    return {
      isValid: false,
      isBlocked: true,
      reason: "COMPANY_NOT_FOUND",
      error: new Error("Company not found")
    };
  }

  const plan = (company.plan || "TRIAL").toUpperCase();
  const status = (company.subscription_status || "PENDING").toUpperCase();
  const now = new Date();

  console.log(`[SUBSCRIPTION_CHECK] Plan: ${plan}, Status: ${status}`);

  // Check if in grace period
  const inGracePeriod = status === "GRACE_PERIOD" &&
                        company.grace_period_ends_at &&
                        new Date(company.grace_period_ends_at) > now;

  // Allow ACTIVE, TRIAL, and GRACE_PERIOD statuses.
  // When status is still 'ACTIVE'/'TRIAL' but subscription has technically expired,
  // allow access — the grace period cron will transition the status to 'GRACE_PERIOD' shortly.
  // Only block when the status itself is a terminal/invalid value (e.g., 'EXPIRED', 'SUSPENDED').
  const allowedStatuses = ["ACTIVE", "TRIAL", "GRACE_PERIOD"];
  const isValidStatus = allowedStatuses.includes(status);

  return {
    isValid: isValidStatus,
    isBlocked: !isValidStatus,
    isExpired: false,
    inGracePeriod,
    plan,
    status,
    reason: inGracePeriod ? "GRACE_PERIOD_ACTIVE" : (isValidStatus ? "OK" : "SUBSCRIPTION_INACTIVE"),
    limits: PLAN_LIMITS[plan] || PLAN_LIMITS.TRIAL
  };
};

/**
 * Validates plan limits with graceful handling
 */
const checkPlanLimits = async (companyId, plan, operation) => {
  const limits = PLAN_LIMITS[plan];
  if (!limits || plan === "ENTERPRISE") {
    return { withinLimits: true, usage: null };
  }

  console.log(`[PLAN_LIMITS] Checking ${operation} limits for ${plan}:`, limits);

  // Check total booking limit
  if (operation === "BOOKING" && limits.bookings !== Infinity) {
    const [[bookingCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? AND status = 'BOOKED'`,
      [companyId]
    );

    console.log(`[PLAN_LIMITS] Current bookings: ${bookingCount.total}/${limits.bookings}`);

    return {
      withinLimits: bookingCount.total < limits.bookings,
      usage: {
        current: bookingCount.total,
        limit: limits.bookings,
        remaining: Math.max(0, limits.bookings - bookingCount.total)
      }
    };
  }

  // Check room limit
  if (operation === "ROOM" && limits.rooms !== Infinity) {
    const [[roomCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    console.log(`[PLAN_LIMITS] Current rooms: ${roomCount.total}/${limits.rooms}`);

    return {
      withinLimits: roomCount.total <= limits.rooms,
      usage: {
        current: roomCount.total,
        limit: limits.rooms,
        remaining: Math.max(0, limits.rooms - roomCount.total)
      }
    };
  }

  return { withinLimits: true, usage: null };
};

/**
 * Comprehensive but graceful subscription validation
 * For public endpoints, we try to serve users even with subscription issues
 */
const validateSubscription = async (companyId, operation = "ACCESS", strict = false) => {
  const subscriptionStatus = await checkSubscriptionStatus(companyId);
  
  // For strict operations (like booking), we enforce subscription
  if (strict && !subscriptionStatus.isValid) {
    const error = new Error(ERROR_MESSAGES.SERVICE_UNAVAILABLE);
    error.code = subscriptionStatus.reason;
    error.isSubscriptionIssue = true;
    throw error;
  }

  // For non-strict operations (like viewing), we allow degraded access
  if (!strict && subscriptionStatus.isBlocked) {
    console.log(`[SUBSCRIPTION_WARNING] Degraded access for company ${companyId}: ${subscriptionStatus.reason}`);
    return { 
      ...subscriptionStatus, 
      allowDegradedAccess: true,
      warningMessage: ERROR_MESSAGES.FEATURE_LIMITED
    };
  }

  // Check plan limits
  const planLimits = await checkPlanLimits(companyId, subscriptionStatus.plan, operation);
  
  return {
    ...subscriptionStatus,
    ...planLimits,
    allowDegradedAccess: false
  };
};

/* ======================================================
   ROUTE HANDLERS WITH GRACEFUL DEGRADATION
====================================================== */

/**
 * GET /company/:slug - Fetch company details (always accessible)
 */
router.get("/company/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });
    }

    // Check subscription status but don't block basic company info
    try {
      const subscriptionInfo = await validateSubscription(company.id, "ACCESS", false);
      
      // Only return basic company info for public use - no plan details
      res.json({
        id: company.id,
        name: company.name,
        logo_url: company.logo_url
      });
    } catch (error) {
      // Even if subscription check fails, return basic company info
      console.warn(`[COMPANY_ACCESS_WARNING] ${company.id}:`, error.message);
      
      res.json({
        id: company.id,
        name: company.name,
        logo_url: company.logo_url
      });
    }
  } catch (error) {
    console.error("[PUBLIC][COMPANY]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * GET /company/:slug/rooms - Fetch available rooms (graceful degradation)
 */
router.get("/company/:slug/rooms", async (req, res) => {
  try {
    const slug    = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug, "id");
    if (!company) return res.json([]);

    let limitClause = "";
    try {
      const subscriptionInfo = await validateSubscription(company.id, "ROOM", false);
      if (subscriptionInfo.limits?.rooms !== Infinity) {
        limitClause = `LIMIT ${subscriptionInfo.limits.rooms}`;
      }
    } catch { limitClause = "LIMIT 2"; }

    const [rooms] = await db.query(
      `SELECT id, room_name, room_number, capacity, image_url
       FROM conference_rooms
       WHERE company_id = ? AND is_active = 1
       ORDER BY room_number ASC ${limitClause}`,
      [company.id]
    );

    // Attach today's upcoming bookings + employee name + presigned image
    const nowIST  = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const today   = nowIST.toISOString().split("T")[0];
    const nowTime = `${String(nowIST.getHours()).padStart(2,"0")}:${String(nowIST.getMinutes()).padStart(2,"0")}:00`;

    const roomIds = rooms.map(r => r.id);
    let bookingsByRoom = {};

    let totalByRoom = {};
    if (roomIds.length) {
      const placeholders = roomIds.map(() => "?").join(",");
      const [bookings] = await db.query(
        `SELECT cb.id, cb.room_id, cb.start_time, cb.end_time, cb.booked_by, cb.purpose, cb.department,
                COALESCE(ce.name, '') AS employee_name
         FROM conference_bookings cb
         LEFT JOIN company_employees ce
           ON ce.company_id = ? AND LOWER(ce.email) = LOWER(cb.booked_by) AND ce.is_active = 1
         WHERE cb.company_id = ?
           AND cb.room_id IN (${placeholders})
           AND cb.booking_date = ?
           AND cb.status = 'BOOKED'
         ORDER BY cb.start_time ASC`,
        [company.id, company.id, ...roomIds, today]
      );
      const [countRows] = await db.query(
        `SELECT room_id, COUNT(*) AS total FROM conference_bookings
         WHERE company_id = ? AND room_id IN (${placeholders}) AND status = 'BOOKED'
         GROUP BY room_id`,
        [company.id, ...roomIds]
      );
      for (const r of countRows) totalByRoom[r.room_id] = r.total;

      // Fetch team members for today's bookings
      const todayIds = bookings.map(b => b.id);
      const memberMap = {};
      if (todayIds.length > 0) {
        const phM = todayIds.map(() => "?").join(",");
        const [mems] = await db.query(
          `SELECT booking_id, name, email FROM conference_booking_members WHERE booking_id IN (${phM})`,
          todayIds
        );
        for (const m of mems) {
          if (!memberMap[m.booking_id]) memberMap[m.booking_id] = [];
          memberMap[m.booking_id].push({ name: m.name, email: m.email });
        }
      }

      for (const b of bookings) {
        if (!bookingsByRoom[b.room_id]) bookingsByRoom[b.room_id] = [];
        const name = b.employee_name || b.booked_by;
        bookingsByRoom[b.room_id].push({
          start_time:      b.start_time,
          end_time:        b.end_time,
          booked_by:       name || b.booked_by,
          booked_by_email: b.booked_by,
          purpose:         b.purpose || null,
          department:      b.department || null,
          team_members:    memberMap[b.id] || [],
        });
      }
    }

    const enriched = await Promise.all(rooms.map(async (room) => {
      let imageUrl = null;
      if (room.image_url) {
        try { imageUrl = await getPresignedUrl(room.image_url, 3600); } catch { imageUrl = null; }
      }
      const todayBookings = bookingsByRoom[room.id] || [];
      return {
        ...room,
        image_url:      imageUrl,
        today_bookings: todayBookings,
        is_busy_today:  todayBookings.length > 0,
        total_bookings: totalByRoom[room.id] || 0,
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error("[PUBLIC][ROOMS]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * GET /company/:slug/bookings - Fetch bookings for a room and date (graceful)
 */
router.get("/company/:slug/bookings", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const { roomId, date, userEmail } = req.query;

    if (!roomId || !date) {
      return res.json([]);
    }

    const company = await getCompanyBySlug(slug, "id");
    if (!company) {
      return res.json([]);
    }

    // Allow booking viewing with graceful degradation
    try {
      await validateSubscription(company.id, "ACCESS", false);
    } catch (error) {
      console.warn(`[BOOKINGS_DEGRADED_ACCESS] ${company.id}:`, error.message);
      // Continue to serve bookings even with subscription issues
    }

    const normalizedUserEmail = normalizeEmail(userEmail || "");

    const [bookings] = await db.query(
      `SELECT id, room_id, booking_date, start_time, end_time,
              department, booked_by, purpose, range_booking_id
       FROM conference_bookings
       WHERE company_id = ? AND room_id = ? AND booking_date = ? AND status = 'BOOKED'
       ORDER BY start_time ASC`,
      [company.id, roomId, date]
    );

    // Add can_modify flag
    const enrichedBookings = bookings.map(booking => ({
      ...booking,
      can_modify: normalizedUserEmail && booking.booked_by?.toLowerCase() === normalizedUserEmail,
      pretty_start_time: prettyTime(booking.start_time),
      pretty_end_time: prettyTime(booking.end_time)
    }));

    res.json(enrichedBookings);
  } catch (error) {
    console.error("[PUBLIC][BOOKINGS]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * POST /company/:slug/send-otp - Send OTP to email (graceful)
 */
router.post("/company/:slug/send-otp", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: ERROR_MESSAGES.INVALID_EMAIL });
    }

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) {
      return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });
    }

    // Allow OTP sending with graceful subscription handling
    try {
      await validateSubscription(company.id, "ACCESS", false);
    } catch (error) {
      console.warn(`[OTP_DEGRADED_ACCESS] ${company.id}:`, error.message);
      // Continue to send OTP for user verification
    }

    const otp = generateOtp();

    // Delete existing OTPs for this email
    await db.query(
      `DELETE FROM public_booking_otp WHERE company_id = ? AND email = ?`,
      [company.id, email]
    );

    // Insert new OTP
    await db.query(
      `INSERT INTO public_booking_otp
       (company_id, email, otp, expires_at, verified)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0)`,
      [company.id, email, otp, OTP_EXPIRY_MINUTES]
    );

    await sendOtpEmail(email, otp, company);

    console.log(`[OTP_SENT] Company: ${company.id}, Email: ${email}`);

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("[PUBLIC][SEND_OTP]", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/**
 * POST /company/:slug/verify-otp - Verify OTP (graceful)
 */
router.post("/company/:slug/verify-otp", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP required" });
    }

    const company = await getCompanyBySlug(slug, "id");
    if (!company) {
      return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });
    }

    // Allow OTP verification with graceful subscription handling
    try {
      await validateSubscription(company.id, "ACCESS", false);
    } catch (error) {
      console.warn(`[OTP_VERIFY_DEGRADED_ACCESS] ${company.id}:`, error.message);
      // Continue to verify OTP
    }

    const [[otpRecord]] = await db.query(
      `SELECT id FROM public_booking_otp
       WHERE company_id = ? AND email = ? AND otp = ?
       AND verified = 0 AND expires_at > NOW()
       LIMIT 1`,
      [company.id, email, otp]
    );

    if (!otpRecord) {
      return res.status(401).json({ message: ERROR_MESSAGES.OTP_INVALID });
    }

    // Mark OTP as verified
    await db.query(
      `UPDATE public_booking_otp SET verified = 1 WHERE id = ?`,
      [otpRecord.id]
    );

    console.log(`[OTP_VERIFIED] Company: ${company.id}, Email: ${email}`);

    res.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("[PUBLIC][VERIFY_OTP]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * POST /company/:slug/book - Create a new booking (strict subscription validation)
 */
router.post("/company/:slug/book", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const {
      room_id,
      booked_by,
      department,
      purpose = "",
      booking_date,
      start_time: rawStartTime,
      end_time: rawEndTime,
      teamMembers = []
    } = req.body;

    const email = normalizeEmail(booked_by);
    const cleanDepartment = String(department || "").trim();
    const cleanPurpose = String(purpose || "").trim();

    // Validate required fields
    if (!room_id || !email || !booking_date || !rawStartTime || !rawEndTime || !cleanPurpose) {
      return res.status(400).json({ message: ERROR_MESSAGES.MISSING_FIELDS });
    }

    // Normalize time format
    let startTime, endTime;
    try {
      startTime = normalizeAmPmTime(rawStartTime);
      endTime = normalizeAmPmTime(rawEndTime);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    if (endTime <= startTime) {
      return res.status(400).json({ message: ERROR_MESSAGES.INVALID_TIME_RANGE });
    }

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) {
      return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });
    }

    // Strict validation for booking creation
    try {
      const subscriptionInfo = await validateSubscription(company.id, "BOOKING", true);
      
      // Check if within booking limits
      if (!subscriptionInfo.withinLimits && subscriptionInfo.usage) {
        return res.status(403).json({ 
          message: ERROR_MESSAGES.BOOKING_UNAVAILABLE,
          code: "BOOKING_LIMIT_REACHED"
        });
      }

      console.log(`[BOOKING_ATTEMPT] Company: ${company.id}, Plan: ${subscriptionInfo.plan}`);
    } catch (error) {
      if (error.isSubscriptionIssue) {
        return res.status(403).json({
          message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
          code: error.code || "SUBSCRIPTION_ISSUE"
        });
      }
      throw error;
    }

    // Verify OTP
    const verified = await isOtpVerified(company.id, email);
    if (!verified) {
      return res.status(401).json({ message: ERROR_MESSAGES.OTP_REQUIRED });
    }

    // Check for time conflicts
    const hasConflict = await hasTimeConflict(company.id, room_id, booking_date, startTime, endTime);
    if (hasConflict) {
      return res.status(409).json({ message: ERROR_MESSAGES.SLOT_CONFLICT });
    }

    const room = await getRoomById(room_id);
    if (!room) {
      return res.status(404).json({ message: "Conference room not found" });
    }

    // Create booking
    const [insertResult] = await db.query(
      `INSERT INTO conference_bookings
       (company_id, room_id, booked_by, department, purpose,
        booking_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED')`,
      [company.id, room_id, email, cleanDepartment, cleanPurpose, booking_date, startTime, endTime]
    );

    const bookingId = insertResult.insertId;
    const bookingDetails = { booking_date, start_time: startTime, end_time: endTime, department: cleanDepartment, purpose: cleanPurpose };

    // Save team members
    const validMembers = Array.isArray(teamMembers)
      ? teamMembers.filter(m => m && m.id && m.name)
      : [];
    if (validMembers.length > 0) {
      await Promise.all(validMembers.map(m =>
        db.query(
          `INSERT INTO conference_booking_members (booking_id, employee_id, name, email) VALUES (?, ?, ?, ?)`,
          [bookingId, m.id, m.name, m.email || null]
        )
      ));
    }

    // Email organiser
    await sendBookingEmail(email, company, room, bookingDetails);

    // Email each team member
    for (const m of validMembers) {
      if (m.email) {
        await sendTeamMemberEmail(m.email, m.name, email, company, room, bookingDetails);
      }
    }

    console.log(`[BOOKING_SUCCESS] ID: ${bookingId}, Company: ${company.id}, Email: ${email}, Members: ${validMembers.length}`);

    res.json({ 
      message: "Booking confirmed successfully",
      bookingId: insertResult.insertId
    });
  } catch (error) {
    console.error("[PUBLIC][BOOK]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * POST /company/:slug/book-range - Book multiple dates at once (skip conflicts)
 */
router.post("/company/:slug/book-range", async (req, res) => {
  const conn = await db.getConnection();
  try {
    const slug = normalizeSlug(req.params.slug);
    const {
      room_id,
      booked_by,
      department,
      purpose = "",
      start_date,
      end_date,
      start_time: rawStartTime,
      end_time: rawEndTime,
      include_weekends = false,
      teamMembers = [],
    } = req.body;

    const email = normalizeEmail(booked_by);
    const cleanDepartment = String(department || "").trim();
    const cleanPurpose = String(purpose || "").trim();

    if (!room_id || !email || !start_date || !end_date || !rawStartTime || !rawEndTime || !cleanPurpose) {
      return res.status(400).json({ message: ERROR_MESSAGES.MISSING_FIELDS });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: ERROR_MESSAGES.INVALID_EMAIL });
    }

    let startTime, endTime;
    try {
      startTime = normalizeAmPmTime(rawStartTime);
      endTime   = normalizeAmPmTime(rawEndTime);
    } catch (e) { return res.status(400).json({ message: e.message }); }
    if (endTime <= startTime) return res.status(400).json({ message: ERROR_MESSAGES.INVALID_TIME_RANGE });

    const startD = new Date(start_date + "T12:00:00");
    const endD   = new Date(end_date   + "T12:00:00");
    if (endD < startD) return res.status(400).json({ message: "End date must be on or after start date" });

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });

    // Subscription check
    try {
      const sub = await validateSubscription(company.id, "BOOKING", true);
      if (!sub.withinLimits && sub.usage) {
        return res.status(403).json({ message: ERROR_MESSAGES.BOOKING_UNAVAILABLE, code: "BOOKING_LIMIT_REACHED" });
      }
    } catch (e) {
      if (e.isSubscriptionIssue) return res.status(403).json({ message: ERROR_MESSAGES.SERVICE_UNAVAILABLE, code: e.code });
      throw e;
    }

    // OTP check
    const verified = await isOtpVerified(company.id, email);
    if (!verified) return res.status(401).json({ message: ERROR_MESSAGES.OTP_REQUIRED });

    // Build candidate dates
    const dates = [];
    const cur = new Date(startD);
    while (cur <= endD) {
      const d = cur.getDay();
      if (include_weekends || (d !== 0 && d !== 6)) dates.push(cur.toLocaleDateString("en-CA"));
      cur.setDate(cur.getDate() + 1);
    }
    if (dates.length === 0) return res.status(400).json({ message: "No valid dates in the selected range" });

    const room = await getRoomById(room_id);
    if (!room) return res.status(404).json({ message: "Conference room not found" });

    const validMembers = Array.isArray(teamMembers) ? teamMembers.filter(m => m?.id && m?.name) : [];

    await conn.beginTransaction();
    const booked = [], skipped = [];
    const rangeBookingId = randomUUID();

    for (const booking_date of dates) {
      const [[conflict]] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM conference_bookings
         WHERE company_id=? AND room_id=? AND booking_date=? AND status='BOOKED'
         AND start_time < ? AND end_time > ?`,
        [company.id, room_id, booking_date, endTime, startTime]
      );
      if (conflict.cnt > 0) { skipped.push({ date: booking_date, reason: "Slot already booked" }); continue; }

      const [ins] = await conn.query(
        `INSERT INTO conference_bookings
         (range_booking_id, company_id, room_id, booked_by, department, purpose, booking_date, start_time, end_time, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED')`,
        [rangeBookingId, company.id, room_id, email, cleanDepartment, cleanPurpose, booking_date, startTime, endTime]
      );
      const bookingId = ins.insertId;
      for (const m of validMembers) {
        await conn.query(
          `INSERT INTO conference_booking_members (booking_id, employee_id, name, email) VALUES (?, ?, ?, ?)`,
          [bookingId, m.id, m.name, m.email || null]
        );
      }
      booked.push({ date: booking_date, id: bookingId });
    }
    await conn.commit();

    // Consolidated confirmation email
    if (booked.length > 0) {
      const fmtDate = (ds) => new Date(ds + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
      const rangeLabel = `${fmtDate(start_date)} → ${fmtDate(end_date)}`;
      const syntheticBooking = {
        booking_date: rangeLabel, start_time: startTime, end_time: endTime,
        department: cleanDepartment, purpose: cleanPurpose,
      };
      try {
        await sendBookingEmail(email, company, room, syntheticBooking);
        for (const m of validMembers) {
          if (m.email) await sendTeamMemberEmail(m.email, m.name, email, company, room, syntheticBooking);
        }
      } catch (mailErr) { console.error("[RANGE EMAIL]", mailErr.message); }
    }

    res.status(201).json({ total_booked: booked.length, total_skipped: skipped.length, range_booking_id: rangeBookingId, booked, skipped });
  } catch (err) {
    await conn.rollback();
    console.error("[PUBLIC][BOOK_RANGE]", err);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  } finally { conn.release(); }
});

/**
 * GET /company/:slug/employees/search - Search employees by name or department
 */
router.get("/company/:slug/employees/search", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const q    = (req.query.q || "").trim();

    const company = await getCompanyBySlug(slug);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const like = `%${q}%`;
    const [rows] = await db.execute(
      `SELECT id, name, email, department
       FROM company_employees
       WHERE company_id = ? AND is_active = 1
         AND (name LIKE ? OR department LIKE ?)
       ORDER BY name ASC
       LIMIT 20`,
      [company.id, like, like]
    );

    res.json(rows);
  } catch (err) {
    console.error("[CONF][EMP_SEARCH]", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /company/:slug/bookings/range/:rangeId - Fetch all days in a range group
 */
router.get("/company/:slug/bookings/range/:rangeId", async (req, res) => {
  try {
    const slug    = normalizeSlug(req.params.slug);
    const rangeId = req.params.rangeId;
    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const today    = todayIST.toISOString().split("T")[0];

    const company = await getCompanyBySlug(slug, "id");
    if (!company) return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });

    const [rows] = await db.query(
      `SELECT b.id, b.booking_date, b.start_time, b.end_time, b.status, b.room_id, r.room_name
       FROM conference_bookings b
       JOIN conference_rooms r ON r.id = b.room_id
       WHERE b.range_booking_id = ? AND b.company_id = ?
       ORDER BY b.booking_date ASC`,
      [rangeId, company.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Range not found" });

    const toStr = (d) => d instanceof Date ? d.toISOString().split("T")[0] : String(d).split("T")[0];
    const upcoming = rows.filter(r => toStr(r.booking_date) >= today && r.status === "BOOKED").length;
    res.json({ range_booking_id: rangeId, total: rows.length, upcoming_count: upcoming, bookings: rows.map(r => ({ ...r, booking_date: toStr(r.booking_date) })) });
  } catch (err) {
    console.error("[PUBLIC][GET_RANGE]", err);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * PATCH /company/:slug/bookings/range/:rangeId/cancel - Cancel all upcoming days in a range
 */
router.patch("/company/:slug/bookings/range/:rangeId/cancel", async (req, res) => {
  try {
    const slug    = normalizeSlug(req.params.slug);
    const rangeId = req.params.rangeId;
    const email   = normalizeEmail(req.body?.email || "");

    if (!email) return res.status(400).json({ message: "Email required" });

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });

    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const today    = todayIST.toISOString().split("T")[0];

    const [upcoming] = await db.query(
      `SELECT b.id, b.booking_date, b.booked_by, b.room_id, b.start_time, b.end_time
       FROM conference_bookings b
       WHERE b.range_booking_id = ? AND b.company_id = ?
         AND b.status = 'BOOKED' AND b.booking_date >= ?
       ORDER BY b.booking_date ASC`,
      [rangeId, company.id, today]
    );
    if (!upcoming.length) return res.status(404).json({ message: "No upcoming bookings to cancel in this range" });

    // Verify the requester owns this range
    if (upcoming[0].booked_by !== email) return res.status(403).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

    const ids = upcoming.map(b => b.id);
    const ph  = ids.map(() => "?").join(",");
    await db.query(`UPDATE conference_bookings SET status = 'CANCELLED' WHERE id IN (${ph})`, ids);

    const room    = await getRoomById(upcoming[0].room_id);
    const first   = upcoming[0];
    const last    = upcoming[upcoming.length - 1];
    const toDateStr = (d) => d instanceof Date ? d.toISOString().split("T")[0] : String(d).split("T")[0];
    const fmtD    = (d) => new Date(toDateStr(d) + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
    const syntheticBooking = {
      ...first,
      booking_date: toDateStr(first.booking_date) === toDateStr(last.booking_date) ? fmtD(first.booking_date) : `${fmtD(first.booking_date)} → ${fmtD(last.booking_date)}`,
    };

    const [members] = await db.query(
      `SELECT DISTINCT name, email FROM conference_booking_members WHERE booking_id IN (${ph}) AND email IS NOT NULL`,
      ids
    );

    try { await sendCancelEmail(email, company, room, syntheticBooking); } catch (e) { console.warn("[RANGE_CANCEL_EMAIL]", e.message); }
    for (const m of members) {
      if (m.email) try { await sendCancelEmail(m.email, company, room, { ...syntheticBooking, booked_by: email }); } catch {}
    }

    res.json({ message: `${ids.length} booking${ids.length !== 1 ? "s" : ""} cancelled`, cancelled_count: ids.length });
  } catch (err) {
    console.error("[PUBLIC][RANGE_CANCEL]", err);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * PATCH /company/:slug/bookings/range/:rangeId/reschedule - Change time/room for all upcoming days
 */
router.patch("/company/:slug/bookings/range/:rangeId/reschedule", async (req, res) => {
  const conn = await db.getConnection();
  try {
    const slug    = normalizeSlug(req.params.slug);
    const rangeId = req.params.rangeId;
    const { email, start_time: rawStartTime, end_time: rawEndTime, room_id } = req.body;

    const userEmail = normalizeEmail(email || "");
    if (!userEmail || !rawStartTime || !rawEndTime) return res.status(400).json({ message: "Email, start time and end time required" });

    let startTime, endTime;
    try {
      startTime = normalizeAmPmTime(rawStartTime);
      endTime   = normalizeAmPmTime(rawEndTime);
    } catch (e) { return res.status(400).json({ message: e.message }); }
    if (endTime <= startTime) return res.status(400).json({ message: ERROR_MESSAGES.INVALID_TIME_RANGE });

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });

    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const today    = todayIST.toISOString().split("T")[0];

    const [upcoming] = await db.query(
      `SELECT b.id, b.booking_date, b.booked_by, b.room_id, b.start_time, b.end_time
       FROM conference_bookings b
       WHERE b.range_booking_id = ? AND b.company_id = ?
         AND b.status = 'BOOKED' AND b.booking_date >= ?
       ORDER BY b.booking_date ASC`,
      [rangeId, company.id, today]
    );
    if (!upcoming.length) return res.status(404).json({ message: "No upcoming bookings to reschedule in this range" });
    if (upcoming[0].booked_by !== userEmail) return res.status(403).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

    const newRoomId = room_id ? Number(room_id) : upcoming[0].room_id;
    const room      = await getRoomById(newRoomId);
    if (!room) return res.status(404).json({ message: "Conference room not found" });

    await conn.beginTransaction();
    const conflicts = [];
    for (const b of upcoming) {
      const [[c]] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM conference_bookings
         WHERE company_id = ? AND room_id = ? AND booking_date = ? AND id <> ? AND status = 'BOOKED'
         AND start_time < ? AND end_time > ?`,
        [company.id, newRoomId, b.booking_date, b.id, endTime, startTime]
      );
      if (c.cnt > 0) { conflicts.push(b.booking_date); continue; }
      await conn.query(
        `UPDATE conference_bookings SET start_time = ?, end_time = ?, room_id = ? WHERE id = ?`,
        [startTime, endTime, newRoomId, b.id]
      );
    }
    await conn.commit();

    const rescheduled = upcoming.length - conflicts.length;
    const ids  = upcoming.map(b => b.id);
    const ph   = ids.map(() => "?").join(",");
    const [members] = await db.query(
      `SELECT DISTINCT name, email FROM conference_booking_members WHERE booking_id IN (${ph}) AND email IS NOT NULL`,
      ids
    );

    const first  = upcoming[0];
    const last   = upcoming[upcoming.length - 1];
    const fmtD   = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
    const syntheticBooking = {
      ...first, room_id: newRoomId, start_time: startTime, end_time: endTime,
      booking_date: first.booking_date === last.booking_date ? fmtD(first.booking_date) : `${fmtD(first.booking_date)} → ${fmtD(last.booking_date)}`,
    };

    try { await sendUpdateEmail(userEmail, company, room, syntheticBooking); } catch (e) { console.warn("[RANGE_RS_EMAIL]", e.message); }
    for (const m of members) {
      if (m.email) try { await sendUpdateEmail(m.email, company, room, syntheticBooking); } catch {}
    }

    res.json({ message: `${rescheduled} booking${rescheduled !== 1 ? "s" : ""} rescheduled`, rescheduled_count: rescheduled, skipped_dates: conflicts });
  } catch (err) {
    await conn.rollback();
    console.error("[PUBLIC][RANGE_RESCHEDULE]", err);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  } finally { conn.release(); }
});

/**
 * PATCH /company/:slug/bookings/:id - Update booking time (strict validation)
 */
router.patch("/company/:slug/bookings/:id", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const bookingId = Number(req.params.id);
    const {
      start_time: rawStartTime,
      end_time: rawEndTime,
      email
    } = req.body;

    const userEmail = normalizeEmail(email);

    if (!userEmail || !rawStartTime || !rawEndTime) {
      return res.status(400).json({ message: "Email, start time and end time required" });
    }

    // Normalize time format
    let startTime, endTime;
    try {
      startTime = normalizeAmPmTime(rawStartTime);
      endTime = normalizeAmPmTime(rawEndTime);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    if (endTime <= startTime) {
      return res.status(400).json({ message: ERROR_MESSAGES.INVALID_TIME_RANGE });
    }

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) {
      return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });
    }

    // Validate subscription for modifications
    try {
      await validateSubscription(company.id, "ACCESS", true);
    } catch (error) {
      if (error.isSubscriptionIssue) {
        return res.status(403).json({
          message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
          code: error.code || "SUBSCRIPTION_ISSUE"
        });
      }
      throw error;
    }

    // Fetch booking
    const [[booking]] = await db.query(
      `SELECT * FROM conference_bookings
       WHERE id = ? AND company_id = ? AND status = 'BOOKED'
       LIMIT 1`,
      [bookingId, company.id]
    );

    if (!booking) {
      return res.status(404).json({ message: ERROR_MESSAGES.BOOKING_NOT_FOUND });
    }

    if (booking.booked_by !== userEmail) {
      return res.status(403).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
    }

    // Check for time conflicts (excluding current booking)
    const hasConflict = await hasTimeConflict(
      company.id,
      booking.room_id,
      booking.booking_date,
      startTime,
      endTime,
      bookingId
    );

    if (hasConflict) {
      return res.status(409).json({ message: ERROR_MESSAGES.TIME_CONFLICT });
    }

    // Update booking
    await db.query(
      `UPDATE conference_bookings SET start_time = ?, end_time = ? WHERE id = ?`,
      [startTime, endTime, bookingId]
    );

    const room = await getRoomById(booking.room_id);
    const updatedBooking = { ...booking, start_time: startTime, end_time: endTime };

    await sendUpdateEmail(userEmail, company, room, updatedBooking);

    // Email team members
    const [members] = await db.query(
      `SELECT name, email FROM conference_booking_members WHERE booking_id = ?`,
      [bookingId]
    );
    for (const m of members) {
      if (m.email) {
        try { await sendUpdateEmail(m.email, company, room, updatedBooking); }
        catch (e) { console.warn("[RESCHEDULE_MEMBER_EMAIL]", e.message); }
      }
    }

    console.log(`[BOOKING_UPDATED] ID: ${bookingId}`);

    res.json({ 
      message: "Booking updated successfully"
    });
  } catch (error) {
    console.error("[PUBLIC][UPDATE]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * PATCH /company/:slug/bookings/:id/cancel - Cancel booking (graceful validation)
 */
router.patch("/company/:slug/bookings/:id/cancel", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const bookingId = Number(req.params.id);
    const email = normalizeEmail(req.body?.email || "");

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) {
      return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });
    }

    // Allow cancellation even with subscription issues (graceful)
    try {
      await validateSubscription(company.id, "ACCESS", false);
    } catch (error) {
      console.warn(`[CANCEL_DEGRADED_ACCESS] ${company.id}:`, error.message);
      // Allow cancellation to proceed for user convenience
    }

    // Fetch booking
    const [[booking]] = await db.query(
      `SELECT * FROM conference_bookings
       WHERE id = ? AND company_id = ? AND status = 'BOOKED'
       LIMIT 1`,
      [bookingId, company.id]
    );

    if (!booking) {
      return res.status(404).json({ message: ERROR_MESSAGES.BOOKING_NOT_FOUND });
    }

    if (booking.booked_by !== email) {
      return res.status(403).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
    }

    // Cancel booking
    await db.query(
      `UPDATE conference_bookings SET status = 'CANCELLED' WHERE id = ?`,
      [bookingId]
    );

    const room = await getRoomById(booking.room_id);

    // Fetch team members before cancellation record is gone
    const [members] = await db.query(
      `SELECT name, email FROM conference_booking_members WHERE booking_id = ?`,
      [bookingId]
    );

    try {
      await sendCancelEmail(email, company, room, booking);
    } catch (emailError) {
      console.warn("[CANCEL_EMAIL_WARNING]", emailError.message);
    }

    // Email each team member about the cancellation
    for (const m of members) {
      if (m.email) {
        try { await sendCancelEmail(m.email, company, room, { ...booking, booked_by: email }); }
        catch (e) { console.warn("[CANCEL_MEMBER_EMAIL]", e.message); }
      }
    }

    console.log(`[BOOKING_CANCELLED] ID: ${bookingId}, Company: ${company.id}`);

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("[PUBLIC][CANCEL]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

router.patch("/company/:slug/bookings/:id/extend", async (req, res) => {
  try {
    const slug      = normalizeSlug(req.params.slug);
    const bookingId = Number(req.params.id);
    const email     = normalizeEmail(req.body?.email || "");
    const extra     = Number(req.body?.extra_minutes);

    if (!email) return res.status(400).json({ message: "Email required" });
    if (![15, 30, 60].includes(extra)) return res.status(400).json({ message: "extra_minutes must be 15, 30, or 60" });

    const company = await getCompanyBySlug(slug, "id, name, logo_url");
    if (!company) return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });

    const [[booking]] = await db.query(
      `SELECT * FROM conference_bookings WHERE id = ? AND company_id = ? AND status = 'BOOKED' LIMIT 1`,
      [bookingId, company.id]
    );
    if (!booking) return res.status(404).json({ message: ERROR_MESSAGES.BOOKING_NOT_FOUND });
    if (booking.booked_by !== email) return res.status(403).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const today  = nowIST.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const bDate  = new Date(booking.booking_date).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const toMin  = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
    const nowMin = nowIST.getHours() * 60 + nowIST.getMinutes();
    const sMin   = toMin(booking.start_time), eMin = toMin(booking.end_time);

    if (bDate !== today || sMin > nowMin || eMin <= nowMin) {
      return res.status(400).json({ message: "Can only extend a booking that is currently in progress" });
    }

    const newEndMin  = eMin + extra;
    const newEndH    = Math.floor(newEndMin / 60);
    const newEndM    = newEndMin % 60;
    const newEndTime = `${String(newEndH).padStart(2,"0")}:${String(newEndM).padStart(2,"0")}:00`;

    const [[conflict]] = await db.query(
      `SELECT id FROM conference_bookings
       WHERE company_id = ? AND room_id = ? AND booking_date = ? AND id != ?
         AND status = 'BOOKED' AND start_time < ? AND end_time > ?
       LIMIT 1`,
      [company.id, booking.room_id, today, bookingId, newEndTime, booking.end_time]
    );
    if (conflict) return res.status(409).json({ message: `Cannot extend — another booking starts before the new end time` });

    await db.query(`UPDATE conference_bookings SET end_time = ? WHERE id = ?`, [newEndTime, bookingId]);
    res.json({ message: `Extended by ${extra} minutes`, new_end_time: newEndTime });
  } catch (error) {
    console.error("[PUBLIC][EXTEND]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

router.get("/company/:slug/rooms/bookings/range", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) return res.status(400).json({ message: "start_date and end_date required" });

    const company = await getCompanyBySlug(slug, "id");
    if (!company) return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });

    const [rows] = await db.query(
      `SELECT cb.room_id, cb.booking_date, cb.start_time, cb.end_time,
              cb.booked_by, cb.purpose, cb.department,
              COALESCE(ce.name, '') AS employee_name
       FROM conference_bookings cb
       LEFT JOIN company_employees ce
         ON ce.company_id = ? AND LOWER(ce.email) = LOWER(cb.booked_by) AND ce.is_active = 1
       WHERE cb.company_id = ? AND cb.booking_date BETWEEN ? AND ? AND cb.status = 'BOOKED'
       ORDER BY cb.booking_date ASC, cb.start_time ASC`,
      [company.id, company.id, start_date, end_date]
    );

    // Attach team members
    const bookingIds = rows.map(r => r.id).filter(Boolean);
    const memberMap = {};
    if (bookingIds.length > 0) {
      const phM = bookingIds.map(() => "?").join(",");
      const [mems] = await db.query(
        `SELECT booking_id, name, email FROM conference_booking_members WHERE booking_id IN (${phM})`,
        bookingIds
      );
      for (const m of mems) {
        if (!memberMap[m.booking_id]) memberMap[m.booking_id] = [];
        memberMap[m.booking_id].push({ name: m.name, email: m.email });
      }
    }

    res.json(rows.map(b => ({
      room_id:         b.room_id,
      booking_date:    b.booking_date instanceof Date
        ? b.booking_date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        : String(b.booking_date).split("T")[0],
      start_time:      b.start_time,
      end_time:        b.end_time,
      booked_by:       b.employee_name || b.booked_by,
      booked_by_email: b.booked_by,
      purpose:         b.purpose || null,
      department:      b.department || null,
      team_members:    memberMap[b.id] || [],
    })));
  } catch (err) {
    console.error("[PUBLIC][RANGE]", err.message);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

export default router;
