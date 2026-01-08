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
   PLAN CHECKER
   (Company rooms column will NOT restrict, only informative)
====================================================== */
const checkConferencePlan = async (companyId) => {
  const [[company]] = await db.query(
    `
    SELECT 
      plan,
      subscription_status,
      trial_ends_at,
      subscription_ends_at,
      rooms AS company_registered_rooms
    FROM companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  if (!company)
    throw new Error("Company not found");

  const PLAN = (company.plan || "TRIAL").toUpperCase();
  const STATUS = (company.subscription_status || "PENDING").toUpperCase();
  const now = new Date();

  if (!["ACTIVE", "TRIAL"].includes(STATUS))
    throw new Error("Subscription inactive. Please renew");

  let planLimit = 2;

  if (PLAN === "TRIAL") {
    if (!company.trial_ends_at || new Date(company.trial_ends_at) < now)
      throw new Error("Trial expired. Please upgrade");

    planLimit = 2;
  }

  else if (PLAN === "BUSINESS") {
    if (!company.subscription_ends_at || new Date(company.subscription_ends_at) < now)
      throw new Error("Business plan expired. Please renew");

    planLimit = 6;
  }

  else {
    planLimit = Infinity;
  }

  return {
    plan: PLAN,
    limit: planLimit,
    registeredRooms: company.company_registered_rooms || 0
  };
};

/* ======================================================
   PLAN USAGE API
====================================================== */
router.get("/plan-usage", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const { plan, limit, registeredRooms } =
      await checkConferencePlan(companyId);

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    const used = countRow.total;
    const remaining =
      limit === Infinity ? null : Math.max(limit - used, 0);

    res.json({
      plan,
      plan_limit: limit === Infinity ? "UNLIMITED" : limit,
      registered_during_signup: registeredRooms,
      used,
      remaining
    });

  } catch (err) {
    console.error("[CONF PLAN USAGE]", err);
    res.status(403).json({ message: err.message || "Plan error" });
  }
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
        (SELECT COUNT(*) FROM conference_bookings WHERE company_id = ? 
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
   CREATE ROOM (Allowed till Plan Limit)
====================================================== */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number } = req.body;

    if (!room_name || !room_number)
      return res.status(400).json({
        message: "Room name & number required"
      });

    const { limit } = await checkConferencePlan(companyId);

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total 
       FROM conference_rooms 
       WHERE company_id = ?`,
      [companyId]
    );

    if (limit !== Infinity && countRow.total >= limit)
      return res.status(403).json({
        message: `You can only create ${limit} rooms. Upgrade plan to add more.`,
      });

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
   RENAME ROOM (Always Allowed if Exists)
====================================================== */
router.post("/rooms/rename", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.body.id);
    const { room_name } = req.body;

    if (!roomId || isNaN(roomId))
      return res.status(400).json({ message: "Invalid room id" });

    if (!room_name || !room_name.trim())
      return res.status(400).json({ message: "Room name required" });

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

    if (!room)
      return res.status(404).json({ message: "Room not found" });

    if (room.room_name === newName)
      return res.json({ message: "No change", room });

    const [result] = await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [newName, roomId, companyId]
    );

    if (!result.affectedRows)
      return res.status(400).json({ message: "Rename failed" });

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
