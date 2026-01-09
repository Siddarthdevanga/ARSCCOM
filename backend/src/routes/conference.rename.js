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
   RENAME ROOM (ACTIVE ROOMS ONLY)
====================================================== */
router.post("/", async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const roomId = Number(req.body.id);
    const newName = req.body.room_name?.trim();

    /* ---------------- VALIDATION ---------------- */
    if (!roomId || !newName) {
      return res.status(400).json({
        message: "Room ID and new room name are required",
      });
    }

    /* ---------------- FETCH ROOM ---------------- */
    const [[room]] = await db.query(
      `
      SELECT room_name, is_active
      FROM conference_rooms
      WHERE id = ? AND company_id = ?
      `,
      [roomId, companyId]
    );

    if (!room) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    /* ---------------- PLAN ENFORCEMENT ---------------- */
    if (!room.is_active) {
      return res.status(403).json({
        message: "This room is locked. Upgrade your plan to rename it.",
      });
    }

    /* ---------------- NO-OP CHECK ---------------- */
    if (room.room_name === newName) {
      return res.json({
        message: "No changes made",
        room: {
          id: roomId,
          room_name: room.room_name,
        },
      });
    }

    /* ---------------- UPDATE ---------------- */
    await db.query(
      `
      UPDATE conference_rooms
      SET room_name = ?
      WHERE id = ? AND company_id = ?
      `,
      [newName, roomId, companyId]
    );

    /* ---------------- RESPONSE ---------------- */
    res.json({
      message: "Room renamed successfully",
      room: {
        id: roomId,
        room_name: newName,
      },
    });
  } catch (err) {
    console.error("[CONF RENAME ROOM]", err);
    res.status(500).json({
      message: "Failed to rename room",
    });
  }
});

export default router;
