"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= TIME SLOTS ================= */
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const mins = 9 * 60 + 30 + i * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function ConferenceBookings() {
  const router = useRouter();

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");

  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= LOAD DATA ================= */
  const loadAll = async () => {
    try {
      const [b, r] = await Promise.all([
        apiFetch("/api/conference/bookings"),
        apiFetch("/api/conference/rooms")
      ]);
      setBookings(b);
      setRooms(r);
    } catch {
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ================= BOOKINGS FOR SELECTED DAY ================= */
  const dayBookings = useMemo(() => {
    if (!roomId || !date) return [];
    return bookings.filter(
      (b) => b.room_id == roomId && b.booking_date === date
    );
  }, [bookings, roomId, date]);

  /* ================= BOOKED SLOT MAP ================= */
  const bookedSlots = useMemo(() => {
    const set = new Set();
    dayBookings.forEach((b) => {
      TIME_SLOTS.forEach((t) => {
        if (t >= b.start_time && t < b.end_time) set.add(t);
      });
    });
    return set;
  }, [dayBookings]);

  /* ================= CREATE BOOKING ================= */
  const createBooking = async () => {
    if (!roomId || !date || !slot || !department) {
      return setError("All fields are required");
    }

    const idx = TIME_SLOTS.indexOf(slot);
    const endTime = TIME_SLOTS[idx + 1];
    if (!endTime) return setError("Invalid time slot");

    setLoading(true);
    setError("");

    try {
      await apiFetch("/api/conference/bookings", {
        method: "POST",
        body: JSON.stringify({
          room_id: roomId,
          booked_by: "ADMIN",
          purpose: `${department} - ${purpose || "Meeting"}`,
          booking_date: date,
          start_time: slot,
          end_time: endTime
        })
      });

      setSlot("");
      setPurpose("");
      setDepartment("");
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ================= LEFT : CALENDAR ================= */}
      <div className={styles.calendarPane}>
        <h3>Select Date</h3>

        <input
          type="date"
          min={new Date().toISOString().split("T")[0]}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <h3 className={styles.sub}>Available Slots</h3>

        <div className={styles.slotGrid}>
          {TIME_SLOTS.map((t) => (
            <button
              key={t}
              className={`${styles.slot} ${
                slot === t ? styles.selected : ""
              }`}
              disabled={bookedSlots.has(t)}
              onClick={() => setSlot(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ================= RIGHT : BOOKING FORM ================= */}
      <div className={styles.formPane}>
        <h2>Book Conference Room</h2>

        {error && <p className={styles.error}>{error}</p>}

        <label>Conference Room</label>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Select Room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.room_name} (#{r.room_number})
            </option>
          ))}
        </select>

        <label>Department</label>
        <input
          placeholder="Eg: HR, Engineering, Finance"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />

        <label>Purpose</label>
        <input
          placeholder="Optional"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />

        <div className={styles.summary}>
          <p><b>Date:</b> {date || "-"}</p>
          <p><b>Time:</b> {slot || "-"} {slot && " → " + TIME_SLOTS[TIME_SLOTS.indexOf(slot) + 1]}</p>
        </div>

        <button onClick={createBooking} disabled={loading}>
          {loading ? "Booking..." : "Confirm Booking"}
        </button>
      </div>
    </div>
  );
}
