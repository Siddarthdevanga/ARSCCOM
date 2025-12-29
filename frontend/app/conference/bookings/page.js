"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= TIME OPTIONS ================= */
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

const normalizeDate = d => (typeof d === "string" ? d.split("T")[0] : "");
const toAmPm = t => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
};

export default function ConferenceBookings() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  /* FORM */
  const [date, setDate] = useState(today);
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  /* EDIT MODE */
  const [editing, setEditing] = useState(null);

  /* STATUS */
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
    } catch (e) {
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ================= FILTER DAY ================= */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      b =>
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
          if (!editing || editing?.id !== b.id) set.add(t.value); // allow current slot when editing
        }
      });
    });
    return set;
  }, [dayBookings, editing]);

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const availableStartTimes = useMemo(() => {
    return TIME_OPTIONS.filter(t => {
      if (blockedSlots.has(t.value)) return false;
      if (date !== today) return true;
      const [h, m] = t.value.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    });
  }, [date, blockedSlots, nowMinutes]);

  const availableEndTimes = useMemo(() => {
    if (!startTime) return [];
    return TIME_OPTIONS.filter(
      t => t.value > startTime && !blockedSlots.has(t.value)
    );
  }, [startTime, blockedSlots]);

  /* ================= CREATE ================= */
  const createBooking = async () => {
    setError("");
    setSuccess("");

    if (!date || !roomId || !startTime || !endTime || !department) {
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
      setError(e.message || "Unable to create booking");
    }
  };

  /* ================= ENTER EDIT MODE ================= */
  const startEdit = b => {
    setEditing(b);
    setStartTime(b.start_time);
    setEndTime(b.end_time);
    setDepartment(b.department || "");
    setPurpose(b.purpose || "");
    setSuccess("");
    setError("");
  };

  /* ================= SUBMIT EDIT ================= */
  const updateBooking = async () => {
    if (!editing) return;

    setError("");
    setSuccess("");

    if (!startTime || !endTime || !department)
      return setError("Fill required fields");

    try {
      await apiFetch(`/api/conference/bookings/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          department,
          purpose
        })
      });

      setSuccess("Booking updated successfully");
      setEditing(null);
      loadAll();
    } catch (e) {
      setError(e.message || "Failed to update booking");
    }
  };

  /* ================= CANCEL ================= */
  const cancelBooking = async id => {
    if (!confirm("Cancel this booking?")) return;

    try {
      await apiFetch(`/api/conference/bookings/${id}`, {
        method: "DELETE"
      });

      setSuccess("Booking cancelled");
      loadAll();
    } catch {
      setError("Unable to cancel booking");
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ←
        </button>

        <h1 className={styles.companyName}>{company.name}</h1>

        <div className={styles.headerRight}>
          {company.logo_url && <img src={company.logo_url} alt="logo" />}
        </div>
      </header>

      <div className={styles.content}>
        {/* FORM */}
        <div className={styles.card}>
          <h2>{editing ? "Edit Booking" : "Book Conference Room"}</h2>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <label>Date</label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
            disabled={editing}
          />

          <label>Room</label>
          <select
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            disabled={editing}
          >
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
          <select value={endTime} onChange={e => setEndTime(e.target.value)}>
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
          <input value={purpose} onChange={e => setPurpose(e.target.value)} />

          {!editing && (
            <button onClick={createBooking}>Confirm Booking</button>
          )}

          {editing && (
            <div className={styles.editActions}>
              <button className={styles.saveBtn} onClick={updateBooking}>
                Save Changes
              </button>
              <button
                className={styles.cancelEditBtn}
                onClick={() => setEditing(null)}
              >
                Cancel Edit
              </button>
            </div>
          )}
        </div>

        {/* BOOKINGS PANEL */}
        <div className={styles.side}>
          <h2>Bookings</h2>

          {dayBookings.length === 0 && <p>No bookings</p>}

          {dayBookings.map(b => (
            <div key={b.id} className={styles.booking}>
              <b>
                {toAmPm(b.start_time)} – {toAmPm(b.end_time)}
              </b>
              <p>{b.department}</p>

              <div className={styles.bookingActions}>
                <button onClick={() => startEdit(b)}>Edit</button>
                <button
                  className={styles.redBtn}
                  onClick={() => cancelBooking(b.id)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
