import express from "express";
import { db } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ================= AUTH ================= */
router.use(authMiddleware);

/* ======================================================
   PLAN CHECK + REMAINING QUOTA
====================================================== */
const checkConferencePlan = async (companyId) => {
  const [[company]] = await db.query(
    `
    SELECT
      plan,
      trial_ends_at,
      subscription_ends_at,
      subscription_status
    FROM companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  if (!company)
    return { ok: false, message: "Company not found" };

  const plan = (company.plan || "trial").toLowerCase();
  const status = (company.subscription_status || "trial").toLowerCase();
  const now = new Date();

  let remaining = {
    rooms_left: "unlimited",
    conference_bookings_left: "unlimited"
  };

  // Count rooms
  const [[roomCount]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM conference_rooms WHERE company_id = ?`,
    [companyId]
  );

  // Count bookings
  const [[bookingCount]] = await db.query(
    `SELECT COUNT(*) AS cnt 
     FROM conference_bookings 
     WHERE company_id = ? 
       AND status='BOOKED'`,
    [companyId]
  );

  /* -------- TRIAL -------- */
  if (plan === "trial") {
    if (!company.trial_ends_at)
      return { ok: false, message: "Trial not initialized" };

    if (now > new Date(company.trial_ends_at))
      return {
        ok: false,
        message: "Your trial expired. Please upgrade plan.",
        remaining: {
          rooms_left: 0,
          conference_bookings_left: 0
        }
      };

    remaining.rooms_left = Math.max(0, 2 - roomCount.cnt);
    remaining.conference_bookings_left = Math.max(0, 100 - bookingCount.cnt);

    if (roomCount.cnt > 2) {
      return {
        ok: false,
        message: "Plan limit exceeded. Please contact administrator",
        remaining
      };
    }

    if (bookingCount.cnt >= 100) {
      return {
        ok: false,
        message: "Plan limit exceeded. Please contact administrator",
        remaining
      };
    }
  }

  /* -------- BUSINESS -------- */
  if (plan === "business") {
    if (status !== "active")
      return { ok: false, message: "Subscription not active", remaining };

    if (!company.subscription_ends_at || now > new Date(company.subscription_ends_at))
      return { ok: false, message: "Subscription expired", remaining };

    remaining.rooms_left = Math.max(0, 6 - roomCount.cnt);
    remaining.conference_bookings_left = Math.max(0, 1000 - bookingCount.cnt);

    // Rooms exceeded
    if (roomCount.cnt > 6) {
      return {
        ok: false,
        message: "Plan limit exceeded. Please contact administrator",
        remaining
      };
    }

    // Booking exceeded
    if (bookingCount.cnt >= 1000) {
      return {
        ok: false,
        message: "Plan limit exceeded. Please contact administrator",
        remaining
      };
    }
  }

  /* -------- ENTERPRISE -------- */
  if (plan === "enterprise") {
    if (status !== "active")
      return { ok: false, message: "Enterprise subscription not active" };

    remaining.rooms_left = "unlimited";
    remaining.conference_bookings_left = "unlimited";
  }

  return { ok: true, remaining };
};

/* ================= DASHBOARD STATS ================= */
router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [[rooms]] = await db.query(
      "SELECT COUNT(*) AS total FROM conference_rooms WHERE company_id = ?",
      [companyId]
    );

    const [[bookings]] = await db.query(
      "SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?",
      [companyId]
    );

    const [[today]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM conference_bookings
      WHERE company_id = ?
      AND booking_date = CURDATE()
      `,
      [companyId]
    );

    res.json({
      rooms: rooms.total,
      totalBookings: bookings.total,
      todayBookings: today.total
    });
  } catch (err) {
    console.error("[CONF DASHBOARD]", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ================= GET ROOMS ================= */
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

    res.json(rooms || []);
  } catch (err) {
    console.error("[CONF GET ROOMS]", err);
    res.status(500).json({ message: "Unable to load rooms" });
  }
});

/* ================= CREATE ROOM ================= */
router.post("/rooms", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { room_name, room_number } = req.body;

    if (!room_name || !room_number) {
      return res.status(400).json({
        message: "Room name and room number are required"
      });
    }

    const planCheck = await checkConferencePlan(companyId);
    if (!planCheck.ok)
      return res.status(403).json({
        message: planCheck.message,
        remaining: planCheck.remaining || null
      });

    await db.query(
      `
      INSERT INTO conference_rooms
      (company_id, room_number, room_name)
      VALUES (?, ?, ?)
      `,
      [companyId, room_number, room_name.trim()]
    );

    res.status(201).json({
      message: "Room created successfully",
      remaining: planCheck.remaining
    });
  } catch (err) {
    console.error("[CONF CREATE ROOM]", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

/* ================= RENAME ROOM ================= */
router.put("/rooms/:id", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = req.params.id;
    const { room_name } = req.body;

    if (!room_name || !room_name.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    const planCheck = await checkConferencePlan(companyId);

    if (!planCheck.ok) {
      return res.status(403).json({
        message: "Plan limit exceeded. Please contact administrator",
        remaining: planCheck.remaining
      });
    }

    const [result] = await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [room_name.trim(), roomId, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Room not found or not authorized"
      });
    }

    res.json({
      message: "Room renamed successfully",
      remaining: planCheck.remaining
    });

  } catch (err) {
    console.error("[CONF RENAME ROOM]", err);
    res.status(500).json({ message: "Unable to rename room" });
  }
});

export default router;
