"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= TIME OPTIONS (09:30 – 19:00, 30 mins) ================= */
const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const toAmPm = t => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function ConferenceBookings() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [date, setDate] = useState(today);
  const [roomId, setRoomId] = useState("");

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  /* Edit states */
  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

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

  useEffect(() => loadAll(), []);

  /* ================= FILTER CURRENT DAY + ROOM BOOKINGS ================= */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      b =>
        b.booking_date.split("T")[0] === date &&
        Number(b.room_id) === Number(roomId) &&
        b.status === "BOOKED"
    );
  }, [bookings, date, roomId]);

  /* ================= SLOT VALIDATION ================= */
  const isSlotFree = (start, end, ignore = null) => {
    return !dayBookings.some(b => {
      if (b.id === ignore) return false;
      return b.start_time < end && b.end_time > start;
    });
  };

  /* ================= AVAILABLE START TIMES ================= */
  const availableStartTimes = useMemo(() => {
    return TIME_OPTIONS.filter(t => {
      if (date === today) {
        const [h, m] = t.split(":").map(Number);
        if (h * 60 + m <= nowMinutes) return false;
      }
      return true;
    });
  }, [date, today, nowMinutes]);

  /* ================= CREATE BOOKING ================= */
  const createBooking = async () => {
    setError("");
    setSuccess("");

    if (!date || !roomId || !startTime || !endTime || !department)
      return setError("All required fields must be filled");

    if (endTime <= startTime)
      return setError("End time must be after start");

    if (!isSlotFree(startTime, endTime))
      return setError("Selected slot unavailable");

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

      setSuccess("Booking created successfully");
      setStartTime("");
      setEndTime("");
      setDepartment("");
      setPurpose("");
      loadAll();
    } catch (e) {
      setError("Unable to create booking");
    }
  };

  /* ================= SAVE EDIT ================= */
  const saveEdit = async (id) => {
    if (!editStart || !editEnd)
      return setError("Select both start and end time");

    if (!isSlotFree(editStart, editEnd, id))
      return setError("Slot already booked");

    try {
      await apiFetch(`/api/conference/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          start_time: editStart,
          end_time: editEnd
        })
      });

      setSuccess("Booking updated successfully");
      setEditingId(null);
      loadAll();
    } catch {
      setError("Failed to update booking");
    }
  };

  /* ================= CANCEL BOOKING ================= */
  const cancelBooking = async (id) => {
    if (!confirm("Cancel this booking?")) return;

    try {
      await apiFetch(`/api/conference/bookings/${id}/cancel`, {
        method: "PATCH"
      });

      loadAll();
    } catch {
      alert("Failed to cancel booking");
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ←
        </button>

        <h1>{company.name}</h1>

        {company.logo_url && (
          <img src={company.logo_url} alt="logo" />
        )}
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
              <option key={t} value={t}>
                {toAmPm(t)}
              </option>
            ))}
          </select>

          <label>End Time</label>
          <select
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          >
            <option value="">Select</option>
            {TIME_OPTIONS.filter(t => t > startTime).map(t => (
              <option key={t} value={t}>
                {toAmPm(t)}
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

        {/* ================= BOOKINGS PANEL ================= */}
        <div className={styles.side}>
          <h2>Bookings</h2>

          {dayBookings.length === 0 && <p>No bookings</p>}

          {dayBookings.map(b => (
            <div key={b.id} className={styles.booking}>
              {editingId === b.id ? (
                <>
                  <b>{b.department}</b>

                  <select
                    value={editStart}
                    onChange={e => setEditStart(e.target.value)}
                  >
                    {TIME_OPTIONS.filter(t =>
                      isSlotFree(t, editEnd || t, b.id)
                    ).map(t => (
                      <option key={t} value={t}>
                        {toAmPm(t)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={editEnd}
                    onChange={e => setEditEnd(e.target.value)}
                  >
                    {TIME_OPTIONS.filter(t =>
                      t > editStart && isSlotFree(editStart, t, b.id)
                    ).map(t => (
                      <option key={t} value={t}>
                        {toAmPm(t)}
                      </option>
                    ))}
                  </select>

                  <div className={styles.bookingActions}>
                    <button onClick={() => saveEdit(b.id)}>Save</button>
                    <button
                      className="redBtn"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <b>{toAmPm(b.start_time)} – {toAmPm(b.end_time)}</b>
                  <p>{b.department}</p>
                  <span>{b.booked_by}</span>

                  <div className={styles.bookingActions}>
                    <button
                      onClick={() => {
                        setEditingId(b.id);
                        setEditStart(b.start_time);
                        setEditEnd(b.end_time);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="redBtn"
                      onClick={() => cancelBooking(b.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
