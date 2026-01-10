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
const isExpired = (date) =>
  !date || new Date(date).getTime() < Date.now();

/**
 * Validates company subscription & returns plan context
 */
const getPlanContext = async (companyId) => {
  const [[company]] = await db.query(
    `
    SELECT plan, subscription_status, trial_ends_at, subscription_ends_at
    FROM companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  if (!company) throw new Error("Company not found");

  const plan = (company.plan || "TRIAL").toUpperCase();
  const status = (company.subscription_status || "PENDING").toUpperCase();

  if (!ACTIVE_STATUSES.includes(status))
    throw new Error("Subscription inactive. Please upgrade.");

  if (plan === "TRIAL" && isExpired(company.trial_ends_at))
    throw new Error("Trial expired. Please upgrade.");

  if (plan !== "TRIAL" && isExpired(company.subscription_ends_at))
    throw new Error("Subscription expired. Please renew.");

  return { plan, limit: PLANS[plan] ?? 0 };
};

/**
 * CORE: Sync room activation strictly by plan limit
 * - First N rooms (by room_number, id) stay active
 * - Others are locked
 */
const syncRoomsWithPlan = async (companyId, limit) => {
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
      `
      UPDATE conference_rooms
      SET is_active = 1
      WHERE id IN (
        SELECT id FROM (
          SELECT id
          FROM conference_rooms
          WHERE company_id = ?
          ORDER BY room_number ASC, id ASC
          LIMIT ?
        ) t
      )
      `,
      [companyId, limit]
    );
  }
};

/* ======================================================
   ROUTES
====================================================== */

/**
 * GET ACTIVE ROOMS (FOR USERS)
 */
router.get("/rooms", async (req, res) => {
  try {
    const { limit } = await getPlanContext(req.user.company_id);
    await syncRoomsWithPlan(req.user.company_id, limit);

    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name, capacity
      FROM conference_rooms
      WHERE company_id = ? AND is_active = 1
      ORDER BY room_number ASC
      `,
      [req.user.company_id]
    );

    res.json(rooms);
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

/**
 * GET ALL ROOMS (ADMIN VIEW)
 */
router.get("/rooms/all", async (req, res) => {
  try {
    const { limit } = await getPlanContext(req.user.company_id);
    await syncRoomsWithPlan(req.user.company_id, limit);

    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name, capacity, is_active
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [req.user.company_id]
    );

    res.json({
      limit: limit === Infinity ? "Unlimited" : limit,
      rooms,
    });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

/**
 * CREATE ROOM (ADMIN)
 * - Always created as inactive
 * - Auto-sync decides activation
 */
router.post("/rooms", async (req, res) => {
  try {
    const { room_name, room_number, capacity } = req.body;

    if (!room_name?.trim() || !room_number)
      return res.status(400).json({ message: "Room name and number required" });

    const companyId = req.user.company_id;
    const { limit } = await getPlanContext(companyId);

    await db.query(
      `
      INSERT INTO conference_rooms
      (company_id, room_number, room_name, capacity, is_active)
      VALUES (?, ?, ?, ?, 0)
      `,
      [companyId, room_number, room_name.trim(), capacity || 0]
    );

    await syncRoomsWithPlan(companyId, limit);

    res.status(201).json({
      message: "Room created. Activation depends on your current plan.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * UPDATE / RENAME ROOM (ONLY IF ACTIVE)
 */
router.patch("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = req.params.id;
    const { room_name, capacity } = req.body;

    const { limit } = await getPlanContext(companyId);
    await syncRoomsWithPlan(companyId, limit);

    const [[room]] = await db.query(
      `
      SELECT is_active
      FROM conference_rooms
      WHERE id = ? AND company_id = ?
      `,
      [roomId, companyId]
    );

    if (!room)
      return res.status(404).json({ message: "Room not found" });

    if (!room.is_active)
      return res.status(403).json({
        message:
          "This room is locked under your current plan. Upgrade to edit.",
      });

    await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?, capacity = ?
      WHERE id = ?
      `,
      [room_name.trim(), capacity || 0, roomId]
    );

    res.json({ message: "Room updated successfully" });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

/**
 * PLAN USAGE (UI HELPER)
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
      totalRooms: total,
      activeRooms: active,
      lockedRooms: Math.max(0, total - active),
      upgradeRequired: limit !== Infinity && total > limit,
    });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

export default router;
