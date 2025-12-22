"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

export default function ConferenceBookings() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    apiFetch("/api/conference/bookings")
      .then(setBookings)
      .catch(() => router.replace("/auth/login"));
  }, [router]);

  return (
    <div className={styles.container}>
      <h2>Conference Bookings</h2>

      {bookings.map((b) => (
        <div key={b.id} className={styles.card}>
          <b>{b.booking_date}</b>
          <p>{b.start_time} – {b.end_time}</p>
          <p>{b.purpose}</p>
        </div>
      ))}
    </div>
  );
}
