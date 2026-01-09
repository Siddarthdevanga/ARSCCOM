import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   CONSTANTS
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

/* ------------------------------------------------------
   PLAN CHECKER (SINGLE SOURCE OF TRUTH)
------------------------------------------------------ */
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

  if (plan === "BUSINESS" && isExpired(company.subscription_ends_at))
    throw new Error("Business plan expired. Please renew.");

  return {
    plan,
    limit: PLANS[plan] ?? Infinity,
  };
};

/* ------------------------------------------------------
   GET ACTIVE ROOMS (PLAN AWARE)
------------------------------------------------------ */
const getActiveRooms = async (companyId, limit) => {
  if (limit === Infinity) {
    const [rows] = await db.query(
      `
      SELECT id, room_number, room_name
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [companyId]
    );
    return rows;
  }

  const [rows] = await db.query(
    `
    SELECT id, room_number, room_name
    FROM conference_rooms
    WHERE company_id = ?
    ORDER BY room_number ASC
    LIMIT ?
    `,
    [companyId, limit]
  );

  return rows;
};

/* ======================================================
   PLAN USAGE
====================================================== */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plan, limit } = await checkConferencePlan(companyId);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    const activeRooms = await getActiveRooms(companyId, limit);

    res.json({
      plan,
      plan_limit: limit === Infinity ? "UNLIMITED" : limit,
      used: activeRooms.length,
      total_rooms: total,
      remaining: limit === Infinity ? null : Math.max(limit - activeRooms.length, 0),
      inactive_rooms: Math.max(0, total - activeRooms.length),
    });
  } catch (err) {
    console.error("[CONF PLAN USAGE]", err);
    res.status(403).json({ message: err.message });
  }
});

/* ======================================================
   DASHBOARD (ACTIVE ROOMS ONLY)
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { limit } = await checkConferencePlan(companyId);

    const limitValue = limit === Infinity ? 1000000 : limit;

    const [[stats]] = await db.query(
      `
      SELECT
        COUNT(DISTINCT cr.id) AS rooms,
        COUNT(cb.id) AS totalBookings,
        SUM(DATE(cb.booking_date) = CURDATE()) AS todayBookings
      FROM conference_rooms cr
      LEFT JOIN conference_bookings cb ON cb.room_id = cr.id
      WHERE cr.company_id = ?
        AND cr.id IN (
          SELECT id FROM (
            SELECT id
            FROM conference_rooms
            WHERE company_id = ?
            ORDER BY room_number ASC
            LIMIT ?
          ) t
        )
      `,
      [companyId, companyId, limitValue]
    );

    res.json(stats);
  } catch (err) {
    console.error("[CONF DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ======================================================
   GET ROOMS (ACTIVE ONLY)
====================================================== */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { limit } = await checkConferencePlan(companyId);

    const rooms = await getActiveRooms(companyId, limit);
    res.json(rooms);
  } catch (err) {
    console.error("[CONF GET ROOMS]", err);
    res.status(500).json({ message: "Unable to load rooms" });
  }
});

/* ======================================================
   CREATE ROOM (PLAN LIMITED)
====================================================== */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number } = req.body;

    if (!room_name?.trim() || !room_number)
      return res.status(400).json({ message: "Room name & number required" });

    const { limit } = await checkConferencePlan(companyId);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    if (limit !== Infinity && total >= limit)
      return res.status(403).json({
        message: `Your plan allows only ${limit} rooms. Upgrade to add more.`,
      });

    await db.query(
      `
      INSERT INTO conference_rooms (company_id, room_number, room_name)
      VALUES (?, ?, ?)
      `,
      [companyId, room_number, room_name.trim()]
    );

    res.status(201).json({ message: "Room created successfully" });
  } catch (err) {
    console.error("[CONF CREATE ROOM]", err);
    res.status(500).json({ message: err.message });
  }
});

/* ======================================================
   GET ALL ROOMS (ADMIN)
====================================================== */
router.get("/rooms/all", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rooms] = await db.query(
      `
      SELECT id, room_number, room_name
      FROM conference_rooms
      WHERE company_id = ?
      ORDER BY room_number ASC
      `,
      [companyId]
    );
    res.json(rooms);
  } catch (err) {
    console.error("[CONF GET ALL ROOMS]", err);
    res.status(500).json({ message: "Unable to load all rooms" });
  }
});

/* ======================================================
   RENAME ROOM (ACTIVE ROOMS ONLY)
====================================================== */
router.post("/rooms/rename", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.body.id);
    const { room_name } = req.body;

    if (!roomId || !room_name?.trim())
      return res.status(400).json({ message: "Invalid request" });

    const { plan, limit } = await checkConferencePlan(companyId);

    const activeRooms = await getActiveRooms(companyId, limit);
    const allowedIds = activeRooms.map((r) => r.id);

    if (!allowedIds.includes(roomId))
      return res.status(403).json({
        message:
          plan === "TRIAL"
            ? "Trial plan allows renaming only first 2 rooms."
            : `Your ${plan} plan allows renaming only first ${limit} rooms.`,
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

export default router;
