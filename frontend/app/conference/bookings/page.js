"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= TIME OPTIONS (AM / PM) ================= */
const TIMES = [];
for (let h = 9; h <= 19; h++) {
  const hour = h % 12 === 0 ? 12 : h % 12;
  const period = h < 12 ? "AM" : "PM";
  TIMES.push(`${hour}:00 ${period}`);
  TIMES.push(`${hour}:30 ${period}`);
}

/* ================= TIME HELPERS ================= */
const timeToMinutes = (t) => {
  const [time, ap] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const to24 = (t) => {
  const mins = timeToMinutes(t);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
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

  /* ================= LOAD DATA (Option A) ================= */
  const loadAll = async () => {
    try {
      const storedCompany = localStorage.getItem("company");
      if (!storedCompany) {
        router.replace("/auth/login");
        return;
      }

      setCompany(JSON.parse(storedCompany));

      const [r, b] = await Promise.all([
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings")
      ]);

      setRooms(r);
      setBookings(b);
    } catch {
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ================= BOOKINGS FOR SELECTED DAY ================= */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      (b) => b.room_id == roomId && b.booking_date === date
    );
  }, [bookings, date, roomId]);

  /* ================= VALID START TIMES ================= */
  const validStartTimes = useMemo(() => {
    if (!date || !roomId) return [];

    const isToday = date === new Date().toISOString().split("T")[0];
    const now = nowMinutes();

    return TIMES.filter((t) => {
      const mins = timeToMinutes(t);

      if (isToday && mins <= now) return false;

      return !dayBookings.some(
        (b) =>
          mins >= timeToMinutes(b.start_time) &&
          mins < timeToMinutes(b.end_time)
      );
    });
  }, [date, roomId, dayBookings]);

  /* ================= VALID END TIMES ================= */
  const validEndTimes = useMemo(() => {
    if (!start) return [];

    const startMin = timeToMinutes(start);

    return TIMES.filter((t) => {
      const endMin = timeToMinutes(t);
      if (endMin <= startMin) return false;

      return !dayBookings.some(
        (b) =>
          startMin < timeToMinutes(b.end_time) &&
          endMin > timeToMinutes(b.start_time)
      );
    });
  }, [start, dayBookings]);

  /* ================= CREATE BOOKING ================= */
  const createBooking = async () => {
    setError("");
    setSuccess("");

    if (!date || !roomId || !start || !end || !department) {
      return setError("All fields except purpose are required");
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

      setSuccess("✅ Booking created successfully");
      setStart("");
      setEnd("");
      setDepartment("");
      setPurpose("");
      loadAll(); // 🔥 instant calendar refresh
    } catch (err) {
      setError(err.message);
    }
  };

  if (!company) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="Go back"
          >
            ←
          </button>
          <h1 className={styles.companyName}>{company.name}</h1>
        </div>

        <img
          src={company.logo_url || "/logo.png"}
          className={styles.logo}
          alt="Company Logo"
        />
      </header>

      <div className={styles.main}>
        {/* ================= LEFT : FORM ================= */}
        <div className={styles.formCard}>
          <h2 className={styles.title}>Book Conference Room</h2>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <label className={styles.label}>Date</label>
          <input
            className={styles.input}
            type="date"
            min={new Date().toISOString().split("T")[0]}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setStart("");
              setEnd("");
            }}
          />

          <label className={styles.label}>Room</label>
          <select
            className={styles.select}
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setStart("");
              setEnd("");
            }}
          >
            <option value="">Select Room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name} (#{r.room_number})
              </option>
            ))}
          </select>

          <label className={styles.label}>Start Time</label>
          <select
            className={styles.select}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setEnd("");
            }}
          >
            <option value="">Select</option>
            {validStartTimes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label className={styles.label}>End Time</label>
          <select
            className={styles.select}
            value={end}
            disabled={!start}
            onChange={(e) => setEnd(e.target.value)}
          >
            <option value="">Select</option>
            {validEndTimes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label className={styles.label}>Department</label>
          <input
            className={styles.input}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="HR / Engineering / Finance"
          />

          <label className={styles.label}>Purpose</label>
          <input
            className={styles.input}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Optional"
          />

          <button className={styles.primaryBtn} onClick={createBooking}>
            Confirm Booking
          </button>
        </div>

        {/* ================= RIGHT : CALENDAR ================= */}
        <div className={styles.calendar}>
          <h3 className={styles.calendarTitle}>Bookings</h3>

          {dayBookings.length === 0 && (
            <p className={styles.empty}>No bookings for selected date</p>
          )}

          {dayBookings.map((b) => (
            <div key={b.id} className={styles.bookingBlock}>
              <b>{b.room_name}</b>
              <span>
                {b.start_time} → {b.end_time}
              </span>
              <small>{b.department}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
