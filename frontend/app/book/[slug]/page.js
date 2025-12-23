"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ===== TIME OPTIONS (09:30 AM – 07:00 PM) ===== */
const buildTimes = () => {
  const arr = [];
  for (let h = 9; h <= 19; h++) {
    arr.push({ label: `${h === 12 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`, value: `${String(h).padStart(2, "0")}:00` });
    arr.push({ label: `${h === 12 ? 12 : h % 12}:30 ${h < 12 ? "AM" : "PM"}`, value: `${String(h).padStart(2, "0")}:30` });
  }
  return arr;
};

const TIMES = buildTimes();

export default function PublicBookingPage() {
  const { slug } = useParams();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  /* ===== LOAD COMPANY ===== */
  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/public/conference/company/${slug}`)
      .then(r => r.json())
      .then(setCompany)
      .catch(() => setError("Invalid booking link"));
  }, [slug]);

  /* ===== LOAD ROOMS ===== */
  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [slug]);

  /* ===== LOAD BOOKINGS ===== */
  const loadBookings = () => {
    if (!roomId || !date) {
      setBookings([]);
      return;
    }
    fetch(`${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}`)
      .then(r => r.json())
      .then(setBookings)
      .catch(() => setBookings([]));
  };

  useEffect(loadBookings, [roomId, date]);

  /* ===== BLOCKED TIMES ===== */
  const blockedTimes = useMemo(() => {
    const set = new Set();
    bookings.forEach(b => {
      TIMES.forEach(t => {
        if (t.value >= b.start_time && t.value < b.end_time) {
          set.add(t.value);
        }
      });
    });
    return set;
  }, [bookings]);

  /* ===== CREATE BOOKING ===== */
  const confirmBooking = async () => {
    if (!roomId || !date || !start || !end || !department) {
      return setError("All fields except purpose are required");
    }

    if (start >= end) {
      return setError("End time must be after start time");
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API}/api/public/conference/company/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          booked_by: department,
          purpose,
          booking_date: date,
          start_time: start,
          end_time: end
        })
      });

      if (!res.ok) throw new Error();

      setSuccess("✅ Booking created successfully");
      setStart("");
      setEnd("");
      setDepartment("");
      setPurpose("");
      loadBookings(); // 🔥 realtime update
    } catch {
      setError("Slot already booked. Please choose another.");
    } finally {
      setLoading(false);
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <h1>{company.name}</h1>
        {company.logo_url && <img src={company.logo_url} alt="logo" />}
      </header>

      <div className={styles.content}>
        {/* LEFT FORM */}
        <div className={styles.card}>
          <h2>Book Conference Room</h2>

          {success && <p className={styles.success}>{success}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />

          <label>Room</label>
          <select value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">Select Room</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.room_name}
              </option>
            ))}
          </select>

          <label>Start Time</label>
          <select value={start} onChange={e => setStart(e.target.value)}>
            <option value="">Select</option>
            {TIMES.map(t => (
              <option key={t.value} value={t.value} disabled={blockedTimes.has(t.value)}>
                {t.label}
              </option>
            ))}
          </select>

          <label>End Time</label>
          <select value={end} onChange={e => setEnd(e.target.value)}>
            <option value="">Select</option>
            {TIMES.map(t => (
              <option key={t.value} value={t.value} disabled={t.value <= start || blockedTimes.has(t.value)}>
                {t.label}
              </option>
            ))}
          </select>

          <label>Department</label>
          <input value={department} onChange={e => setDepartment(e.target.value)} />

          <label>Purpose</label>
          <input value={purpose} onChange={e => setPurpose(e.target.value)} />

          <button onClick={confirmBooking} disabled={loading}>
            {loading ? "Booking..." : "Confirm Booking"}
          </button>
        </div>

        {/* RIGHT BOOKINGS */}
        <div className={styles.side}>
          <h3>Bookings</h3>
          {bookings.length === 0 && <p>No bookings</p>}
          {bookings.map(b => (
            <div key={b.id} className={styles.booking}>
              <b>{b.start_time} – {b.end_time}</b>
              <span>{b.booked_by}</span>
              <small>{b.purpose || "-"}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
