"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;

  return {
    label: `${hour}:${String(m).padStart(2, "0")} ${ampm}`,
    value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  };
});

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

  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const loadAll = async () => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) setCompany(JSON.parse(stored));

      const [r, b] = await Promise.all([
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings"),
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

  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      (b) =>
        normalizeDate(b.booking_date) === date &&
        Number(b.room_id) === Number(roomId) &&
        b.status === "BOOKED"
    );
  }, [bookings, date, roomId]);

  const blockedSlots = useMemo(() => {
    const set = new Set();
    dayBookings.forEach((b) => {
      TIME_OPTIONS.forEach((t) => {
        if (t.value >= b.start_time && t.value < b.end_time) {
          set.add(t.value);
        }
      });
    });
    return set;
  }, [dayBookings]);

  const nowMinutes =
    new Date().getHours() * 60 + new Date().getMinutes();

  const availableStartTimes = useMemo(() => {
    return TIME_OPTIONS.filter((t) => {
      if (blockedSlots.has(t.value)) return false;
      if (date !== today) return true;
      const [h, m] = t.value.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    });
  }, [date, today, blockedSlots, nowMinutes]);

  const availableEndTimes = useMemo(() => {
    if (!startTime) return [];
    return TIME_OPTIONS.filter(
      (t) => t.value > startTime && !blockedSlots.has(t.value)
    );
  }, [startTime, blockedSlots]);

  /* ================= CREATE BOOKING ================= */
  const createBooking = async () => {
    setError("");
    setSuccess("");

    if (!date || !roomId || !startTime || !endTime || !department)
      return setError("All fields are required");

    if (endTime <= startTime)
      return setError("End time must be after start");

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
          end_time: endTime,
        }),
      });

      setSuccess("Booking created successfully");
      setStartTime("");
      setEndTime("");
      setDepartment("");
      setPurpose("");

      loadAll();
    } catch (e) {
      setError(e.message || "Failed to create booking");
    }
  };

  /* ================= BLOCK SLOTS EXCEPT CURRENT ================= */
  const getBlockedSlotsExcluding = (bookingId) => {
    const set = new Set();
    dayBookings.forEach((b) => {
      if (b.id === bookingId) return;
      TIME_OPTIONS.forEach((t) => {
        if (t.value >= b.start_time && t.value < b.end_time) {
          set.add(t.value);
        }
      });
    });
    return set;
  };

  /* ================= SAVE EDIT ================= */
  const saveEdit = async (id) => {
    setError("");
    setSuccess("");

    if (!editStart || !editEnd)
      return setError("Select both start & end");

    if (editEnd <= editStart)
      return setError("End must be after start");

    try {
      await apiFetch(`/api/conference/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          start_time: editStart,
          end_time: editEnd,
        }),
      });

      setSuccess("Booking updated successfully");
      setEditingId(null);
      loadAll();
    } catch {
      setError("Unable to update — slot conflict");
    }
  };

  /* ================= CANCEL BOOKING ================= */
  const cancelBooking = async (id) => {
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/api/conference/bookings/${id}/cancel`, {
        method: "PATCH",
      });

      setSuccess("Booking cancelled successfully");
      loadAll();
    } catch {
      setError("Failed to cancel booking");
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
        {/* LEFT FORM */}
        <div className={styles.card}>
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
          <select
            className={styles.dropdown}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            <option value="">Select</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name}
              </option>
            ))}
          </select>

          <label>Start Time</label>
          <select
            className={styles.dropdown}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          >
            <option value="">Select</option>
            {availableStartTimes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label>End Time</label>
          <select
            className={styles.dropdown}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          >
            <option value="">Select</option>
            {availableEndTimes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

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

        {/* RIGHT BOOKINGS LIST */}
        <div className={styles.side}>
          <h2>Bookings</h2>

          {dayBookings.length === 0 && <p>No bookings</p>}

          {dayBookings.map((b) => {
            const blocked = getBlockedSlotsExcluding(b.id);
            const editableStartOptions = TIME_OPTIONS.filter(
              (t) => !blocked.has(t.value)
            );
            const editableEndOptions = TIME_OPTIONS.filter(
              (t) => t.value > editStart && !blocked.has(t.value)
            );

            return (
              <div key={b.id} className={styles.booking}>
                {editingId === b.id ? (
                  <>
                    <b>Edit Booking</b>

                    <select
                      className={styles.dropdown}
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                    >
                      {editableStartOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>

                    <select
                      className={styles.dropdown}
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                    >
                      {editableEndOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>

                    <div className={styles.inlineButtons}>
                      <button
                        className={styles.saveBtn}
                        onClick={() => saveEdit(b.id)}
                      >
                        Save
                      </button>

                      <button
                        className={styles.cancelBtn}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <b>
                      {toAmPm(b.start_time)} – {toAmPm(b.end_time)}
                    </b>
                    <p>{b.department}</p>
                    <span>{b.booked_by}</span>

                    <div className={styles.inlineButtons}>
                      <button
                        className={styles.primaryBtn}
                        onClick={() => {
                          setEditingId(b.id);
                          setEditStart(b.start_time);
                          setEditEnd(b.end_time);
                        }}
                      >
                        Edit
                      </button>

                      <button
                        className={styles.dangerBtn}
                        onClick={() => cancelBooking(b.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
