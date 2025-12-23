"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= TIME OPTIONS (09:30 – 19:00, 30 MIN) ================= */
const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return {
    label: `${hour}:${String(m).padStart(2, "0")} ${ampm}`,
    value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  };
});

/* ================= HELPERS ================= */
const normalizeDate = (d) =>
  typeof d === "string" ? d.split("T")[0] : "";

const toAmPm = (time24) => {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function ConferenceBookings() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [date, setDate] = useState(today);
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ================= LOAD DATA ================= */
  const loadAll = async () => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) setCompany(JSON.parse(stored));

      const [r, b] = await Promise.all([
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings")
      ]);

      setRooms(Array.isArray(r) ? r : []);
      setBookings(Array.isArray(b) ? b : []);
    } catch {
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ================= DAY BOOKINGS ================= */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];

    return bookings.filter(b =>
      normalizeDate(b.booking_date) === date &&
      Number(b.room_id) === Number(roomId) &&
      b.status === "BOOKED"
    );
  }, [bookings, date, roomId]);

  /* ================= BLOCKED SLOTS ================= */
  const blockedSlots = useMemo(() => {
    const set = new Set();

    dayBookings.forEach(b => {
      TIME_OPTIONS.forEach(t => {
        if (t.value >= b.start_time && t.value < b.end_time) {
          set.add(t.value);
        }
      });
    });

    return set;
  }, [dayBookings]);

  /* ================= CURRENT TIME FILTER ================= */
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const availableStartTimes = useMemo(() => {
    return TIME_OPTIONS.filter(t => {
      if (blockedSlots.has(t.value)) return false;
      if (date !== today) return true;
      const [h, m] = t.value.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    });
  }, [date, today, blockedSlots, nowMinutes]);

  const availableEndTimes = useMemo(() => {
    if (!startTime) return [];
    return TIME_OPTIONS.filter(
      t => t.value > startTime && !blockedSlots.has(t.value)
    );
  }, [startTime, blockedSlots]);

  /* ================= CREATE BOOKING ================= */
  const createBooking = async () => {
    setError("");
    setSuccess("");

    if (!date || !roomId || !startTime || !endTime || !department) {
      return setError("All required fields must be filled");
    }

    if (endTime <= startTime) {
      return setError("End time must be after start time");
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
          start_time: startTime,
          end_time: endTime
        })
      });

      setSuccess("✅ Booking created successfully");
      setStartTime("");
      setEndTime("");
      setDepartment("");
      setPurpose("");

      loadAll();
    } catch (e) {
      setError(e.message || "Unable to create booking");
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.headerLeft} />

        <h1>{company.name}</h1>

        <div className={styles.headerRight}>
          {company.logo_url && (
            <img src={company.logo_url} alt="logo" />
          )}
          <button
            className={styles.backBtn}
            onClick={() => router.back()}
            title="Back"
          >
            ←
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {/* ================= LEFT FORM ================= */}
        <div className={styles.card}>
          <h2>Book Conference Room</h2>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <label>Date</label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
          />

          <label>Room</label>
          <select value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">Select</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.room_name}
              </option>
            ))}
          </select>

          <label>Start Time</label>
          <select
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          >
            <option value="">Select</option>
            {availableStartTimes.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label>End Time</label>
          <select
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          >
            <option value="">Select</option>
            {availableEndTimes.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label>Department</label>
          <input
            value={department}
            onChange={e => setDepartment(e.target.value)}
          />

          <label>Purpose</label>
          <input
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
          />

          <button onClick={createBooking}>
            Confirm Booking
          </button>
        </div>

        {/* ================= RIGHT PANEL ================= */}
        <div className={styles.side}>
          <h2>Bookings</h2>

          {dayBookings.length === 0 && (
            <p style={{ opacity: 0.8 }}>No bookings</p>
          )}

          {dayBookings.map(b => (
            <div key={b.id} className={styles.booking}>
              <b>
                {toAmPm(b.start_time)} – {toAmPm(b.end_time)}
              </b>
              <p>{b.department}</p>
              <span>{b.booked_by}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
