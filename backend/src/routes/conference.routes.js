import express from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { getPresignedUrl, uploadToS3, deleteFromS3 } from "../services/s3.service.js";
import QRCode from "qrcode";
import { createCanvas, loadImage, registerFont } from "canvas";

const roomImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Only image files are allowed"));
  },
});

const router = express.Router();

/* ======================================================
   PLAN CONFIGURATION (matches database enum: lowercase)
====================================================== */
const PLANS = {
  trial: { rooms: 2, bookings: 100 },
  business: { rooms: 6, bookings: 1000 },
  enterprise: { rooms: Infinity, bookings: Infinity },
};

const ACTIVE_STATUSES = ["active", "trial", "grace_period"];

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
   BRANDED QR CODE GENERATION
====================================================== */

/**
 * Draw company name in header with auto font-size shrink + two-line wrap.
 * Returns the actual pixel height used so callers can adjust layout if needed.
 */
const drawCompanyNameInHeader = (ctx, companyName, canvasWidth, headerHeight) => {
  const maxWidth = canvasWidth - 80; // 40px padding each side
  const nameUpper = companyName.toUpperCase();

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";

  /* ── Step 1: try to fit on one line, shrinking from 48 → 24 px ── */
  let fontSize = 48;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  while (ctx.measureText(nameUpper).width > maxWidth && fontSize > 24) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  }

  if (ctx.measureText(nameUpper).width <= maxWidth) {
    // Fits on one line — vertically centre inside header
    ctx.fillText(nameUpper, canvasWidth / 2, headerHeight / 2 + fontSize / 3);
    return;
  }

  /* ── Step 2: wrap into two lines ── */
  const words = nameUpper.split(" ");

  // Try every split point and pick the one whose longest line is shortest
  let bestSplit = Math.ceil(words.length / 2);
  let bestMaxW = Infinity;

  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    fontSize = 36;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    const maxW = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width);
    if (maxW < bestMaxW) {
      bestMaxW = maxW;
      bestSplit = i;
    }
  }

  const line1 = words.slice(0, bestSplit).join(" ");
  const line2 = words.slice(bestSplit).join(" ");

  // Shrink font until both lines fit
  fontSize = 36;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  while (
    Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) > maxWidth &&
    fontSize > 16
  ) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  }

  const lineGap = fontSize + 8;
  const totalTextH = lineGap * 2;
  const startY = (headerHeight - totalTextH) / 2 + fontSize;

  ctx.fillText(line1, canvasWidth / 2, startY);
  ctx.fillText(line2, canvasWidth / 2, startY + lineGap);
};

/**
 * Generate a branded QR code image with company branding.
 * Similar to the reference design with company name header.
 */
const generateBrandedQRCode = async (url, companyName, isConference = true) => {
  try {
    // Canvas dimensions
    const width = 800;
    const height = 1000;
    const headerHeight = 120;

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background - White
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    // Header - Purple gradient
    const gradient = ctx.createLinearGradient(0, 0, width, headerHeight);
    gradient.addColorStop(0, "#6a1b9a");
    gradient.addColorStop(1, "#8e24aa");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, headerHeight);

    // ── Company Name (auto-fit, no clipping) ──
    drawCompanyNameInHeader(ctx, companyName, width, headerHeight);

    // Title
    ctx.fillStyle = "#6a1b9a";
    ctx.font = "bold 36px Arial, sans-serif";
    ctx.textAlign = "center";
    const title = isConference ? "Conference Room Booking" : "Visitor Registration";
    ctx.fillText(title, width / 2, 180);

    // Subtitle
    ctx.fillStyle = "#666666";
    ctx.font = "20px Arial, sans-serif";
    ctx.fillText("Scan QR Code or Visit:", width / 2, 230);

    // URL (truncate if too long)
    ctx.fillStyle = "#7a00ff";
    ctx.font = "bold 18px Arial, sans-serif";
    const maxUrlWidth = width - 100;
    let displayUrl = url;

    if (ctx.measureText(displayUrl).width > maxUrlWidth) {
      while (
        ctx.measureText(displayUrl + "...").width > maxUrlWidth &&
        displayUrl.length > 20
      ) {
        displayUrl = displayUrl.substring(0, displayUrl.length - 1);
      }
      displayUrl += "...";
    }
    ctx.fillText(displayUrl, width / 2, 265);

    // Generate QR code
    const qrSize = 400;
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: qrSize,
      margin: 0,
      color: {
        dark: "#6a1b9a",  // Purple QR code
        light: "#FFFFFF",
      },
    });

    // Load and draw QR code
    const qrImage = await loadImage(qrCodeDataUrl);
    const qrX = (width - qrSize) / 2;
    const qrY = 300;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    // Instructions section
    const instructionsY = qrY + qrSize + 50;

    ctx.fillStyle = "#6a1b9a";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      "Instructions for " + (isConference ? "Employees:" : "Visitors:"),
      80,
      instructionsY
    );

    // Instruction items
    ctx.fillStyle = "#333333";
    ctx.font = "18px Arial, sans-serif";
    const instructions = isConference
      ? [
          "1. Scan the QR code with your phone camera",
          "2. Or visit the URL above in your browser",
          "3. Authenticate with OTP",
          "4. Select available room and time slot",
          "5. Complete the booking form",
          "6. Receive booking confirmation via email",
        ]
      : [
          "1. Scan the QR code with your phone camera",
          "2. Or visit the URL above in your browser",
          "3. Enter your email to receive verification code",
          "4. Complete the registration form",
          "5. Capture your photo",
          "6. Receive your digital visitor pass via email",
        ];

    let instructionY = instructionsY + 35;
    instructions.forEach((instruction) => {
      ctx.fillText(instruction, 80, instructionY);
      instructionY += 30;
    });

    // Footer
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(0, height - 80, width, 80);

    ctx.fillStyle = "#7a00ff";
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PROMEET", width / 2, height - 45);

    ctx.fillStyle = "#666666";
    ctx.font = "16px Arial, sans-serif";
    ctx.fillText(
      isConference
        ? "Conference Booking Platform"
        : "Visitor and Conference Booking Platform",
      width / 2,
      height - 20
    );

    return canvas.toBuffer("image/png");
  } catch (error) {
    console.error("[generateBrandedQRCode]", error);
    throw error;
  }
};

/* ======================================================
   EMAIL FUNCTIONS
====================================================== */

/* ── Email helpers (match public template style) ── */

const emailFooter = (company = {}, logoUrl = null) => `
  <div style="padding:20px 28px;border-top:1px solid #ede9fe;background:#faf5ff;">
    ${logoUrl ? `<img src="${logoUrl}" height="40" alt="${company.name || ""}" style="display:block;margin-bottom:10px;" />` : ""}
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1f2937;">${company.name || ""}</p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      This email was sent automatically by the Conference Room Booking Platform.<br/>
      If you did not expect this email, please contact your administrator.
    </p>
  </div>
`;

const roomImageBlock = (imageUrl, roomName) =>
  imageUrl
    ? `<img src="${imageUrl}" alt="${roomName}" style="width:100%;max-width:560px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;margin:0 auto 20px;" />`
    : `<div style="width:100%;max-width:560px;aspect-ratio:16/9;background:linear-gradient(135deg,#6c2bd9,#a78bfa);border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;min-height:140px;">
         <span style="color:#fff;font-size:36px;font-weight:800;letter-spacing:1px;">${(roomName || "R").charAt(0).toUpperCase()}</span>
       </div>`;

const bookingTable = (booking, accentColor = "#6c2bd9") => `
  <table style="border-collapse:collapse;width:100%;max-width:560px;border-radius:8px;overflow:hidden;border:1px solid #ede9fe;font-size:14px;">
    <tr style="background:${accentColor};">
      <td colspan="2" style="padding:10px 14px;font-weight:700;font-size:15px;color:#fff;">Booking Summary</td>
    </tr>
    <tr style="border-bottom:1px solid #ede9fe;">
      <td style="padding:10px 14px;font-weight:600;color:#6b7280;width:130px;">Room</td>
      <td style="padding:10px 14px;color:#1f2937;font-weight:600;">${booking?.room_name || "N/A"}</td>
    </tr>
    <tr style="border-bottom:1px solid #ede9fe;background:#faf5ff;">
      <td style="padding:10px 14px;font-weight:600;color:#6b7280;">Date</td>
      <td style="padding:10px 14px;color:#1f2937;">${booking?.booking_date || "N/A"}</td>
    </tr>
    <tr style="border-bottom:1px solid #ede9fe;">
      <td style="padding:10px 14px;font-weight:600;color:#6b7280;">Time</td>
      <td style="padding:10px 14px;color:#1f2937;font-weight:600;">${toAmPm(booking?.start_time)} &ndash; ${toAmPm(booking?.end_time)}</td>
    </tr>
    ${booking?.department ? `<tr style="border-bottom:1px solid #ede9fe;background:#faf5ff;"><td style="padding:10px 14px;font-weight:600;color:#6b7280;">Department</td><td style="padding:10px 14px;color:#1f2937;">${booking.department}</td></tr>` : ""}
    ${booking?.purpose ? `<tr style="border-bottom:1px solid #ede9fe;"><td style="padding:10px 14px;font-weight:600;color:#6b7280;">Purpose</td><td style="padding:10px 14px;color:#1f2937;">${booking.purpose}</td></tr>` : ""}
    <tr style="background:#faf5ff;">
      <td style="padding:10px 14px;font-weight:600;color:#6b7280;">Status</td>
      <td style="padding:10px 14px;font-weight:700;color:${accentColor};">${booking?.status || "N/A"}</td>
    </tr>
  </table>`;

/* Color scheme per action */
const ACTION_THEME = {
  CONFIRMED:   { bg1: "#6c2bd9", bg2: "#7c3aed", sub: "#ddd6fe", border: "#ede9fe", label: "Your conference room is reserved" },
  RESCHEDULED: { bg1: "#1d4ed8", bg2: "#3b82f6", sub: "#dbeafe", border: "#e0f2fe", label: "Your booking details have changed" },
  CANCELLED:   { bg1: "#b91c1c", bg2: "#ef4444", sub: "#fee2e2", border: "#fee2e2", label: "Your conference room booking has been cancelled" },
};

const buildEmailHtml = (heading, subtext, booking, roomImageUrl, company, logoUrl, accentColor, border) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid ${border};">
    <div style="background:linear-gradient(135deg,${accentColor[0]},${accentColor[1]});padding:24px 28px;">
      <div style="color:${accentColor[2]};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${company?.name || ""}</div>
      <h1 style="color:#fff;margin:0;font-size:22px;">${heading}</h1>
      <p style="color:${accentColor[2]};margin:6px 0 0;font-size:14px;">${subtext}</p>
    </div>
    <div style="padding:24px 28px;">
      ${roomImageBlock(roomImageUrl, booking?.room_name || "Room")}
      ${bookingTable(booking, accentColor[0])}
    </div>
    ${emailFooter(company, logoUrl)}
  </div>`;

const sendBookingMail = async ({
  adminEmail,
  userEmail,
  subject,
  heading,
  booking,
  company,
  teamMembers = [],
  roomImageUrl = null,
}) => {
  try {
    const toEmail = isEmail(userEmail) ? userEmail : isEmail(adminEmail) ? adminEmail : null;
    if (!toEmail) { console.warn("[EMAIL] No valid recipient"); return; }

    subject = subject || "Conference Room Notification";
    heading = heading || "Conference Room Update";

    const logoUrl = company?.logo_url ? await getPresignedUrl(company.logo_url, 3600) : null;
    const status  = (booking?.status || "CONFIRMED").toUpperCase();
    const theme   = ACTION_THEME[status] || ACTION_THEME.CONFIRMED;
    const accent  = [theme.bg1, theme.bg2, theme.sub];

    const html = buildEmailHtml(heading, theme.label, booking, roomImageUrl, company, logoUrl, accent, theme.border);

    await sendEmail({
      to: toEmail,
      cc: isEmail(adminEmail) && adminEmail !== toEmail ? adminEmail : undefined,
      subject,
      html,
    });

    // Team member emails
    for (const m of teamMembers) {
      if (!m?.email) continue;
      const memberHeading = status === "CANCELLED" ? "Meeting Cancelled" : status === "RESCHEDULED" ? "Meeting Rescheduled" : "You've Been Added to a Meeting";
      const memberSub = `Hi ${m.name} — ${toEmail} has ${status === "CANCELLED" ? "cancelled" : status === "RESCHEDULED" ? "rescheduled" : "invited you to"} a meeting at ${company?.name || ""}`;
      const memberThemeToUse = ACTION_THEME[status] || ACTION_THEME.CONFIRMED;
      const memberAccentToUse = [memberThemeToUse.bg1, memberThemeToUse.bg2, memberThemeToUse.sub];
      const memberHtml = buildEmailHtml(memberHeading, memberSub, booking, roomImageUrl, company, logoUrl, memberAccentToUse, memberThemeToUse.border);
      await sendEmail({
        to: m.email,
        subject: `${memberHeading} – ${booking?.room_name || ""} | ${company?.name || ""}`,
        html: memberHtml,
      });
    }

    console.log("[EMAIL] Sent to:", toEmail, "| Team members:", teamMembers.length);
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
      `SELECT id, name, logo_url FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    return company || { id: companyId, name: "", logo_url: "" };
  } catch (error) {
    console.error("[getCompanyInfo]", error.message);
    return { id: companyId, name: "", logo_url: "" };
  }
};

/**
 * Validates company subscription and returns plan details.
 * Allows grace_period status and returns grace period info.
 */
const validateCompanySubscription = async (companyId) => {
  try {
    const [[company]] = await db.query(
      `SELECT plan, subscription_status, grace_period_ends_at, grace_period_day
       FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      throw new Error("Company not found");
    }

    const plan = normalizePlan(company.plan);
    const status = normalizeStatus(company.subscription_status);

    // Check if in grace period
    const inGracePeriod = status === "grace_period" &&
                          company.grace_period_ends_at &&
                          new Date(company.grace_period_ends_at) > new Date();

    // Calculate grace period days remaining
    let gracePeriodDaysRemaining = 0;
    if (inGracePeriod) {
      const endsAt = new Date(company.grace_period_ends_at);
      const now = new Date();
      gracePeriodDaysRemaining = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
    }

    // Allow grace_period status
    const allowedStatuses = ["trial", "active", "grace_period"];

    // Block only if expired AND not in grace period
    if (!allowedStatuses.includes(status) && !inGracePeriod) {
      throw new Error("Subscription inactive. Please renew your subscription to continue.");
    }

    const limits = PLANS[plan] || PLANS.trial;

    return {
      plan,
      roomLimit: limits.rooms,
      bookingLimit: limits.bookings,
      isUnlimited: limits.rooms === Infinity,
      inGracePeriod,
      gracePeriodDaysRemaining,
      gracePeriodEndsAt: inGracePeriod ? company.grace_period_ends_at : null,
    };
  } catch (error) {
    console.error("[validateCompanySubscription]", error.message);
    throw error;
  }
};

/* ── Attach today's upcoming bookings + presigned image to each room ── */
const enrichRoomsWithStatus = async (rooms, companyId) => {
  if (!rooms.length) return rooms;
  const nowIST  = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const today   = nowIST.toISOString().split("T")[0];
  const roomIds = rooms.map(r => r.id);
  const ph = roomIds.map(() => "?").join(",");
  const [bookings] = await db.query(
    `SELECT cb.room_id, cb.start_time, cb.end_time, cb.booked_by, cb.purpose,
            COALESCE(ce.name, '') AS employee_name
     FROM conference_bookings cb
     LEFT JOIN company_employees ce
       ON ce.company_id = ? AND LOWER(ce.email) = LOWER(cb.booked_by) AND ce.is_active = 1
     WHERE cb.company_id = ? AND cb.room_id IN (${ph})
       AND cb.booking_date = ? AND cb.status = 'BOOKED'
     ORDER BY cb.start_time ASC`,
    [companyId, companyId, ...roomIds, today]
  );
  const [countRows] = await db.query(
    `SELECT room_id, COUNT(*) AS total FROM conference_bookings
     WHERE company_id = ? AND room_id IN (${ph}) AND status = 'BOOKED'
     GROUP BY room_id`,
    [companyId, ...roomIds]
  );
  const totalByRoom = {};
  for (const r of countRows) totalByRoom[r.room_id] = r.total;
  const byRoom = {};
  for (const b of bookings) {
    if (!byRoom[b.room_id]) byRoom[b.room_id] = [];
    const name = b.employee_name || b.booked_by;
    byRoom[b.room_id].push({
      start_time: b.start_time, end_time: b.end_time,
      booked_by: `${name} (${b.booked_by})`, purpose: b.purpose || null,
    });
  }
  return Promise.all(rooms.map(async (room) => {
    let imageUrl = null;
    if (room.image_url) { try { imageUrl = await getPresignedUrl(room.image_url, 3600); } catch {} }
    const todayBookings = byRoom[room.id] || [];
    return { ...room, image_url: imageUrl, today_bookings: todayBookings,
      is_busy_today: todayBookings.length > 0, total_bookings: totalByRoom[room.id] || 0 };
  }));
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
    `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? AND status = 'BOOKED'`,
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

    // First, deactivate all rooms
    await db.query(
      `UPDATE conference_rooms SET is_active = 0 WHERE company_id = ?`,
      [companyId]
    );

    // If unlimited (Enterprise), activate ALL rooms
    if (limit === Infinity) {
      await db.query(
        `UPDATE conference_rooms SET is_active = 1 WHERE company_id = ?`,
        [companyId]
      );
      console.log(`✅ [syncRoomActivation] Enterprise plan - Activated ALL rooms for company ${companyId}`);
      return;
    }

    // Otherwise, activate only up to limit
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
      console.log(`✅ [syncRoomActivation] ${plan.toUpperCase()} plan - Activated ${limit} rooms for company ${companyId}`);
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
 * Get or create public booking slug (TRANSACTION SAFE).
 * Uses existing 'slug' column from companies table.
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
    const { plan, roomLimit, bookingLimit, isUnlimited } =
      await validateCompanySubscription(companyId);
    const roomStats = await getRoomStats(companyId);

    const [[bookingCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`,
      [companyId]
    );

    res.json({
      plan: plan.toUpperCase(),
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

    const statusCode =
      err.message.includes("inactive") || err.message.includes("renew") ? 403 : 500;

    res.status(statusCode).json({ message: err.message });
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

    const statusCode =
      err.message.includes("inactive") || err.message.includes("renew") ? 403 : 500;

    res.status(statusCode).json({
      message: err.message || "Failed to load dashboard statistics",
    });
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    await validateCompanySubscription(companyId);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity, image_url
       FROM conference_rooms WHERE company_id = ? AND is_active = 1
       ORDER BY room_number ASC`,
      [companyId]
    );

    res.json(await enrichRoomsWithStatus(rooms || [], companyId));
  } catch (err) {
    console.error("[GET /rooms]", err.message);
    const statusCode = err.message.includes("not found") ? 404
      : err.message.includes("inactive") || err.message.includes("renew") ? 403 : 500;
    res.status(statusCode).json({ message: err.message });
  }
});

router.get("/rooms/all", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity, is_active, image_url
       FROM conference_rooms WHERE company_id = ?
       ORDER BY room_number ASC, id ASC`,
      [companyId]
    );

    res.json(await enrichRoomsWithStatus(rooms || [], companyId));
  } catch (err) {
    console.error("[GET /rooms/all]", err.message);
    res.status(500).json({ message: "Unable to load rooms" });
  }
});

router.post("/rooms", roomImageUpload.single("image"), async (req, res) => {
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
        message: `Your ${plan.toUpperCase()} plan allows only ${roomLimit} room(s). Please upgrade to add more.`,
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

    const roomId = result.insertId;

    if (req.file) {
      const key = `companies/${companyId}/rooms/${roomId}.jpg`;
      await uploadToS3(req.file, key);
      await db.query(`UPDATE conference_rooms SET image_url = ? WHERE id = ?`, [key, roomId]);
    }

    await syncRoomActivationByPlan(companyId, plan);

    const [[newRoom]] = await db.query(
      `SELECT is_active FROM conference_rooms WHERE id = ?`,
      [roomId]
    );

    res.status(201).json({
      message: "Room created successfully. Activation depends on your current plan.",
      roomId,
      isActive: Boolean(newRoom.is_active),
    });
  } catch (err) {
    console.error("[POST /rooms]", err.message);

    const statusCode =
      err.message.includes("inactive") || err.message.includes("renew") ? 403 : 500;

    res.status(statusCode).json({ message: err.message });
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
      : err.message.includes("locked") ||
        err.message.includes("inactive") ||
        err.message.includes("renew")
      ? 403
      : 500;

    res.status(statusCode).json({ message: err.message });
  }
});

router.patch("/rooms/:id/image", roomImageUpload.single("image"), async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const roomId = parseInt(req.params.id);

    if (isNaN(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "Invalid room ID" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    await validateCompanySubscription(companyId);
    await verifyRoomAccess(roomId, companyId, true);

    // Delete old photo from S3 before uploading new one
    const [[existing]] = await db.query(`SELECT image_url FROM conference_rooms WHERE id = ? LIMIT 1`, [roomId]);
    if (existing?.image_url) await deleteFromS3(existing.image_url);

    const key = `companies/${companyId}/rooms/${roomId}.jpg`;
    await uploadToS3(req.file, key);
    await db.query(
      `UPDATE conference_rooms SET image_url = ? WHERE id = ? AND company_id = ?`,
      [key, roomId, companyId]
    );

    res.json({ message: "Room image updated successfully" });
  } catch (err) {
    console.error("[PATCH /rooms/:id/image]", err.message);

    const statusCode = err.message.includes("not found")
      ? 404
      : err.message.includes("locked") ||
        err.message.includes("inactive") ||
        err.message.includes("renew")
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

    const { plan } = await validateCompanySubscription(companyId);
    await verifyRoomAccess(roomId, companyId, false);

    const [[bookingCheck]] = await db.query(
      `SELECT COUNT(*) AS count FROM conference_bookings WHERE room_id = ?`,
      [roomId]
    );

    if (bookingCheck.count > 0) {
      return res.status(409).json({
        message:
          "Cannot delete room with existing bookings. Please cancel all bookings first.",
      });
    }

    await db.query(
      `DELETE FROM conference_rooms WHERE id = ? AND company_id = ?`,
      [roomId, companyId]
    );

    await syncRoomActivationByPlan(companyId, plan);

    res.json({ message: "Room deleted successfully" });
  } catch (err) {
    console.error("[DELETE /rooms/:id]", err.message);

    const statusCode = err.message.includes("not found")
      ? 404
      : err.message.includes("inactive") || err.message.includes("renew")
      ? 403
      : 500;

    res.status(statusCode).json({ message: err.message });
  }
});

router.get("/employees/search", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const q = (req.query.q || "").trim();
    const like = `%${q}%`;
    const [rows] = await db.query(
      `SELECT id, name, email, department
       FROM company_employees
       WHERE company_id = ? AND is_active = 1
         AND (name LIKE ? OR department LIKE ?)
       ORDER BY name ASC LIMIT 20`,
      [companyId, like, like]
    );
    res.json(rows);
  } catch (err) {
    console.error("[GET /employees/search]", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const { roomId, date } = req.query;

    let sql = `
      SELECT b.*, r.room_name, r.room_number,
             COALESCE(e.name, '') AS booked_by_name
      FROM conference_bookings b
      JOIN conference_rooms r ON r.id = b.room_id
      LEFT JOIN company_employees e
        ON e.company_id = b.company_id AND LOWER(e.email) = LOWER(b.booked_by) AND e.is_active = 1
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
        message: `Your ${plan.toUpperCase()} plan allows only ${bookingLimit} booking(s). Please upgrade.`,
      });
    }

    let {
      room_id,
      booked_by,
      department,
      purpose = "",
      booking_date,
      start_time,
      end_time,
      teamMembers = [],
    } = req.body;

    if (!room_id || !booked_by || !booking_date || !start_time || !end_time || !(purpose || "").trim()) {
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

    const [bookingResult] = await conn.query(
      `INSERT INTO conference_bookings
       (company_id, room_id, booked_by, department, purpose, booking_date, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        room_id,
        booked_by,
        (department || "").trim(),
        (purpose || "").trim(),
        booking_date,
        start_time,
        end_time,
      ]
    );

    const bookingId = bookingResult.insertId;

    // Save optional team members
    const validMembers = Array.isArray(teamMembers) ? teamMembers.filter(m => m?.id && m?.name) : [];
    for (const m of validMembers) {
      await conn.query(
        `INSERT INTO conference_booking_members (booking_id, employee_id, name, email) VALUES (?, ?, ?, ?)`,
        [bookingId, m.id, m.name, m.email || null]
      );
    }

    await conn.commit();

    const companyInfo = await getCompanyInfo(companyId);

    // Fetch room image for email banner
    const [[roomRow]] = await db.query(`SELECT image_url FROM conference_rooms WHERE id = ? LIMIT 1`, [room_id]);
    const roomImageUrl = roomRow?.image_url ? await getPresignedUrl(roomRow.image_url, 3600).catch(() => null) : null;

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
      teamMembers: validMembers,
      roomImageUrl,
    });

    res.status(201).json({ message: "Booking created successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("[POST /bookings]", err.message);

    const statusCode =
      err.message.includes("inactive") || err.message.includes("renew") ? 403 : 500;

    res.status(statusCode).json({ message: err.message || "Unable to create booking" });
  } finally {
    conn.release();
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const bookingId = Number(req.params.id);

    let { start_time, end_time, booking_date, room_id } = req.body;

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

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const newDate   = booking_date || booking.booking_date;
    const newRoomId = room_id ? Number(room_id) : booking.room_id;

    // Validate new room if changed
    let newRoomName = booking.room_name;
    if (newRoomId !== booking.room_id) {
      const [[nr]] = await db.query(
        `SELECT room_name FROM conference_rooms WHERE id = ? AND company_id = ? LIMIT 1`,
        [newRoomId, companyId]
      );
      if (!nr) return res.status(403).json({ message: "Invalid room" });
      newRoomName = nr.room_name;
    }

    const [[conflict]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM conference_bookings
       WHERE company_id = ? AND room_id = ? AND booking_date = ? AND id <> ? AND status = 'BOOKED'
       AND start_time < ? AND end_time > ?`,
      [companyId, newRoomId, newDate, bookingId, end_time, start_time]
    );

    if (conflict.cnt > 0) return res.status(409).json({ message: "Time slot already booked" });

    await db.query(
      `UPDATE conference_bookings SET start_time = ?, end_time = ?, booking_date = ?, room_id = ? WHERE id = ?`,
      [start_time, end_time, newDate, newRoomId, bookingId]
    );

    const [members] = await db.query(
      `SELECT name, email FROM conference_booking_members WHERE booking_id = ?`,
      [bookingId]
    );

    const companyInfo = await getCompanyInfo(companyId);
    const [[rr]] = await db.query(`SELECT image_url FROM conference_rooms WHERE id = ? LIMIT 1`, [newRoomId]);
    const roomImageUrl = rr?.image_url ? await getPresignedUrl(rr.image_url, 3600).catch(() => null) : null;

    await sendBookingMail({
      adminEmail: req.user.email,
      userEmail: booking.booked_by,
      subject: "Conference Room Booking Rescheduled",
      heading: "Meeting Rescheduled 🔄",
      booking: { ...booking, room_name: newRoomName, start_time, end_time, booking_date: newDate, status: "RESCHEDULED" },
      company: companyInfo,
      teamMembers: members,
      roomImageUrl,
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
      `SELECT b.*, r.room_name, r.image_url as room_image FROM conference_bookings b
       JOIN conference_rooms r ON r.id = b.room_id
       WHERE b.id = ? AND b.company_id = ? LIMIT 1`,
      [bookingId, companyId]
    );

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    await db.query(`UPDATE conference_bookings SET status = 'CANCELLED' WHERE id = ?`, [bookingId]);

    const [members] = await db.query(
      `SELECT name, email FROM conference_booking_members WHERE booking_id = ?`,
      [bookingId]
    );

    const companyInfo = await getCompanyInfo(companyId);
    const roomImageUrl = booking.room_image ? await getPresignedUrl(booking.room_image, 3600).catch(() => null) : null;

    await sendBookingMail({
      adminEmail: req.user.email,
      userEmail: booking.booked_by,
      subject: "Conference Room Booking Cancelled",
      heading: "Meeting Cancelled ❌",
      booking: { ...booking, status: "CANCELLED" },
      company: companyInfo,
      teamMembers: members,
      roomImageUrl,
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

    const roomStats = await getRoomStats(companyId);

    res.json({
      message: "Room activation synced successfully",
      plan: plan.toUpperCase(),
      totalRooms: roomStats.total,
      activeRooms: roomStats.active,
      lockedRooms: roomStats.locked,
    });
  } catch (err) {
    console.error("[POST /sync-rooms]", err.message);

    const statusCode =
      err.message.includes("inactive") || err.message.includes("renew") ? 403 : 500;

    res.status(statusCode).json({
      message: err.message || "Failed to sync room activation",
    });
  }
});

/* ======================================================
   QR CODE ROUTES
====================================================== */

/**
 * GET /api/conference/public-booking-info
 * Returns public booking URL and generates QR code
 */
router.get("/public-booking-info", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    await validateCompanySubscription(companyId);

    const [[company]] = await db.query(
      `SELECT name, slug FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const slug = await getOrCreatePublicSlug(companyId);

    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      "https://www.promeet.zodopt.com";
    const publicUrl = `${baseUrl}/book/${slug}`;

    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: 512,
      margin: 2,
      color: {
        dark: "#6a1b9a",
        light: "#FFFFFF",
      },
    });

    res.json({
      publicUrl,
      slug,
      qrCode: qrCodeDataUrl,
      companyName: company.name,
    });
  } catch (error) {
    console.error("[GET /public-booking-info]", error.message);

    const statusCode =
      error.message.includes("inactive") || error.message.includes("renew") ? 403 : 500;

    res.status(statusCode).json({
      message: error.message || "Failed to generate public booking information",
    });
  }
});

/**
 * GET /api/conference/qr-code/download
 * Downloads branded QR code as PNG file
 */
router.get("/qr-code/download", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    await validateCompanySubscription(companyId);

    const [[company]] = await db.query(
      `SELECT name, slug FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Get or create slug
    let slug = company.slug;
    if (!slug) {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        slug = `${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${companyId}`;
        await conn.execute(`UPDATE companies SET slug = ? WHERE id = ?`, [slug, companyId]);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      "https://www.promeet.zodopt.com";
    const publicUrl = `${baseUrl}/book/${slug}`;

    const qrCodeBuffer = await generateBrandedQRCode(publicUrl, company.name, true);

    const safeFileName = company.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFileName}-conference-qr.png"`
    );

    res.send(qrCodeBuffer);
  } catch (error) {
    console.error("[GET /qr-code/download]", error.message);

    const statusCode =
      error.message.includes("inactive") || error.message.includes("renew") ? 403 : 500;

    res.status(statusCode).json({
      message: error.message || "Failed to download QR code",
    });
  }
});

export default router;
