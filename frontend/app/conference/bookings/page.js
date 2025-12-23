"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ========= TIME GRID (9:30 AM → 7:00 PM) ========= */
const START_MIN = 9 * 60 + 30;
const END_MIN = 19 * 60;

const timeLabel = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${mm === 0 ? "00" : mm} ${ap}`;
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

  /* ========= LOAD DATA ========= */
  const loadAll = async () => {
    try {
      const [c, r, b] = await Promise.all([
        apiFetch("/api/company/me"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings")
      ]);
      setCompany(c);
      setRooms(r);
      setBookings(b);
    } catch {
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ========= DAY BOOKINGS ========= */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      (b) => b.booking_date === date && b.room_id == roomId
    );
  }, [bookings, date, roomId]);

  /* ========= CREATE BOOKING ========= */
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
          start_time: start,
          end_time: end
        })
      });

      setSuccess("✅ Booking successful");
      setStart("");
      setEnd("");
      setDepartment("");
      setPurpose("");
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!company) return null;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className={styles.page}>
      {/* ========= HEADER ========= */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ←
        </button>

        <h1>{company.name}</h1>

        <img src={company.logo_url} alt="logo" />
      </header>

      <div className={styles.container}>
        {/* ========= LEFT : BOOKING FORM ========= */}
        <div className={styles.formPane}>
          <h2>Book Conference Room</h2>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <label>Date</label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
          />

          <label>Room</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Select</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name}
              </option>
            ))}
          </select>

          <label>Start Time (24h)</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />

          <label>End Time (24h)</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />

          <label>Department</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />

          <label>Purpose</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />

          <button onClick={createBooking}>Confirm Booking</button>
        </div>

        {/* ========= RIGHT : GOOGLE STYLE TIMELINE ========= */}
        <div className={styles.timelinePane}>
          <h3>Daily Schedule</h3>

          <div className={styles.timeline}>
            {Array.from({ length: (END_MIN - START_MIN) / 30 }).map((_, i) => {
              const min = START_MIN + i * 30;
              const label = timeLabel(min);

              return (
                <div key={min} className={styles.timeRow}>
                  <span className={styles.timeLabel}>{label}</span>

                  <div className={styles.slot}>
                    {dayBookings.map((b) => {
                      const s =
                        Number(b.start_time.split(":")[0]) * 60 +
                        Number(b.start_time.split(":")[1]);
                      const e =
                        Number(b.end_time.split(":")[0]) * 60 +
                        Number(b.end_time.split(":")[1]);

                      if (min >= s && min < e) {
                        let cls = styles.future;
                        if (date === today) {
                          if (nowMin >= e) cls = styles.past;
                          else if (nowMin >= s && nowMin < e)
                            cls = styles.current;
                        }

                        return (
                          <div key={b.id} className={`${styles.booking} ${cls}`}>
                            {b.department}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
