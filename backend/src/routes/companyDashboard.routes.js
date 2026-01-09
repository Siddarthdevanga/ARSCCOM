import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   CONSTANTS
====================================================== */
const PLANS = {
  TRIAL: { limit: 2 },
  BUSINESS: { limit: 6 },
  ENTERPRISE: { limit: Infinity }
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
const isExpired = (date) => !date || new Date(date) < new Date();

// ✅ NEW: Get active rooms based on plan limits
const getActiveRooms = async (companyId, planLimit) => {
  const [allRooms] = await db.query(
    `SELECT id, room_number, room_name FROM conference_rooms WHERE company_id = ? ORDER BY room_number ASC`,
    [companyId]
  );
  
  if (planLimit === Infinity) return allRooms;
  
  return allRooms.slice(0, planLimit);
};

/* ======================================================
   PLAN CHECKER - REFINED
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

  const PLAN = (company.plan || "TRIAL").toUpperCase();
  const STATUS = (company.subscription_status || "PENDING").toUpperCase();

  if (!ACTIVE_STATUSES.includes(STATUS))
    throw new Error("Subscription inactive. Please upgrade");

  if (PLAN === "TRIAL" && isExpired(company.trial_ends_at))
    throw new Error("Trial expired. Please upgrade");

  if (PLAN === "BUSINESS" && isExpired(company.subscription_ends_at))
    throw new Error("Business plan expired. Please renew");

  const limit = PLANS[PLAN]?.limit ?? Infinity;
  return { plan: PLAN, limit };
};

/* ======================================================
   PLAN USAGE - UPDATED ✅
====================================================== */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plan, limit } = await checkConferencePlan(companyId);

    const [[{ total: allRooms }]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    const [activeRooms] = await getActiveRooms(companyId, limit);
    const activeCount = activeRooms.length;

    res.json({
      plan,
      plan_limit: limit === Infinity ? "UNLIMITED" : limit,
      used: activeCount,           // ✅ Only active rooms count
      total_rooms: allRooms,       // ✅ Total rooms company provided
      remaining: limit === Infinity ? null : Math.max(limit - activeCount, 0),
      inactive_rooms: Math.max(0, allRooms - activeCount)
    });

  } catch (err) {
    console.error("[CONF PLAN USAGE]", err);
    res.status(403).json({ message: err.message });
  }
});

/* ======================================================
   DASHBOARD - UPDATED ✅
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { limit } = await checkConferencePlan(companyId);

    // ✅ Only count bookings from ACTIVE rooms (first N based on plan)
    const [[stats]] = await db.query(
      `
      SELECT
        COUNT(DISTINCT cr.id) AS rooms,
        COUNT(cb.id) AS totalBookings,
        SUM(cb.booking_date = CURDATE()) AS todayBookings
      FROM conference_rooms cr
      LEFT JOIN conference_bookings cb ON cb.room_id = cr.id
      WHERE cr.company_id = ? AND cr.id IN (
        SELECT id FROM (
          SELECT id FROM conference_rooms 
          WHERE company_id = ? 
          ORDER BY room_number ASC 
          LIMIT ?
        ) active_rooms
      )
      `,
      [companyId, companyId, limit]
    );

    res.json(stats);
  } catch (err) {
    console.error("[CONF DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ======================================================
   GET ROOMS - UPDATED ✅ (Returns only ACTIVE rooms)
====================================================== */
router.get("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { limit } = await checkConferencePlan(companyId);

    const activeRooms = await getActiveRooms(companyId, limit);
    res.json(activeRooms); // ✅ Only returns plan-limited rooms

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

    const [[{ total: activeCount }]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    if (limit !== Infinity && activeCount >= limit)
      return res.status(403).json({
        message: `Your plan allows only ${limit} rooms. Upgrade to add more.`
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
   GET ALL ROOMS (Admin view - shows inactive ones too)
====================================================== */
router.get("/rooms/all", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rooms] = await db.query(
      `SELECT id, room_number, room_name FROM conference_rooms WHERE company_id = ? ORDER BY room_number ASC`,
      [companyId]
    );
    res.json(rooms);
  } catch (err) {
    console.error("[CONF GET ALL ROOMS]", err);
    res.status(500).json({ message: "Unable to load all rooms" });
  }
});

/* ======================================================
   RENAME ROOM (Plan ENFORCED - only first N rooms)
====================================================== */
router.post("/rooms/rename", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.body.id);
    const { room_name } = req.body;

    if (!roomId)
      return res.status(400).json({ message: "Invalid room id" });

    if (!room_name?.trim())
      return res.status(400).json({ message: "Room name required" });

    const { plan, limit } = await checkConferencePlan(companyId);

    // ✅ Check if room is within active limit
    const [rooms] = await db.query(
      `SELECT id FROM conference_rooms WHERE company_id = ? ORDER BY room_number ASC`,
      [companyId]
    );

    const allowedRoomIds = limit === Infinity 
      ? rooms.map(r => r.id) 
      : rooms.slice(0, limit).map(r => r.id);

    if (!allowedRoomIds.includes(roomId)) {
      return res.status(403).json({
        message: plan === "TRIAL"
          ? "Trial plan allows renaming only first 2 rooms. Upgrade to rename more."
          : `Your ${plan} plan allows renaming only first ${limit} rooms. Upgrade to rename more.`
      });
    }

    const [[room]] = await db.query(
      `SELECT room_name FROM conference_rooms WHERE id = ? AND company_id = ?`,
      [roomId, companyId]
    );

    if (!room)
      return res.status(404).json({ message: "Room not found" });

    const newName = room_name.trim();
    if (room.room_name === newName)
      return res.json({ message: "No change", room });

    await db.query(
      `UPDATE conference_rooms SET room_name = ? WHERE id = ? AND company_id = ?`,
      [newName, roomId, companyId]
    );

    res.json({
      message: "Room renamed successfully",
      room: { id: roomId, room_name: newName }
    });
  } catch (err) {
    console.error("[CONF RENAME ROOM]", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
