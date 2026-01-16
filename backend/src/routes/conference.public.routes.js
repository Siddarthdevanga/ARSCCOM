import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

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
  PLAN_EXCEEDED: "Plan validity exceeded. Contact Administrator",
  TRIAL_EXPIRED: "Your trial period has expired. Please upgrade to continue using conference booking services.",
  SUBSCRIPTION_EXPIRED: "Your subscription has expired. Please renew to continue using conference booking services.",
  SUBSCRIPTION_INACTIVE: "Subscription inactive. Please activate your subscription to continue.",
  BOOKING_LIMIT_REACHED: "Booking limit reached for your current plan. Please upgrade to book more conferences.",
  ROOM_LIMIT_REACHED: "Room limit reached for your current plan. Please upgrade to add more rooms.",
  SERVER_ERROR: "Server error occurred"
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
const emailFooter = (company) => `
<br/>
<br/>
Regards,<br/>
<b>${company.name}</b><br/>
${company.logo_url ? `<img src="${company.logo_url}" alt="${company.name} Logo" height="55" />` : ""}
<hr/>
<p style="font-size:13px;color:#666;margin-top:15px;">
This email was automatically sent from the Conference Room Booking Platform.
If you did not perform this action, please contact your administrator immediately.
</p>
`;

const sendOtpEmail = async (email, otp, company) => {
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
      ${emailFooter(company)}
    `
  });
};

const sendBookingEmail = async (email, company, room, booking) => {
  await sendEmail({
    to: email,
    subject: `Booking Confirmed – ${room.room_name} | ${company.name}`,
    html: `
      <h2 style="color:#4CAF50;">✓ Booking Confirmed</h2>
      <h3>${company.name}</h3>

      <table style="border-collapse:collapse;margin:20px 0;font-size:15px;width:100%;max-width:500px;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;width:140px;">Room</td>
          <td style="padding:10px;">${room.room_name} (#${room.room_number})</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;">Date</td>
          <td style="padding:10px;">${booking.booking_date}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;">Time</td>
          <td style="padding:10px;">${prettyTime(booking.start_time)} – ${prettyTime(booking.end_time)}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;">Department</td>
          <td style="padding:10px;">${booking.department}</td>
        </tr>
        <tr>
          <td style="padding:10px;font-weight:bold;">Purpose</td>
          <td style="padding:10px;">${booking.purpose || "—"}</td>
        </tr>
      </table>
      ${emailFooter(company)}
    `
  });
};

const sendUpdateEmail = async (email, company, room, booking) => {
  await sendEmail({
    to: email,
    subject: `Booking Updated – ${room.room_name} | ${company.name}`,
    html: `
      <h2 style="color:#2196F3;">Booking Updated</h2>
      <h3>${company.name}</h3>
      <p>Your conference room booking has been successfully updated.</p>

      <table style="border-collapse:collapse;margin:20px 0;font-size:15px;width:100%;max-width:500px;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;width:140px;">Room</td>
          <td style="padding:10px;">${room.room_name} (#${room.room_number})</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;">Date</td>
          <td style="padding:10px;">${booking.booking_date}</td>
        </tr>
        <tr>
          <td style="padding:10px;font-weight:bold;">New Time</td>
          <td style="padding:10px;">${prettyTime(booking.start_time)} – ${prettyTime(booking.end_time)}</td>
        </tr>
      </table>
      ${emailFooter(company)}
    `
  });
};

const sendCancelEmail = async (email, company, room, booking) => {
  await sendEmail({
    to: email,
    subject: `Booking Cancelled – ${room.room_name} | ${company.name}`,
    html: `
      <h2 style="color:#f44336;">Booking Cancelled</h2>
      <h3>${company.name}</h3>
      <p>Your conference room booking has been cancelled.</p>

      <table style="border-collapse:collapse;margin:20px 0;font-size:15px;width:100%;max-width:500px;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;width:140px;">Room</td>
          <td style="padding:10px;">${room.room_name} (#${room.room_number})</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;font-weight:bold;">Date</td>
          <td style="padding:10px;">${booking.booking_date}</td>
        </tr>
        <tr>
          <td style="padding:10px;font-weight:bold;">Time</td>
          <td style="padding:10px;">${prettyTime(booking.start_time)} – ${prettyTime(booking.end_time)}</td>
        </tr>
      </table>
      ${emailFooter(company)}
    `
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
    `SELECT room_name, room_number FROM conference_rooms WHERE id = ? LIMIT 1`,
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
   ENHANCED PLAN VALIDATION
====================================================== */

/**
 * Comprehensive subscription and plan validation
 * @throws {Error} If subscription is expired or plan limits exceeded
 */
const validateSubscriptionAndPlan = async (companyId, operation = "BOOKING") => {
  console.log(`[PLAN_CHECK] Validating ${operation} for company:`, companyId);

  const [[company]] = await db.query(
    `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at
     FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );

  if (!company) {
    throw new Error(ERROR_MESSAGES.PLAN_EXCEEDED);
  }

  const plan = (company.plan || "TRIAL").toUpperCase();
  const status = (company.subscription_status || "PENDING").toUpperCase();
  const now = new Date();

  console.log(`[PLAN_CHECK] Plan: ${plan}, Status: ${status}`);

  // Check subscription status first
  if (status === "EXPIRED") {
    const error = new Error(ERROR_MESSAGES.SUBSCRIPTION_EXPIRED);
    error.code = "SUBSCRIPTION_EXPIRED";
    error.redirectTo = "/auth/subscription";
    throw error;
  }

  if (!["ACTIVE", "TRIAL"].includes(status)) {
    const error = new Error(ERROR_MESSAGES.SUBSCRIPTION_INACTIVE);
    error.code = "SUBSCRIPTION_INACTIVE";
    error.redirectTo = "/auth/subscription";
    throw error;
  }

  // Handle TRIAL plan
  if (plan === "TRIAL") {
    if (!company.trial_ends_at) {
      const error = new Error("Trial not initialized. Please contact support.");
      error.code = "TRIAL_NOT_INITIALIZED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    const trialEndsDate = new Date(company.trial_ends_at);
    if (trialEndsDate < now) {
      const error = new Error(ERROR_MESSAGES.TRIAL_EXPIRED);
      error.code = "TRIAL_EXPIRED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    // Check trial limits
    await validatePlanLimits(companyId, plan, operation);
    return { plan, status, limits: PLAN_LIMITS[plan] };
  }

  // Handle BUSINESS plan
  if (plan === "BUSINESS") {
    if (!company.subscription_ends_at) {
      const error = new Error("Subscription not properly initialized. Please contact support.");
      error.code = "SUBSCRIPTION_NOT_INITIALIZED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    const subEndsDate = new Date(company.subscription_ends_at);
    if (subEndsDate < now) {
      const error = new Error(ERROR_MESSAGES.SUBSCRIPTION_EXPIRED);
      error.code = "SUBSCRIPTION_EXPIRED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    // Check business limits
    await validatePlanLimits(companyId, plan, operation);
    return { plan, status, limits: PLAN_LIMITS[plan] };
  }

  // ENTERPRISE has no limits but still check subscription
  if (plan === "ENTERPRISE") {
    if (!company.subscription_ends_at) {
      const error = new Error("Enterprise subscription not properly initialized. Please contact support.");
      error.code = "SUBSCRIPTION_NOT_INITIALIZED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    const subEndsDate = new Date(company.subscription_ends_at);
    if (subEndsDate < now) {
      const error = new Error(`${plan} subscription has expired. Please renew your subscription.`);
      error.code = "SUBSCRIPTION_EXPIRED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    return { plan, status, limits: PLAN_LIMITS[plan] };
  }

  // Unknown plan
  const error = new Error("Unknown subscription plan. Please contact support.");
  error.code = "UNKNOWN_PLAN";
  error.redirectTo = "/auth/subscription";
  throw error;
};

/**
 * Validates specific plan limits
 */
const validatePlanLimits = async (companyId, plan, operation) => {
  const limits = PLAN_LIMITS[plan];
  if (!limits || plan === "ENTERPRISE") return;

  console.log(`[PLAN_LIMITS] Checking ${operation} limits for ${plan}:`, limits);

  // Check total booking limit
  if (operation === "BOOKING" && limits.bookings !== Infinity) {
    const [[bookingCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? AND status = 'BOOKED'`,
      [companyId]
    );

    console.log(`[PLAN_LIMITS] Current bookings: ${bookingCount.total}/${limits.bookings}`);

    if (bookingCount.total >= limits.bookings) {
      const error = new Error(ERROR_MESSAGES.BOOKING_LIMIT_REACHED);
      error.code = "BOOKING_LIMIT_REACHED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }
  }

  // Check room limit
  if (operation === "ROOM" && limits.rooms !== Infinity) {
    const [[roomCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    console.log(`[PLAN_LIMITS] Current rooms: ${roomCount.total}/${limits.rooms}`);

    if (roomCount.total >= limits.rooms) {
      const error = new Error(ERROR_MESSAGES.ROOM_LIMIT_REACHED);
      error.code = "ROOM_LIMIT_REACHED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }
  }
};

/* ======================================================
   ROUTE HANDLERS
====================================================== */

/**
 * GET /company/:slug - Fetch company details
 */
router.get("/company/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug);

    if (!company) {
      return res.status(404).json({ message: ERROR_MESSAGES.INVALID_LINK });
    }

    // Validate subscription for company details access
    try {
      const { plan, status, limits } = await validateSubscriptionAndPlan(company.id, "ACCESS");
      
      res.json({
        ...company,
        planInfo: {
          plan,
          status,
          limits: {
            bookings: limits.bookings === Infinity ? "Unlimited" : limits.bookings,
            rooms: limits.rooms === Infinity ? "Unlimited" : limits.rooms
          }
        }
      });
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("[PUBLIC][COMPANY]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * GET /company/:slug/rooms - Fetch available rooms (plan protected)
 */
router.get("/company/:slug/rooms", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const company = await getCompanyBySlug(slug, "id");

    if (!company) {
      return res.json([]);
    }

    // Validate subscription and plan
    try {
      await validateSubscriptionAndPlan(company.id, "ROOM");
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      return res.status(403).json({ message: error.message });
    }

    const [rooms] = await db.query(
      `SELECT id, room_name, room_number
       FROM conference_rooms
       WHERE company_id = ?
       ORDER BY room_number ASC`,
      [company.id]
    );

    res.json(rooms || []);
  } catch (error) {
    console.error("[PUBLIC][ROOMS]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

/**
 * GET /company/:slug/bookings - Fetch bookings for a room and date
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

    // Validate subscription
    try {
      await validateSubscriptionAndPlan(company.id, "ACCESS");
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      return res.status(403).json({ message: error.message });
    }

    const normalizedUserEmail = normalizeEmail(userEmail || "");

    const [bookings] = await db.query(
      `SELECT id, room_id, booking_date, start_time, end_time,
              department, booked_by, purpose
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
 * POST /company/:slug/send-otp - Send OTP to email
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

    // Validate subscription
    try {
      await validateSubscriptionAndPlan(company.id, "ACCESS");
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      return res.status(403).json({ message: error.message });
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

    console.log(`[OTP_SENT] Company: ${company.id}, Email: ${email}, OTP: ${otp}`);

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("[PUBLIC][SEND_OTP]", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/**
 * POST /company/:slug/verify-otp - Verify OTP
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

    // Validate subscription
    try {
      await validateSubscriptionAndPlan(company.id, "ACCESS");
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      return res.status(403).json({ message: error.message });
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
 * POST /company/:slug/book - Create a new booking (comprehensive plan protection)
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
      end_time: rawEndTime
    } = req.body;

    const email = normalizeEmail(booked_by);
    const cleanDepartment = String(department || "").trim();
    const cleanPurpose = String(purpose || "").trim();

    // Validate required fields
    if (!room_id || !email || !cleanDepartment || !booking_date || !rawStartTime || !rawEndTime) {
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

    // Comprehensive plan validation
    try {
      const { plan } = await validateSubscriptionAndPlan(company.id, "BOOKING");
      console.log(`[BOOKING_ATTEMPT] Company: ${company.id}, Plan: ${plan}`);
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      return res.status(403).json({ message: error.message });
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

    await sendBookingEmail(email, company, room, {
      booking_date,
      start_time: startTime,
      end_time: endTime,
      department: cleanDepartment,
      purpose: cleanPurpose
    });

    console.log(`[BOOKING_SUCCESS] ID: ${insertResult.insertId}, Company: ${company.id}, Email: ${email}`);

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
 * PATCH /company/:slug/bookings/:id - Update booking time (plan protected)
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

    // Validate subscription
    try {
      await validateSubscriptionAndPlan(company.id, "BOOKING");
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      return res.status(403).json({ message: error.message });
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

    await sendUpdateEmail(userEmail, company, room, {
      booking_date: booking.booking_date,
      start_time: startTime,
      end_time: endTime
    });

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
 * PATCH /company/:slug/bookings/:id/cancel - Cancel booking (subscription protected)
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

    // Validate subscription (even for cancellation)
    try {
      await validateSubscriptionAndPlan(company.id, "ACCESS");
    } catch (error) {
      if (error.code && error.redirectTo) {
        return res.status(403).json({
          message: error.message,
          code: error.code,
          redirectTo: error.redirectTo
        });
      }
      return res.status(403).json({ message: error.message });
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

    await sendCancelEmail(email, company, room, booking);

    console.log(`[BOOKING_CANCELLED] ID: ${bookingId}, Company: ${company.id}`);

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("[PUBLIC][CANCEL]", error);
    res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
});

export default router;
