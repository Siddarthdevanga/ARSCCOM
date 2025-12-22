"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api"; // ✅ relative import
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
    let mounted = true;

    apiFetch("/api/conference/rooms")
      .then((data) => {
        if (mounted) setRooms(data || []);
      })
      .catch(() => {
        if (mounted) setError("Failed to load rooms");
      });

    return () => {
      mounted = false;
    };
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

      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  /* ================= CANCEL BOOKING ================= */
  const cancelBooking = async (bookingId) => {
    if (!bookingId) return;

    try {
      setLoading(true);
      await apiFetch(
        `/api/conference/bookings/${bookingId}/cancel`,
        { method: "PATCH" }
      );
      await loadBookings();
    } catch {
      setError("Unable to cancel booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* ================= TITLE ================= */}
      <h1 className={styles.title}>Conference Bookings</h1>

      {/* ================= FILTERS ================= */}
      <div className={styles.filterRow}>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className={styles.select}
        >
          <option value="">Select Room</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          className={styles.input}
          onChange={(e) => setDate(e.target.value)}
        />

        <button
          className={styles.loadBtn}
          onClick={loadBookings}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {/* ================= ERROR ================= */}
      {error && <p className={styles.error}>{error}</p>}

      {/* ================= BOOKINGS ================= */}
      <div className={styles.list}>
        {!loading && bookings.length === 0 && (
          <p className={styles.empty}>No bookings found</p>
        )}

        {bookings.map((b) => (
          <div key={b.id} className={styles.bookingCard}>
            <div className={styles.bookingInfo}>
              <b>
                {b.start_time} – {b.end_time}
              </b>
              <p>{b.purpose || "—"}</p>
            </div>

            <button
              className={styles.cancelBtn}
              onClick={() => cancelBooking(b.id)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
