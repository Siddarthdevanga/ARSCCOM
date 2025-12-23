"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ===== TIME OPTIONS (AM/PM) ===== */
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
  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [date, setDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  /* ===== LOAD DATA ===== */
  const loadAll = async () => {
    const [c, r, b] = await Promise.all([
      apiFetch("/api/company/me"),
      apiFetch("/api/conference/rooms"),
      apiFetch("/api/conference/bookings")
    ]);
    setCompany(c);
    setRooms(r);
    setBookings(b);
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ===== DAY BOOKINGS ===== */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      (b) => b.room_id == roomId && b.booking_date === date
    );
  }, [bookings, date, roomId]);

  /* ===== CREATE BOOKING ===== */
  const createBooking = async () => {
    setError("");
    setSuccess("");

    if (!date || !roomId || !start || !end || !department) {
      return setError("All fields except purpose are required");
    }

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

    setSuccess("✅ Booking successful");
    setStart("");
    setEnd("");
    setDepartment("");
    setPurpose("");
    loadAll();
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <h1>{company.name}</h1>
        <img src={company.logo_url} alt="logo" />
      </header>

      <div className={styles.main}>
        {/* ===== LEFT FORM ===== */}
        <div className={styles.form}>
          <h2>Book Conference Room</h2>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label>Room</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Select</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.room_name}
              </option>
            ))}
          </select>

          <label>Start Time</label>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            <option value="">Select</option>
            {TIMES.map(t => <option key={t}>{t}</option>)}
          </select>

          <label>End Time</label>
          <select value={end} onChange={(e) => setEnd(e.target.value)}>
            <option value="">Select</option>
            {TIMES.map(t => <option key={t}>{t}</option>)}
          </select>

          <label>Department</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} />

          <label>Purpose</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} />

          <button onClick={createBooking}>Confirm Booking</button>
        </div>

        {/* ===== RIGHT CALENDAR ===== */}
        <div className={styles.calendar}>
          <h3>Bookings</h3>
          {dayBookings.map(b => (
            <div key={b.id} className={styles.block}>
              <b>{b.room_name}</b>
              <p>{b.start_time} → {b.end_time}</p>
              <span>{b.department}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
