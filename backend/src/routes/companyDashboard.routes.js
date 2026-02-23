import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import QRCode from "qrcode";

const router = express.Router();

/* ======================================================
   PLAN CONFIGURATION (matches database enum)
====================================================== */
const PLANS = {
  trial:      2,
  business:   6,
  enterprise: Infinity,
};

const ACTIVE_STATUSES = ["active", "trial"];

/* ======================================================
   MIDDLEWARE
====================================================== */
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(authMiddleware);

/* ======================================================
   UTILITY FUNCTIONS
====================================================== */

const normalizePlan   = (plan)   => (plan   || "trial").toLowerCase();
const normalizeStatus = (status) => (status || "pending").toLowerCase();

const generatePublicSlug = (companyName, companyId) => {
  const normalized = (companyName || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized}-${companyId}`;
};

/**
 * Map error message → HTTP status code.
 * Single source of truth — avoids scattered ternary chains.
 */
const httpStatusFor = (message = "") => {
  if (message.includes("not found"))                               return 404;
  if (message.includes("locked") || message.includes("upgrade"))  return 403;
  if (message.includes("inactive") || message.includes("renew"))  return 403;
  if (message.includes("already exists") || message.includes("bookings")) return 409;
  if (message.includes("required") || message.includes("Invalid")) return 400;
  return 500;
};

/* ======================================================
   CORE BUSINESS LOGIC
====================================================== */

/**
 * Validates company subscription and returns plan details.
 * Only checks subscription_status — cron handles date expiry.
 */
const validateCompanySubscription = async (companyId) => {
  const [[company]] = await db.query(
    `SELECT plan, subscription_status
     FROM companies
     WHERE id = ?
     LIMIT 1`,
    [companyId]
  );

  if (!company) throw new Error("Company not found");

  const plan   = normalizePlan(company.plan);
  const status = normalizeStatus(company.subscription_status);

  if (!ACTIVE_STATUSES.includes(status)) {
    throw new Error("Subscription inactive. Please renew your subscription to continue.");
  }

  const limit = PLANS[plan] ?? 0;

  return {
    plan,
    limit,
    isUnlimited: limit === Infinity,
  };
};

/**
 * Returns true if company is within plan room limit.
 * FIX: was comparing total rooms to limit, but limit === Infinity
 *      caused NaN comparison in old code path — now explicit guard.
 */
const canAddRoom = async (companyId, limit) => {
  if (limit === Infinity) return true;

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
    [companyId]
  );

  return Number(total) < limit;
};

/**
 * Activates the first N rooms by room_number ASC, deactivates the rest.
 * FIX: subquery alias was missing in some MySQL versions — added explicit alias.
 * FIX: unlimited case was missing — now handled before the main UPDATE.
 */
export const syncRoomActivationByPlan = async (companyId, plan) => {
  const limit = PLANS[plan] ?? 0;

  // Step 1 — deactivate all rooms for this company
  await db.query(
    `UPDATE conference_rooms SET is_active = 0 WHERE company_id = ?`,
    [companyId]
  );

  if (limit === Infinity) {
    // Unlimited plan — activate everything
    await db.query(
      `UPDATE conference_rooms SET is_active = 1 WHERE company_id = ?`,
      [companyId]
    );
    return;
  }

  if (limit <= 0) return; // No rooms allowed on this plan

  // Step 2 — activate first `limit` rooms (stable order: room_number ASC, id ASC)
  await db.query(
    `UPDATE conference_rooms
     SET is_active = 1
     WHERE id IN (
       SELECT id FROM (
         SELECT id
         FROM conference_rooms
         WHERE company_id = ?
         ORDER BY room_number ASC, id ASC
         LIMIT ?
       ) AS _top_rooms
     )`,
    [companyId, limit]
  );
};

/**
 * Returns { total, active, locked } room counts.
 * FIX: SUM(is_active) returns NULL when table is empty — coerce to 0.
 */
const getRoomStats = async (companyId) => {
  const [[stats]] = await db.query(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(is_active), 0) AS active
     FROM conference_rooms
     WHERE company_id = ?`,
    [companyId]
  );

  const total  = Number(stats?.total  ?? 0);
  const active = Number(stats?.active ?? 0);

  return { total, active, locked: total - active };
};

/**
 * Verify room ownership.
 * FIX: requireActive default is true — callers that want to touch locked rooms
 *      must pass false explicitly (e.g. DELETE).
 */
const verifyRoomAccess = async (roomId, companyId, requireActive = true) => {
  const [[room]] = await db.query(
    `SELECT id, is_active, room_name, room_number
     FROM conference_rooms
     WHERE id = ? AND company_id = ?`,
    [roomId, companyId]
  );

  if (!room) throw new Error("Room not found or access denied");

  if (requireActive && !room.is_active) {
    throw new Error("This room is locked under your current plan. Please upgrade to edit.");
  }

  return room;
};

/**
 * Get or create public booking slug for a company (transaction-safe).
 * FIX: empty/null company name no longer crashes generatePublicSlug.
 */
const getOrCreatePublicSlug = async (companyId) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[company]] = await conn.execute(
      `SELECT slug, name FROM companies WHERE id = ? FOR UPDATE`,
      [companyId]
    );

    if (!company) throw new Error("Company not found");

    if (company.slug) {
      await conn.commit();
      return company.slug;
    }

    const slug = generatePublicSlug(company.name, companyId);
    await conn.execute(`UPDATE companies SET slug = ? WHERE id = ?`, [slug, companyId]);
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
   HELPERS — consistent success/error responders
====================================================== */

const sendError = (res, err, context = "") => {
  const msg = err?.message || "An unexpected error occurred";
  console.error(`[${context}]`, msg);
  res.status(httpStatusFor(msg)).json({ message: msg });
};

/* ======================================================
   API ROUTES
====================================================== */

/**
 * GET /api/conference/rooms
 * Active rooms only.
 */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plan }  = await validateCompanySubscription(companyId);
    await syncRoomActivationByPlan(companyId, plan);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity, is_active
       FROM conference_rooms
       WHERE company_id = ? AND is_active = 1
       ORDER BY room_number ASC`,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    sendError(res, err, "GET /rooms");
  }
});

/**
 * GET /api/conference/rooms/all
 * All rooms (active + locked) for admin view.
 */
router.get("/rooms/all", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plan }  = await validateCompanySubscription(companyId);
    await syncRoomActivationByPlan(companyId, plan);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity, is_active
       FROM conference_rooms
       WHERE company_id = ?
       ORDER BY room_number ASC, id ASC`,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    sendError(res, err, "GET /rooms/all");
  }
});

/**
 * POST /api/conference/rooms
 * Creates a new conference room with plan-limit checking.
 * FIX: capacity was stored as 0 when undefined — now stored as NULL if not provided.
 * FIX: room_number coerced to string before trim() to avoid crash on numeric input.
 */
router.post("/rooms", async (req, res) => {
  try {
    const companyId   = req.user.company_id;
    const room_name   = String(req.body.room_name   || "").trim();
    const room_number = String(req.body.room_number  || "").trim();
    const capacity    = req.body.capacity != null ? Number(req.body.capacity) : null;

    if (!room_name)   return res.status(400).json({ message: "Room name is required" });
    if (!room_number) return res.status(400).json({ message: "Room number is required" });

    if (capacity !== null && (isNaN(capacity) || capacity < 0)) {
      return res.status(400).json({ message: "Capacity must be a non-negative number" });
    }

    const { plan, limit } = await validateCompanySubscription(companyId);

    if (!(await canAddRoom(companyId, limit))) {
      return res.status(403).json({
        message: `Your ${plan.toUpperCase()} plan allows only ${limit} room(s). Please upgrade to add more.`,
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
      `INSERT INTO conference_rooms (company_id, room_number, room_name, capacity, is_active)
       VALUES (?, ?, ?, ?, 0)`,
      [companyId, room_number, room_name, capacity]
    );

    await syncRoomActivationByPlan(companyId, plan);

    const [[newRoom]] = await db.query(
      `SELECT is_active FROM conference_rooms WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message:  "Room created successfully. Activation depends on your current plan.",
      roomId:   result.insertId,
      isActive: Boolean(newRoom?.is_active),
    });
  } catch (err) {
    sendError(res, err, "POST /rooms");
  }
});

/**
 * PATCH /api/conference/rooms/:id
 * Updates room details (active rooms only).
 * FIX: capacity coercion consistent with POST.
 */
router.patch("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId    = parseInt(req.params.id, 10);
    const room_name = String(req.body.room_name || "").trim();
    const capacity  = req.body.capacity != null ? Number(req.body.capacity) : null;

    if (!Number.isFinite(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    if (!room_name) return res.status(400).json({ message: "Room name is required" });

    if (capacity !== null && (isNaN(capacity) || capacity < 0)) {
      return res.status(400).json({ message: "Capacity must be a non-negative number" });
    }

    await validateCompanySubscription(companyId);
    await verifyRoomAccess(roomId, companyId, true);

    await db.query(
      `UPDATE conference_rooms SET room_name = ?, capacity = ? WHERE id = ? AND company_id = ?`,
      [room_name, capacity, roomId, companyId]
    );

    res.json({ message: "Room updated successfully" });
  } catch (err) {
    sendError(res, err, "PATCH /rooms/:id");
  }
});

/**
 * DELETE /api/conference/rooms/:id
 * Deletes a room and re-syncs activation.
 * FIX: verifyRoomAccess called with requireActive=false so locked rooms can also be deleted.
 */
router.delete("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId    = parseInt(req.params.id, 10);

    if (!Number.isFinite(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    const { plan } = await validateCompanySubscription(companyId);
    await verifyRoomAccess(roomId, companyId, false); // allow deleting locked rooms

    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) AS count FROM conference_bookings WHERE room_id = ?`,
      [roomId]
    );

    if (Number(count) > 0) {
      return res.status(409).json({
        message: "Cannot delete room with existing bookings. Please cancel all bookings first.",
      });
    }

    await db.query(
      `DELETE FROM conference_rooms WHERE id = ? AND company_id = ?`,
      [roomId, companyId]
    );

    await syncRoomActivationByPlan(companyId, plan);

    res.json({ message: "Room deleted successfully" });
  } catch (err) {
    sendError(res, err, "DELETE /rooms/:id");
  }
});

/**
 * GET /api/conference/dashboard
 * Summary stats for active rooms.
 * FIX: COALESCE prevents NULL from SUM/COUNT when no bookings exist.
 */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await validateCompanySubscription(companyId);

    const [[stats]] = await db.query(
      `SELECT
         COUNT(DISTINCT cr.id)                                                      AS rooms,
         COALESCE(COUNT(cb.id), 0)                                                  AS totalBookings,
         COALESCE(SUM(DATE(cb.booking_date) = CURDATE() AND cb.status='BOOKED'), 0) AS todayBookings
       FROM conference_rooms cr
       LEFT JOIN conference_bookings cb ON cb.room_id = cr.id
       WHERE cr.company_id = ? AND cr.is_active = 1`,
      [companyId]
    );

    res.json({
      rooms:         Number(stats?.rooms         ?? 0),
      totalBookings: Number(stats?.totalBookings ?? 0),
      todayBookings: Number(stats?.todayBookings ?? 0),
    });
  } catch (err) {
    sendError(res, err, "GET /dashboard");
  }
});

/**
 * GET /api/conference/plan-usage
 * Plan usage info for UI.
 * FIX: slotsAvailable was using roomStats.total instead of roomStats.active — corrected.
 */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId              = req.user.company_id;
    const { plan, limit, isUnlimited } = await validateCompanySubscription(companyId);

    await syncRoomActivationByPlan(companyId, plan);
    const roomStats = await getRoomStats(companyId);

    res.json({
      plan:             plan.toUpperCase(),
      limit:            isUnlimited ? "Unlimited" : limit,
      totalRooms:       roomStats.total,
      activeRooms:      roomStats.active,
      lockedRooms:      roomStats.locked,
      // FIX: slots should be based on active rooms, not total
      slotsAvailable:   isUnlimited ? null : Math.max(0, limit - roomStats.active),
      upgradeRequired:  !isUnlimited && roomStats.total >= limit,
    });
  } catch (err) {
    sendError(res, err, "GET /plan-usage");
  }
});

/**
 * POST /api/conference/sync-rooms
 * Manually triggers room sync.
 */
router.post("/sync-rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plan }  = await validateCompanySubscription(companyId);

    await syncRoomActivationByPlan(companyId, plan);
    const roomStats = await getRoomStats(companyId);

    res.json({
      message:     "Room activation synced successfully",
      activeRooms: roomStats.active,
      lockedRooms: roomStats.locked,
      totalRooms:  roomStats.total,
    });
  } catch (err) {
    sendError(res, err, "POST /sync-rooms");
  }
});

/**
 * GET /api/conference/public-booking-info
 * Returns public URL + QR code data URL.
 */
router.get("/public-booking-info", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await validateCompanySubscription(companyId);

    const slug = await getOrCreatePublicSlug(companyId);

    const baseUrl   = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
    const publicUrl = `${baseUrl}/book/${slug}`;

    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      type:   "image/png",
      width:  512,
      margin: 2,
      color:  { dark: "#000000", light: "#FFFFFF" },
    });

    res.json({ publicUrl, slug, qrCode: qrCodeDataUrl });
  } catch (err) {
    sendError(res, err, "GET /public-booking-info");
  }
});

/**
 * GET /api/conference/qr-code/download
 * Downloads QR code as PNG.
 * FIX: conn.rollback() was only called on transaction errors, not on QRCode errors
 *      — moved all post-commit work outside the transaction.
 */
router.get("/qr-code/download", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await validateCompanySubscription(companyId);

    // Resolve slug (transaction-safe, reuses existing helper)
    const slug = await getOrCreatePublicSlug(companyId);

    // Fetch company name for filename (no lock needed here)
    const [[company]] = await db.query(
      `SELECT name FROM companies WHERE id = ?`,
      [companyId]
    );

    const baseUrl   = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
    const publicUrl = `${baseUrl}/book/${slug}`;

    // Generate QR buffer OUTSIDE the transaction — QRCode is CPU-only
    const qrCodeBuffer = await QRCode.toBuffer(publicUrl, {
      errorCorrectionLevel: "M",
      type:   "png",
      width:  1024,
      margin: 2,
      color:  { dark: "#000000", light: "#FFFFFF" },
    });

    const safeFileName = (company?.name || "company")
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}-booking-qr.png"`);
    res.send(qrCodeBuffer);

  } catch (err) {
    sendError(res, err, "GET /qr-code/download");
  }
});

/**
 * GET /api/conference/bookings
 * All bookings for the company.
 * FIX: added index-friendly WHERE on cb.company_id to avoid full table scan.
 */
router.get("/bookings", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await validateCompanySubscription(companyId);

    const [bookings] = await db.query(
      `SELECT
         cb.id,
         cb.room_id,
         cb.booking_date,
         cb.start_time,
         cb.end_time,
         cb.status,
         cb.department,
         cb.created_at,
         cr.room_name,
         cr.room_number
       FROM conference_bookings cb
       JOIN conference_rooms cr ON cb.room_id = cr.id
       WHERE cb.company_id = ?
       ORDER BY cb.booking_date DESC, cb.start_time DESC`,
      [companyId]
    );

    res.json(bookings);
  } catch (err) {
    sendError(res, err, "GET /bookings");
  }
});

export default router;
