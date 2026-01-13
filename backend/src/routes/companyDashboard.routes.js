import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import QRCode from "qrcode";

const router = express.Router();

/* ======================================================
   PLAN CONFIGURATION (matches database enum)
====================================================== */
const PLANS = {
  trial: 2,
  business: 6,
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

/**
 * Check if a date has expired
 */
const isExpired = (date) => {
  if (!date) return true;
  return new Date(date).getTime() < Date.now();
};

/**
 * Normalize plan name to lowercase (matches database enum)
 */
const normalizePlan = (plan) => (plan || "trial").toLowerCase();

/**
 * Normalize subscription status to lowercase (matches database enum)
 */
const normalizeStatus = (status) => (status || "pending").toLowerCase();

/**
 * Generate public booking URL slug for a company
 * Uses existing slug if present, otherwise generates new one
 */
const generatePublicSlug = (companyName, companyId) => {
  const normalized = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized}-${companyId}`;
};

/* ======================================================
   CORE BUSINESS LOGIC
====================================================== */

/**
 * Validates company subscription and returns plan details
 * @throws {Error} if subscription is invalid or expired
 */
const validateCompanySubscription = async (companyId) => {
  const [[company]] = await db.query(
    `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at
     FROM companies
     WHERE id = ?
     LIMIT 1`,
    [companyId]
  );

  if (!company) {
    throw new Error("Company not found");
  }

  const plan = normalizePlan(company.plan);
  const status = normalizeStatus(company.subscription_status);

  // Check subscription status
  if (!ACTIVE_STATUSES.includes(status)) {
    throw new Error("Subscription inactive. Please upgrade your plan.");
  }

  // Check trial expiration
  if (status === "trial" && isExpired(company.trial_ends_at)) {
    throw new Error("Trial period has expired. Please upgrade to continue.");
  }

  // Check paid subscription expiration
  if (status === "active" && isExpired(company.subscription_ends_at)) {
    throw new Error("Subscription has expired. Please renew to continue.");
  }

  return {
    plan,
    limit: PLANS[plan] ?? 0,
    isUnlimited: PLANS[plan] === Infinity,
  };
};

/**
 * Synchronizes room activation status based on plan limits
 * Rooms are activated in order of room_number (ascending)
 */
export const syncRoomActivationByPlan = async (companyId, plan) => {
  const limit = PLANS[plan] ?? 0;

  // First, deactivate all rooms
  await db.query(
    `UPDATE conference_rooms 
     SET is_active = 0 
     WHERE company_id = ?`,
    [companyId]
  );

  // If unlimited plan, activate all rooms
  if (limit === Infinity) {
    await db.query(
      `UPDATE conference_rooms 
       SET is_active = 1 
       WHERE company_id = ?`,
      [companyId]
    );
    return;
  }

  // Activate first N rooms (by room_number ascending)
  if (limit > 0) {
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
         ) AS temp
       )`,
      [companyId, limit]
    );
  }
};

/**
 * Get room statistics for a company
 */
const getRoomStats = async (companyId) => {
  const [[stats]] = await db.query(
    `SELECT 
       COUNT(*) AS total,
       SUM(is_active) AS active
     FROM conference_rooms
     WHERE company_id = ?`,
    [companyId]
  );

  return {
    total: stats?.total || 0,
    active: stats?.active || 0,
    locked: (stats?.total || 0) - (stats?.active || 0),
  };
};

/**
 * Verify room ownership and active status
 */
const verifyRoomAccess = async (roomId, companyId, requireActive = true) => {
  const [[room]] = await db.query(
    `SELECT id, is_active, room_name, room_number
     FROM conference_rooms
     WHERE id = ? AND company_id = ?`,
    [roomId, companyId]
  );

  if (!room) {
    throw new Error("Room not found or access denied");
  }

  if (requireActive && !room.is_active) {
    throw new Error("This room is locked under your current plan. Please upgrade to edit.");
  }

  return room;
};

/**
 * Get or create public booking slug for a company (TRANSACTION SAFE)
 * Uses existing 'slug' column from companies table
 */
const getOrCreatePublicSlug = async (companyId) => {
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // Lock company row and get existing slug
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
    const slug = generatePublicSlug(company.name, companyId);

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

/**
 * GET /api/conference/rooms
 * Returns only active rooms for the company
 */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    
    // Validate subscription and sync rooms
    const { plan } = await validateCompanySubscription(companyId);
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
    console.error("[GET /rooms]", err.message);
    
    const statusCode = err.message.includes("not found") 
      ? 404 
      : err.message.includes("expired") || err.message.includes("inactive")
      ? 403
      : 500;
      
    res.status(statusCode).json({
      message: err.message,
    });
  }
});

/**
 * GET /api/conference/rooms/all
 * Returns all rooms (active + locked) for admin view
 */
router.get("/rooms/all", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Validate subscription and get current plan
    const { plan } = await validateCompanySubscription(companyId);
    
    // Auto-sync room activation based on current plan
    await syncRoomActivationByPlan(companyId, plan);

    // Fetch all rooms with updated activation status
    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity, is_active
       FROM conference_rooms
       WHERE company_id = ?
       ORDER BY room_number ASC, id ASC`,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    console.error("[GET /rooms/all]", err.message);
    
    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive") 
      ? 403 
      : 500;
    
    res.status(statusCode).json({
      message: err.message || "Unable to load rooms. Please try again.",
    });
  }
});

/**
 * POST /api/conference/rooms
 * Creates a new conference room (initially inactive)
 */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number, capacity } = req.body;

    // Validate input
    if (!room_name?.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    if (!room_number) {
      return res.status(400).json({ message: "Room number is required" });
    }

    // Validate subscription
    const { plan } = await validateCompanySubscription(companyId);

    // Check for duplicate room number
    const [[existing]] = await db.query(
      `SELECT id FROM conference_rooms 
       WHERE company_id = ? AND room_number = ?`,
      [companyId, room_number]
    );

    if (existing) {
      return res.status(409).json({
        message: "Room number already exists. Please use a different number.",
      });
    }

    // Create room (initially inactive)
    const [result] = await db.query(
      `INSERT INTO conference_rooms
       (company_id, room_number, room_name, capacity, is_active)
       VALUES (?, ?, ?, ?, 0)`,
      [companyId, room_number, room_name.trim(), capacity || 0]
    );

    // Sync room activation based on plan
    await syncRoomActivationByPlan(companyId, plan);

    // Get the newly created room's status
    const [[newRoom]] = await db.query(
      `SELECT is_active FROM conference_rooms WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: newRoom.is_active 
        ? "Room created and activated successfully" 
        : "Room created successfully. Upgrade your plan to activate this room.",
      roomId: result.insertId,
      isActive: Boolean(newRoom.is_active),
    });
  } catch (err) {
    console.error("[POST /rooms]", err.message);
    
    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive")
      ? 403 
      : 500;
      
    res.status(statusCode).json({
      message: err.message,
    });
  }
});

/**
 * PATCH /api/conference/rooms/:id
 * Updates room details (only for active rooms)
 */
router.patch("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = parseInt(req.params.id);
    const { room_name, capacity } = req.body;

    // Validate input
    if (isNaN(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    if (!room_name?.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    // Validate subscription and room access
    await validateCompanySubscription(companyId);
    await verifyRoomAccess(roomId, companyId, true);

    // Update room
    await db.query(
      `UPDATE conference_rooms
       SET room_name = ?, capacity = ?
       WHERE id = ? AND company_id = ?`,
      [room_name.trim(), capacity || 0, roomId, companyId]
    );

    res.json({
      message: "Room updated successfully",
    });
  } catch (err) {
    console.error("[PATCH /rooms/:id]", err.message);
    
    const statusCode = err.message.includes("not found")
      ? 404
      : err.message.includes("locked") || 
        err.message.includes("expired") ||
        err.message.includes("inactive")
      ? 403
      : 500;

    res.status(statusCode).json({
      message: err.message,
    });
  }
});

/**
 * DELETE /api/conference/rooms/:id
 * Deletes a conference room and re-syncs activation
 */
router.delete("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = parseInt(req.params.id);

    if (isNaN(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    // Validate subscription
    const { plan } = await validateCompanySubscription(companyId);

    // Verify room exists
    await verifyRoomAccess(roomId, companyId, false);

    // Check if room has any bookings
    const [[bookingCheck]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM conference_bookings
       WHERE room_id = ?`,
      [roomId]
    );

    if (bookingCheck.count > 0) {
      return res.status(409).json({
        message: "Cannot delete room with existing bookings. Please cancel all bookings first.",
      });
    }

    // Delete room
    await db.query(
      `DELETE FROM conference_rooms
       WHERE id = ? AND company_id = ?`,
      [roomId, companyId]
    );

    // Re-sync room activation after deletion
    await syncRoomActivationByPlan(companyId, plan);

    res.json({
      message: "Room deleted successfully",
    });
  } catch (err) {
    console.error("[DELETE /rooms/:id]", err.message);
    
    const statusCode = err.message.includes("not found")
      ? 404
      : err.message.includes("expired") || err.message.includes("inactive")
      ? 403
      : 500;
      
    res.status(statusCode).json({
      message: err.message,
    });
  }
});

/**
 * GET /api/conference/dashboard
 * Returns dashboard statistics (active rooms only)
 */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Validate subscription
    await validateCompanySubscription(companyId);

    const [[stats]] = await db.query(
      `SELECT
         COUNT(DISTINCT cr.id) AS rooms,
         COUNT(cb.id) AS totalBookings,
         SUM(CASE WHEN DATE(cb.booking_date) = CURDATE() THEN 1 ELSE 0 END) AS todayBookings
       FROM conference_rooms cr
       LEFT JOIN conference_bookings cb ON cb.room_id = cr.id AND cb.status = 'BOOKED'
       WHERE cr.company_id = ? AND cr.is_active = 1`,
      [companyId]
    );

    res.json({
      rooms: stats?.rooms || 0,
      totalBookings: stats?.totalBookings || 0,
      todayBookings: stats?.todayBookings || 0,
    });
  } catch (err) {
    console.error("[GET /dashboard]", err.message);
    
    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive")
      ? 403
      : 500;
      
    res.status(statusCode).json({
      message: err.message || "Failed to load dashboard statistics",
    });
  }
});

/**
 * GET /api/conference/plan-usage
 * Returns plan usage information for UI display
 */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Validate subscription and get plan details
    const { plan, limit, isUnlimited } = await validateCompanySubscription(companyId);

    // Sync rooms before calculating stats
    await syncRoomActivationByPlan(companyId, plan);

    // Get room statistics
    const roomStats = await getRoomStats(companyId);

    res.json({
      plan: plan.toUpperCase(), // Return uppercase for frontend display
      limit: isUnlimited ? "Unlimited" : limit,
      totalRooms: roomStats.total,
      activeRooms: roomStats.active,
      lockedRooms: roomStats.locked,
      slotsAvailable: isUnlimited ? null : Math.max(0, limit - roomStats.total),
      upgradeRequired: !isUnlimited && roomStats.total >= limit,
    });
  } catch (err) {
    console.error("[GET /plan-usage]", err.message);
    
    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive")
      ? 403
      : 500;
      
    res.status(statusCode).json({
      message: err.message,
    });
  }
});

/**
 * POST /api/conference/sync-rooms
 * Manually triggers room sync (admin endpoint)
 */
router.post("/sync-rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Validate subscription and get plan
    const { plan } = await validateCompanySubscription(companyId);

    // Sync room activation
    await syncRoomActivationByPlan(companyId, plan);

    // Get updated stats
    const roomStats = await getRoomStats(companyId);

    res.json({
      message: "Room activation synced successfully",
      activeRooms: roomStats.active,
      lockedRooms: roomStats.locked,
      totalRooms: roomStats.total,
    });
  } catch (err) {
    console.error("[POST /sync-rooms]", err.message);
    
    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive")
      ? 403
      : 500;
      
    res.status(statusCode).json({
      message: err.message || "Failed to sync room activation",
    });
  }
});

/**
 * GET /api/conference/public-booking-info
 * Returns public booking URL and generates QR code (TRANSACTION SAFE)
 * Uses existing 'slug' column from companies table
 */
router.get("/public-booking-info", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Validate subscription
    await validateCompanySubscription(companyId);

    // Get or create public slug (transaction-safe)
    const slug = await getOrCreatePublicSlug(companyId);

    // Construct public URL
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
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
  } catch (err) {
    console.error("[GET /public-booking-info]", err.message);

    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive")
      ? 403
      : 500;

    res.status(statusCode).json({
      message: err.message || "Failed to generate public booking information",
    });
  }
});

/**
 * GET /api/conference/qr-code/download
 * Downloads QR code as PNG file (TRANSACTION SAFE)
 * Uses existing 'slug' column from companies table
 */
router.get("/qr-code/download", async (req, res) => {
  const conn = await db.getConnection();
  
  try {
    const companyId = req.user.company_id;

    // Validate subscription
    await validateCompanySubscription(companyId);

    await conn.beginTransaction();

    // Lock and get company info
    const [[company]] = await conn.execute(
      `SELECT name, slug FROM companies WHERE id = ? FOR UPDATE`,
      [companyId]
    );

    if (!company) {
      throw new Error("Company not found");
    }

    // Get or generate slug
    let slug = company.slug;
    
    if (!slug) {
      slug = generatePublicSlug(company.name, companyId);
      await conn.execute(
        `UPDATE companies SET slug = ? WHERE id = ?`,
        [slug, companyId]
      );
    }

    await conn.commit();

    // Construct public URL
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
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

  } catch (err) {
    await conn.rollback();
    console.error("[GET /qr-code/download]", err.message);

    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive")
      ? 403
      : 500;

    res.status(statusCode).json({
      message: err.message || "Failed to download QR code",
    });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/conference/bookings
 * Returns all bookings for the company
 */
router.get("/bookings", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Validate subscription
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
    console.error("[GET /bookings]", err.message);

    const statusCode = err.message.includes("expired") || 
                       err.message.includes("inactive")
      ? 403
      : 500;

    res.status(statusCode).json({
      message: err.message || "Failed to fetch bookings",
    });
  }
});

export default router;
