import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   PLAN CONFIGURATION
====================================================== */
const PLANS = {
  TRIAL: 2,
  BUSINESS: 6,
  ENTERPRISE: Infinity,
};

const ACTIVE_STATUSES = ["ACTIVE", "TRIAL"];

/* ======================================================
   MIDDLEWARE
====================================================== */
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(authMiddleware);

/* ======================================================
   HELPERS
====================================================== */
const isExpired = (date) => !date || new Date(date).getTime() < Date.now();

/**
 * Validates company subscription and returns the current plan limit.
 */
const getPlanContext = async (companyId) => {
  const [[company]] = await db.query(
    `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at 
     FROM companies WHERE id = ? LIMIT 1`,
    [companyId]
  );

  if (!company) throw new Error("Company not found");

  const plan = (company.plan || "TRIAL").toUpperCase();
  const status = (company.subscription_status || "PENDING").toUpperCase();

  if (!ACTIVE_STATUSES.includes(status))
    throw new Error("Subscription inactive. Please upgrade to manage rooms.");

  if (plan === "TRIAL" && isExpired(company.trial_ends_at))
    throw new Error("Trial period expired. Please upgrade to a paid plan.");

  if (plan !== "TRIAL" && isExpired(company.subscription_ends_at))
    throw new Error("Subscription expired. Please renew your plan.");

  return { plan, limit: PLANS[plan] ?? 0 };
};

/**
 * CORE LOGIC: Automatically syncs 'is_active' based on plan limits.
 * Sorting by 'room_number' ensures the first N rooms created are the ones activated.
 */
const autoSyncRooms = async (companyId, limit) => {
  // 1. Deactivate everything first
  await db.query(`UPDATE conference_rooms SET is_active = 0 WHERE company_id = ?`, [companyId]);

  // 2. Activate based on limit
  if (limit === Infinity) {
    await db.query(`UPDATE conference_rooms SET is_active = 1 WHERE company_id = ?`, [companyId]);
  } else if (limit > 0) {
    await db.query(
      `UPDATE conference_rooms 
       SET is_active = 1 
       WHERE id IN (
         SELECT id FROM (
           SELECT id FROM conference_rooms 
           WHERE company_id = ? 
           ORDER BY room_number ASC, id ASC 
           LIMIT ?
         ) tmp
       )`,
      [companyId, limit]
    );
  }
};

/* ======================================================
   ROUTES
====================================================== */

/**
 * GET ROOMS: Returns only active rooms for standard users/display.
 */
router.get("/rooms", async (req, res) => {
  try {
    const { limit } = await getPlanContext(req.user.company_id);
    
    // Always sync before fetching to ensure data integrity
    await autoSyncRooms(req.user.company_id, limit);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity 
       FROM conference_rooms 
       WHERE company_id = ? AND is_active = 1 
       ORDER BY room_number ASC`,
      [req.user.company_id]
    );
    res.json(rooms);
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

/**
 * GET ALL ROOMS: For admin management, showing which are locked.
 */
router.get("/rooms/all", async (req, res) => {
  try {
    const { limit } = await getPlanContext(req.user.company_id);
    await autoSyncRooms(req.user.company_id, limit);

    const [rooms] = await db.query(
      `SELECT id, room_number, room_name, capacity, is_active 
       FROM conference_rooms 
       WHERE company_id = ? 
       ORDER BY room_number ASC`,
      [req.user.company_id]
    );
    res.json({ rooms, limit: limit === Infinity ? "Unlimited" : limit });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

/**
 * CREATE ROOM: Automatically checks if new room can be active.
 */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number, capacity } = req.body;

    if (!room_name?.trim() || !room_number)
      return res.status(400).json({ message: "Room name and number are required" });

    const { limit } = await getPlanContext(companyId);

    await db.query(
      `INSERT INTO conference_rooms (company_id, room_number, room_name, capacity, is_active) 
       VALUES (?, ?, ?, ?, 0)`,
      [companyId, room_number, room_name.trim(), capacity || 0]
    );

    // Re-sync rooms: if this room fits in the limit, it will activate
    await autoSyncRooms(companyId, limit);

    res.status(201).json({ message: "Room added and synced with your current plan." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * RENAME/UPDATE ROOM: Only allowed if room is active under current plan.
 */
router.patch("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = req.params.id;
    const { room_name, capacity } = req.body;

    const { limit } = await getPlanContext(companyId);
    await autoSyncRooms(companyId, limit); // Ensure state is fresh

    const [[room]] = await db.query(
      `SELECT is_active FROM conference_rooms WHERE id = ? AND company_id = ?`,
      [roomId, companyId]
    );

    if (!room) return res.status(404).json({ message: "Room not found" });
    
    if (!room.is_active) {
      return res.status(403).json({ 
        message: "This room is locked under your current plan. Please upgrade to edit or use it." 
      });
    }

    await db.query(
      `UPDATE conference_rooms SET room_name = ?, capacity = ? WHERE id = ?`,
      [room_name.trim(), capacity, roomId]
    );

    res.json({ message: "Room updated successfully" });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

/**
 * PLAN USAGE: UI helper to show progress bars or upgrade prompts.
 */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plan, limit } = await getPlanContext(companyId);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    const [[{ active }]] = await db.query(
      `SELECT COUNT(*) AS active FROM conference_rooms WHERE company_id = ? AND is_active = 1`,
      [companyId]
    );

    res.json({
      plan,
      limit: limit === Infinity ? "Unlimited" : limit,
      activeCount: active,
      totalCount: total,
      isOverLimit: total > limit,
      upgradeRequired: total > limit
    });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

export default router;
