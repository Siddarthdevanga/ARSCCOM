import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* ================= GET COMPANY BY SLUG ================= */
router.get("/company/:slug", async (req, res) => {
  const { slug } = req.params;

  const [rows] = await db.query(
    "SELECT id, name, logo_url FROM companies WHERE slug = ?",
    [slug]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "Company not found" });
  }

  res.json(rows[0]);
});

/* ================= GET ROOMS ================= */
router.get("/company/:slug/rooms", async (req, res) => {
  const { slug } = req.params;

  const [[company]] = await db.query(
    "SELECT id FROM companies WHERE slug = ?",
    [slug]
  );

  if (!company) return res.status(404).json({ message: "Company not found" });

  const [rooms] = await db.query(
    "SELECT id, name, capacity FROM conference_rooms WHERE company_id = ? AND is_active = 1",
    [company.id]
  );

  res.json(rooms);
});

/* ================= GET BOOKINGS ================= */
router.get("/company/:slug/bookings", async (req, res) => {
  const { slug } = req.params;
  const { roomId, date } = req.query;

  const [[company]] = await db.query(
    "SELECT id FROM companies WHERE slug = ?",
    [slug]
  );

  if (!company) return res.status(404).json({ message: "Company not found" });

  const [bookings] = await db.query(
    `SELECT start_time, end_time, booked_by, purpose
     FROM conference_bookings
     WHERE company_id = ?
       AND room_id = ?
       AND booking_date = ?
       AND status = 'BOOKED'`,
    [company.id, roomId, date]
  );

  res.json(bookings);
});

/* ================= CREATE BOOKING ================= */
router.post("/company/:slug/book", async (req, res) => {
  const { slug } = req.params;
  const { roomId, bookedBy, purpose, date, startTime, endTime } = req.body;

  if (!roomId || !bookedBy || !date || !startTime || !endTime) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const [[company]] = await db.query(
    "SELECT id FROM companies WHERE slug = ?",
    [slug]
  );

  if (!company) return res.status(404).json({ message: "Company not found" });

  /* Prevent overlap */
  const [conflicts] = await db.query(
    `SELECT id FROM conference_bookings
     WHERE company_id = ?
       AND room_id = ?
       AND booking_date = ?
       AND status = 'BOOKED'
       AND (
         (? BETWEEN start_time AND end_time)
         OR (? BETWEEN start_time AND end_time)
       )`,
    [company.id, roomId, date, startTime, endTime]
  );

  if (conflicts.length) {
    return res.status(409).json({ message: "Slot already booked" });
  }

  await db.query(
    `INSERT INTO conference_bookings
     (company_id, room_id, booked_by, purpose, booking_date, start_time, end_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [company.id, roomId, bookedBy, purpose, date, startTime, endTime]
  );

  res.json({ message: "Booking confirmed" });
});

export default router;
