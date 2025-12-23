"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ===== TIME OPTIONS ===== */
const TIMES = [];
for (let h = 9; h <= 19; h++) {
  TIMES.push(`${h === 12 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`);
  TIMES.push(`${h === 12 ? 12 : h % 12}:30 ${h < 12 ? "AM" : "PM"}`);
}

const to24 = (t) => {
  const [time, ap] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export default function ConferenceBookings() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [date, setDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ===== LOAD ===== */
  const loadAll = async () => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) setCompany(JSON.parse(stored));

      const [r, b] = await Promise.all([
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings")
      ]);

      setRooms(r);
      setBookings(b);
    } catch (e) {
      if (e.code === 401) router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ===== DAY BOOKINGS ===== */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      b => b.booking_date === date && b.room_id == roomId
    );
  }, [bookings, date, roomId]);

  /* ===== AVAILABLE SLOTS ===== */
  const unavailable = useMemo(() => {
    const set = new Set();
    dayBookings.forEach(b => {
      TIMES.forEach(t => {
        if (to24(t) >= b.start_time && to24(t) < b.end_time) {
          set.add(t);
        }
      });
    });
    return set;
  }, [dayBookings]);

  /* ===== CREATE BOOKING ===== */
  const createBooking = async () => {
    setError(""); setSuccess("");

    if (!date || !roomId || !start || !end || !department) {
      return setError("All required fields must be filled");
    }

    try {
      await apiFetch("/api/conference/bookings", {
        method: "POST",
        body: JSON.stringify({
          room_id: roomId,
          booked_by: "ADMIN",
          department,
          purpose,
          booking_date: date,
          start_time: to24(start),
          end_time: to24(end)
        })
      });

      setSuccess("Booking created successfully");
      setStart(""); setEnd(""); setDepartment(""); setPurpose("");
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>←</button>
        <h1>{company.name}</h1>
        <img src={company.logo_url} alt="logo" />
      </header>

      <div className={styles.content}>
        {/* LEFT FORM */}
        <div className={styles.card}>
          <h2>Book Conference Room</h2>
          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>✔ {success}</p>}

          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />

          <label>Room</label>
          <select value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">Select</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.room_name}</option>
            ))}
          </select>

          <label>Start Time</label>
          <select value={start} onChange={e => setStart(e.target.value)}>
            <option value="">Select</option>
            {TIMES.filter(t => !unavailable.has(t)).map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label>End Time</label>
          <select value={end} onChange={e => setEnd(e.target.value)}>
            <option value="">Select</option>
            {TIMES.filter(t => t > start && !unavailable.has(t)).map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label>Department</label>
          <input value={department} onChange={e => setDepartment(e.target.value)} />

          <label>Purpose</label>
          <input value={purpose} onChange={e => setPurpose(e.target.value)} />

          <button className={styles.primaryBtn} onClick={createBooking}>
            Confirm Booking
          </button>
        </div>

        {/* RIGHT PANEL */}
        <div className={styles.side}>
          <h3>Bookings</h3>
          {dayBookings.length === 0 && <p>No bookings</p>}

          {dayBookings.map(b => (
            <div key={b.id} className={styles.slotBooked}>
              {b.start_time} – {b.end_time}
              <span>{b.department}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
