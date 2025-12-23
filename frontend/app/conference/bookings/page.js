"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= TIME RANGE ================= */
const START_MIN = 9 * 60 + 30;
const END_MIN = 19 * 60;

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export default function ConferenceBookings() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [date, setDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setCompany(JSON.parse(localStorage.getItem("company")));
        const [b, r] = await Promise.all([
          apiFetch("/api/conference/bookings"),
          apiFetch("/api/conference/rooms")
        ]);
        setBookings(b);
        setRooms(r);
      } catch {
        router.replace("/auth/login");
      }
    })();
  }, []);

  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      (b) => b.booking_date === date && b.room_id == roomId
    );
  }, [bookings, date, roomId]);

  const createBooking = async () => {
    if (!date || !roomId || !startTime || !endTime || !department) {
      return setError("All required fields must be filled");
    }

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

    setStartTime("");
    setEndTime("");
    setDepartment("");
    setPurpose("");
  };

  return (
    <div className={styles.page}>
      {/* ================= COMPANY HEADER ================= */}
      <div className={styles.companyHeader}>
        <h2 className={styles.companyName}>{company?.name}</h2>
        {company?.logo_url && (
          <img src={company.logo_url} className={styles.companyLogo} />
        )}
      </div>

      <div className={styles.layout}>
        {/* ================= LEFT ================= */}
        <div className={styles.formPane}>
          <h3 className={styles.formTitle}>Book Conference Room</h3>

          {error && <p className={styles.error}>{error}</p>}

          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label>Room</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Select Room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name}
              </option>
            ))}
          </select>

          <label>Start Time</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />

          <label>End Time</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />

          <label>Department</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} />

          <label>Purpose</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} />

          <button onClick={createBooking}>Confirm Booking</button>
        </div>

        {/* ================= RIGHT ================= */}
        <div className={styles.calendarPane}>
          <h4>Day Timeline</h4>

          <div className={styles.timeline}>
            {dayBookings.map((b) => {
              const top =
                ((toMin(b.start_time) - START_MIN) / (END_MIN - START_MIN)) * 100;
              const height =
                ((toMin(b.end_time) - toMin(b.start_time)) /
                  (END_MIN - START_MIN)) *
                100;

              return (
                <div
                  key={b.id}
                  className={styles.bookingBlock}
                  style={{ top: `${top}%`, height: `${height}%` }}
                >
                  <b>{b.start_time} – {b.end_time}</b>
                  <span>{b.department}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
