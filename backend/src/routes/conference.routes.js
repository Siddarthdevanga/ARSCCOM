import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import QRCode from "qrcode";
import { createCanvas, loadImage, registerFont } from "canvas";

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

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
 * Helper function to draw rounded rectangles on canvas
 */
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

/**
 * Generate a branded QR code image with company branding.
 * Matches the professional branded template design.
 */
const generateBrandedQRCode = async (url, company, isConference = true) => {
  try {
    // Canvas dimensions - matching frontend design
    const width = 800;
    const height = 1200;

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Purple gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#5B21B6");
    bgGrad.addColorStop(1, "#7C3AED");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // White card with shadow
    const cardX = 60;
    const cardY = 80;
    const cardW = width - 120;
    const cardH = height - 160;
    const cardRadius = 24;

    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Company logo at top
    let logoY = cardY + 80;
    if (company.logo_url) {
      try {
        const logoImg = await loadImage(company.logo_url);
        const maxLogoW = 280;
        const maxLogoH = 100;
        let logoW = logoImg.width;
        let logoH = logoImg.height;
        const ratio = Math.min(maxLogoW / logoW, maxLogoH / logoH);
        logoW *= ratio;
        logoH *= ratio;
        const logoX = (width - logoW) / 2;
        ctx.drawImage(logoImg, logoX, cardY + 50, logoW, logoH);
        logoY = cardY + 50 + logoH + 40;
      } catch (err) {
        console.error("Failed to load company logo:", err.message);
        // Continue without logo
      }
    }

    // Title - CONFERENCE MANAGEMENT PLATFORM or VISITOR MANAGEMENT PLATFORM
    ctx.fillStyle = "#1F2937";
    ctx.font = "bold 42px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (isConference) {
      ctx.fillText("CONFERENCE", width / 2, logoY);
      ctx.fillText("MANAGEMENT", width / 2, logoY + 50);
      ctx.fillText("PLATFORM", width / 2, logoY + 100);
    } else {
      ctx.fillText("VISITOR", width / 2, logoY);
      ctx.fillText("MANAGEMENT", width / 2, logoY + 50);
      ctx.fillText("PLATFORM", width / 2, logoY + 100);
    }

    // Generate QR code with orange gradient frame
    const qrY = logoY + 140;
    const qrSize = 360;
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: qrSize,
      margin: 0,
      color: {
        dark: "#1F2937",  // Dark gray QR code
        light: "#FFFFFF",
      },
    });

    // Load and draw QR code with orange frame
    const qrImage = await loadImage(qrCodeDataUrl);
    const qrX = (width - qrSize) / 2;
    const frameSize = qrSize + 60;
    const frameX = (width - frameSize) / 2;
    const frameY = qrY;

    // Orange gradient frame
    const frameGrad = ctx.createLinearGradient(frameX, frameY, frameX, frameY + frameSize);
    frameGrad.addColorStop(0, "#F59E0B");
    frameGrad.addColorStop(1, "#FCD34D");
    ctx.fillStyle = frameGrad;
    roundRect(ctx, frameX, frameY, frameSize, frameSize, 16);
    ctx.fill();

    // White background for QR
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrX, qrY + 30, qrSize, qrSize, 12);
    ctx.fill();

    // Draw QR code
    ctx.drawImage(qrImage, qrX + 10, qrY + 40, qrSize - 20, qrSize - 20);

    // "Powered by Zodopt" footer
    const footerY = cardY + cardH - 140;
    ctx.fillStyle = "#6B7280";
    ctx.font = "18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Powered by Zodopt", width / 2, footerY);

    // ProMeet/Zodopt logo at bottom
    try {
      const brandImg = await loadImage("https://www.promeet.zodopt.com/Brand%20Logo.png");
      const brandW = 120;
      const brandH = (brandImg.height / brandImg.width) * brandW;
      const brandX = (width - brandW) / 2;
      const brandY = footerY + 20;
      ctx.drawImage(brandImg, brandX, brandY, brandW, brandH);
    } catch (err) {
      console.error("Failed to load brand logo:", err.message);
      // Fallback text if logo fails
      ctx.fillStyle = "#5B21B6";
      ctx.font = "bold 22px Arial, sans-serif";
      ctx.fillText("PROMEET", width / 2, footerY + 50);
    }

    return canvas.toBuffer("image/png");
  } catch (error) {
    console.error("[generateBrandedQRCode]", error);
    throw error;
  }
};

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
      `SELECT id, room_number, room_name, capacity
       FROM conference_rooms WHERE company_id = ? AND is_active = 1
       ORDER BY room_number ASC`,
      [companyId]
    );

    res.json(rooms || []);
  } catch (err) {
    console.error("[GET /rooms]", err.message);

    const statusCode = err.message.includes("not found")
      ? 404
      : err.message.includes("inactive") || err.message.includes("renew")
      ? 403
      : 500;

    res.status(statusCode).json({ message: err.message });
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

    await syncRoomActivationByPlan(companyId, plan);

    const [[newRoom]] = await db.query(
      `SELECT is_active FROM conference_rooms WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Room created successfully. Activation depends on your current plan.",
      roomId: result.insertId,
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
    } = req.body;

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
      [
        companyId,
        room_id,
        booked_by,
        department.trim(),
        purpose.trim(),
        booking_date,
        start_time,
        end_time,
      ]
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
      `SELECT name, slug, logo_url FROM companies WHERE id = ? LIMIT 1`,
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

    const qrCodeBuffer = await generateBrandedQRCode(publicUrl, company, true);

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
