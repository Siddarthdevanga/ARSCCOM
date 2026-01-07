import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   MIDDLEWARE
====================================================== */
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(authMiddleware);

/* ======================================================
   PLAN CHECKER (Re-usable)
====================================================== */
const checkConferencePlan = async (companyId) => {
  const [[company]] = await db.query(
    `
    SELECT 
      plan,
      subscription_status,
      trial_ends_at,
      subscription_ends_at
    FROM companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  if (!company)
    throw new Error("Plan validity exceeded. Contact Administrator");

  const PLAN = (company.plan || "TRIAL").toUpperCase();
  const STATUS = (company.subscription_status || "TRIAL").toUpperCase();
  const now = new Date();

  if (!["ACTIVE", "TRIAL"].includes(STATUS))
    throw new Error("Plan validity exceeded. Contact Administrator");

  /* ---------- TRIAL ---------- */
  if (PLAN === "TRIAL") {
    if (!company.trial_ends_at || new Date(company.trial_ends_at) < now)
      throw new Error("Plan validity exceeded. Contact Administrator");

    return { plan: "TRIAL", limit: 2 };
  }

  /* ---------- BUSINESS ---------- */
  if (PLAN === "BUSINESS") {
    if (!company.subscription_ends_at || new Date(company.subscription_ends_at) < now)
      throw new Error("Plan validity exceeded. Contact Administrator");

    return { plan: "BUSINESS", limit: 6 };
  }

  /* ---------- ENTERPRISE ---------- */
  return { plan: "ENTERPRISE", limit: Infinity };
};

/* ======================================================
   PLAN USAGE  ⭐ (Used by Frontend Scroll Bar)
====================================================== */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const { plan, limit } = await checkConferencePlan(companyId);

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    const used = countRow.total;
    const remaining = limit === Infinity ? null : Math.max(limit - used, 0);

    res.json({
      plan,
      limit: limit === Infinity ? "UNLIMITED" : limit,
      used,
      remaining
    });

  } catch (err) {
    console.error("[CONF PLAN USAGE]", err);
    res.status(403).json({
      message: err.message || "Plan error"
    });
  }
});

/* ======================================================
   HEALTH CHECK
====================================================== */
router.get("/health", (req, res) => {
  res.json({ ok: true, route: "conference router active" });
});

/* ======================================================
   DASHBOARD
====================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [[stats]] = await db.query(
      `
      SELECT
        (SELECT COUNT(*) FROM conference_rooms WHERE company_id = ?) AS rooms,
        (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ?) AS totalBookings,
        (SELECT COUNT(*)
         FROM conference_bookings
         WHERE company_id = ?
         AND booking_date = CURDATE()) AS todayBookings
      `,
      [companyId, companyId, companyId]
    );

    res.json(stats);
  } catch (err) {
    console.error("[CONF DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ======================================================
   GET ROOMS
====================================================== */
router.get("/rooms", async (req, res) => {
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

    res.json(Array.isArray(rooms) ? rooms : []);
  } catch (err) {
    console.error("[CONF GET ROOMS]", err);
    res.status(500).json({ message: "Unable to load rooms" });
  }
});

/* ======================================================
   CREATE ROOM
====================================================== */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number } = req.body;

    if (!room_name || !room_number) {
      return res.status(400).json({
        message: "Room name and room number are required",
      });
    }

    const { limit } = await checkConferencePlan(companyId);

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    if (limit !== Infinity && countRow.total >= limit) {
      return res.status(403).json({
        message: "Plan limit reached. Contact Administrator",
      });
    }

    await db.query(
      `
      INSERT INTO conference_rooms
      (company_id, room_number, room_name)
      VALUES (?, ?, ?)
      `,
      [companyId, room_number, room_name.trim()]
    );

    res.status(201).json({ message: "Room created successfully" });

  } catch (err) {
    console.error("[CONF CREATE ROOM]", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

/* ======================================================
   RENAME ROOM
====================================================== */
router.post("/rooms/rename", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.body.id);
    const { room_name } = req.body;

    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: "Invalid room id" });
    }

    if (!room_name || !room_name.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    const { limit } = await checkConferencePlan(companyId);

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    // BLOCK rename if company has more rooms than plan allows
    if (limit !== Infinity && countRow.total > limit) {
      return res.status(403).json({
        message: "Plan validity exceeded. Contact Administrator"
      });
    }

    const newName = room_name.trim();

    const [[room]] = await db.query(
      `
      SELECT id, room_name
      FROM conference_rooms
      WHERE id = ?
      AND company_id = ?
      LIMIT 1
      `,
      [roomId, companyId]
    );

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.room_name === newName) {
      return res.json({ message: "Room name unchanged", room });
    }

    const [result] = await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [newName, roomId, companyId]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ message: "Rename failed" });
    }

    res.json({
      message: "Room renamed successfully",
      room: { id: roomId, room_name: newName },
    });

  } catch (err) {
    console.error("[CONF RENAME ROOM]", err);
    res.status(500).json({
      message: err.message || "Unable to rename room"
    });
  }
});

export default router;
