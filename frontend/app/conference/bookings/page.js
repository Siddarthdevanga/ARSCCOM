"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ===== TIME OPTIONS (AM/PM) ===== */
const TIMES = [];
for (let h = 9; h <= 19; h++) {
  const hour = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? "AM" : "PM";
  TIMES.push(`${hour}:00 ${ap}`);
  TIMES.push(`${hour}:30 ${ap}`);
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

  /* ===== BOOKINGS FOR DAY ===== */
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

    if (to24(start) >= to24(end)) {
      return setError("End time must be after start time");
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
        <h1 className={styles.companyName}>{company.name}</h1>
        <img src={company.logo_url} alt="logo" className={styles.logo} />
      </header>

      <div className={styles.main}>
        {/* ===== LEFT : BOOKING FORM ===== */}
        <div className={styles.form}>
          <h2 className={styles.formTitle}>Book Conference Room</h2>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <label className={styles.label}>Date</label>
          <input
            type="date"
            className={styles.input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <label className={styles.label}>Room</label>
          <select
            className={styles.select}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            <option value="">Select room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name}
              </option>
            ))}
          </select>

          <label className={styles.label}>Start Time</label>
          <select
            className={styles.select}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          >
            <option value="">Select</option>
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label className={styles.label}>End Time</label>
          <select
            className={styles.select}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          >
            <option value="">Select</option>
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label className={styles.label}>Department</label>
          <input
            className={styles.input}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />

          <label className={styles.label}>Purpose</label>
          <input
            className={styles.input}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />

          <button className={styles.button} onClick={createBooking}>
            Confirm Booking
          </button>
        </div>

        {/* ===== RIGHT : CALENDAR ===== */}
        <div className={styles.calendar}>
          <h3 className={styles.calendarTitle}>Bookings</h3>

          {dayBookings.length === 0 && (
            <p className={styles.empty}>No bookings for selected date</p>
          )}

          {dayBookings.map((b) => (
            <div key={b.id} className={styles.block}>
              <div className={styles.blockTime}>
                {b.start_time} → {b.end_time}
              </div>
              <div className={styles.blockMeta}>
                {b.department} · {b.purpose || "Meeting"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
