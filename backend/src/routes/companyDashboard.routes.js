import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   PLAN CONFIG
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

/* ======================================================
   PLAN CHECKER (NO LIMIT LOGIC HERE)
====================================================== */
const checkConferencePlan = async (companyId) => {
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

  return { plan };
};

/* ======================================================
   SYNC ROOMS BASED ON PLAN (CORE LOGIC)
====================================================== */
export const syncActiveRoomsByPlan = async (companyId, plan) => {
  const limit = PLANS[plan] ?? 0;

  // Deactivate all rooms
  await db.query(
    `UPDATE conference_rooms SET is_active = 0 WHERE company_id = ?`,
    [companyId]
  );

  // Unlimited plan → activate all
  if (limit === Infinity) {
    await db.query(
      `UPDATE conference_rooms SET is_active = 1 WHERE company_id = ?`,
      [companyId]
    );
    return;
  }

  // Activate only first N rooms
  await db.query(
    `
    UPDATE conference_rooms
    SET is_active = 1
    WHERE id IN (
      SELECT id FROM (
        SELECT id
        FROM conference_rooms
        WHERE company_id = ?
        ORDER BY room_number ASC
        LIMIT ?
      ) t
    )
    `,
    [companyId, limit]
  );
};

/* ======================================================
   GET ACTIVE ROOMS
====================================================== */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await checkConferencePlan(companyId);

    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name, capacity
      FROM conference_rooms
      WHERE company_id = ? AND is_active = 1
      ORDER BY room_number ASC
      `,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    console.error("[CONF GET ROOMS]", err);
    res.status(403).json({ message: err.message });
  }
});

/* ======================================================
   GET ALL ROOMS (ADMIN VIEW)
====================================================== */
router.get("/rooms/all", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name, capacity, is_active
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [companyId]
    );

    res.json(rooms);
  } catch (err) {
    console.error("[CONF GET ALL ROOMS]", err);
    res.status(500).json({ message: "Unable to load rooms" });
  }
});

/* ======================================================
   CREATE ROOM (DEFAULT INACTIVE)
====================================================== */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number, capacity } = req.body;

    if (!room_name?.trim() || !room_number)
      return res.status(400).json({ message: "Room name & number required" });

    await db.query(
      `
      INSERT INTO conference_rooms
      (company_id, room_number, room_name, capacity, is_active)
      VALUES (?, ?, ?, ?, 0)
      `,
      [companyId, room_number, room_name.trim(), capacity || 0]
    );

    res.status(201).json({
      message:
        "Room created successfully. It will activate automatically based on your plan.",
    });
  } catch (err) {
    console.error("[CONF CREATE ROOM]", err);
    res.status(500).json({ message: err.message });
  }
});

/* ======================================================
   RENAME ROOM (ACTIVE ONLY)
====================================================== */
router.post("/rooms/rename", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.body.id);
    const { room_name } = req.body;

    if (!roomId || !room_name?.trim())
      return res.status(400).json({ message: "Invalid request" });

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
        message: "This room is locked. Upgrade your plan to rename it.",
      });

    await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?
      WHERE id = ? AND company_id = ?
      `,
      [room_name.trim(), roomId, companyId]
    );

    res.json({ message: "Room renamed successfully" });
  } catch (err) {
    console.error("[CONF RENAME ROOM]", err);
    res.status(500).json({ message: err.message });
  }
});

/* ======================================================
   DASHBOARD (ACTIVE ROOMS ONLY)
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await checkConferencePlan(companyId);

    const [[stats]] = await db.query(
      `
      SELECT
        COUNT(DISTINCT cr.id) AS rooms,
        COUNT(cb.id) AS totalBookings,
        SUM(DATE(cb.booking_date) = CURDATE()) AS todayBookings
      FROM conference_rooms cr
      LEFT JOIN conference_bookings cb ON cb.room_id = cr.id
      WHERE cr.company_id = ?
        AND cr.is_active = 1
      `,
      [companyId]
    );

    res.json(stats);
  } catch (err) {
    console.error("[CONF DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ======================================================
   PLAN USAGE (FRONTEND DISPLAY)
====================================================== */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plan } = await checkConferencePlan(companyId);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    const [[{ active }]] = await db.query(
      `
      SELECT COUNT(*) AS active
      FROM conference_rooms
      WHERE company_id = ? AND is_active = 1
      `,
      [companyId]
    );

    const limit = PLANS[plan];

    res.json({
      plan,
      plan_limit: limit === Infinity ? "UNLIMITED" : limit,
      used: active,
      total_rooms: total,
      remaining: limit === Infinity ? null : Math.max(limit - active, 0),
      inactive_rooms: total - active,
    });
  } catch (err) {
    console.error("[CONF PLAN USAGE]", err);
    res.status(403).json({ message: err.message });
  }
});

export default router;
