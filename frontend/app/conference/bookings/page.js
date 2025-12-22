"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api";
import styles from "./style.module.css";

export default function ConferenceBookings() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    apiFetch("/api/conference/rooms").then(setRooms);
  }, []);

  const loadBookings = async () => {
    if (!roomId || !date) return;
    const data = await apiFetch(
      `/api/conference/bookings?roomId=${roomId}&date=${date}`
    );
    setBookings(data);
  };

  const cancelBooking = async (id) => {
    await apiFetch(`/api/conference/bookings/${id}/cancel`, {
      method: "PATCH"
    });
    loadBookings();
  };

  return (
    <div className={styles.container}>
      <h1>Conference Bookings</h1>

      <div className={styles.filterRow}>
        <select onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Select Room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <button onClick={loadBookings}>Load</button>
      </div>

      <div className={styles.list}>
        {bookings.map((b) => (
          <div key={b.id} className={styles.bookingCard}>
            <div>
              <b>{b.start_time} – {b.end_time}</b>
              <p>{b.purpose}</p>
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
