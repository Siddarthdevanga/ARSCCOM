"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= TIME SLOTS ================= */
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function ConferenceBookings() {
  const router = useRouter();

  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [purpose, setPurpose] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= LOAD DATA ================= */
  const loadAll = async () => {
    try {
      const [b, r] = await Promise.all([
        apiFetch("/api/conference/bookings"),
        apiFetch("/api/conference/rooms")
      ]);
      setBookings(b);
      setRooms(r);
    } catch {
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ================= CREATE BOOKING ================= */
  const createBooking = async () => {
    if (!roomId || !date || !slot) {
      return setError("Select room, date and time");
    }

    const idx = TIME_SLOTS.indexOf(slot);
    const endTime = TIME_SLOTS[idx + 1];
    if (!endTime) return setError("Invalid slot");

    setLoading(true);
    setError("");

    try {
      await apiFetch("/api/conference/bookings", {
        method: "POST",
        body: JSON.stringify({
          room_id: roomId,
          booked_by: "ADMIN",
          purpose: purpose || "Admin Booking",
          booking_date: date,
          start_time: slot,
          end_time: endTime
        })
      });

      setRoomId("");
      setDate("");
      setSlot("");
      setPurpose("");
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Conference Bookings (Admin)</h2>

      {/* ================= ADMIN BOOK FORM ================= */}
      <div className={styles.formCard}>
        <h3>Create Booking</h3>

        {error && <p className={styles.error}>{error}</p>}

        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Select Room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.room_name} (#{r.room_number})
            </option>
          ))}
        </select>

        <input
          type="date"
          min={new Date().toISOString().split("T")[0]}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <select value={slot} onChange={(e) => setSlot(e.target.value)}>
          <option value="">Select Time</option>
          {TIME_SLOTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          placeholder="Purpose (optional)"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />

        <button onClick={createBooking} disabled={loading}>
          {loading ? "Booking..." : "Book Room"}
        </button>
      </div>

      {/* ================= BOOKINGS LIST ================= */}
      <div className={styles.list}>
        {bookings.map((b) => (
          <div key={b.id} className={styles.card}>
            <div>
              <b>{b.booking_date}</b>
              <p>
                {b.start_time} – {b.end_time}
              </p>
              <p>
                {b.room_name} (#{b.room_number})
              </p>
              <p>{b.purpose || "-"}</p>
              <p className={styles.status}>{b.status}</p>
            </div>

            {b.status === "BOOKED" && (
              <button
                className={styles.cancelBtn}
                onClick={() => cancelBooking(b.id)}
              >
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

