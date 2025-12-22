"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api"; // ✅ FIXED (NO alias)
import styles from "./style.module.css";

export default function ConferenceBookings() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= LOAD ROOMS ================= */
  useEffect(() => {
    apiFetch("/api/conference/rooms")
      .then(setRooms)
      .catch(() => setError("Failed to load rooms"));
  }, []);

  /* ================= LOAD BOOKINGS ================= */
  const loadBookings = async () => {
    if (!roomId || !date) {
      setError("Please select room and date");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const data = await apiFetch(
        `/api/conference/bookings?roomId=${roomId}&date=${date}`
      );
      setBookings(data);

    } catch (err) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  /* ================= CANCEL BOOKING ================= */
  const cancelBooking = async (id) => {
    try {
      await apiFetch(`/api/conference/bookings/${id}/cancel`, {
        method: "PATCH"
      });
      loadBookings();
    } catch {
      setError("Unable to cancel booking");
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Conference Bookings</h1>

      {/* FILTERS */}
      <div className={styles.filterRow}>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Select Room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <button onClick={loadBookings} disabled={loading}>
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {/* ERROR */}
      {error && <p className={styles.error}>{error}</p>}

      {/* BOOKINGS LIST */}
      <div className={styles.list}>
        {bookings.length === 0 && !loading && (
          <p className={styles.empty}>No bookings found</p>
        )}

        {bookings.map((b) => (
          <div key={b.id} className={styles.bookingCard}>
            <div>
              <b>
                {b.start_time} – {b.end_time}
              </b>
              <p>{b.purpose || "—"}</p>
            </div>

            <button onClick={() => cancelBooking(b.id)}>
              Cancel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
