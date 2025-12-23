"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* 09:30 → 19:00 (30-min slots) */
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const mins = 9 * 60 + 30 + i * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function PublicConferenceBooking() {
  const { slug } = useParams();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= LOAD COMPANY ================= */
  useEffect(() => {
    if (!slug) return;

    fetch(`${API}/api/public/conference/company/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setCompany)
      .catch(() => setError("Invalid booking link"));
  }, [slug]);

  /* ================= LOAD ROOMS ================= */
  useEffect(() => {
    if (!company) return;

    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setRooms(Array.isArray(data) ? data : []));
  }, [company, slug]);

  /* ================= LOAD BOOKINGS ================= */
  useEffect(() => {
    if (!roomId || !date) {
      setBookings([]);
      return;
    }

    fetch(
      `${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}`
    )
      .then(r => r.ok ? r.json() : [])
      .then(data => setBookings(Array.isArray(data) ? data : []));
  }, [roomId, date, slug]);

  /* ================= BOOKED SLOTS ================= */
  const bookedSlots = useMemo(() => {
    const set = new Set();
    bookings.forEach(b => {
      TIME_SLOTS.forEach(t => {
        if (t >= b.start_time && t < b.end_time) set.add(t);
      });
    });
    return set;
  }, [bookings]);

  /* ================= OTP ================= */
  const sendOtp = async () => {
    if (!email.includes("@")) return setError("Enter valid email");

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${API}/api/public/conference/company/${slug}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );
      if (!res.ok) throw new Error();
      setOtpSent(true);
    } catch {
      setError("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      const res = await fetch(
        `${API}/api/public/conference/company/${slug}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp })
        }
      );
      if (!res.ok) throw new Error();
      setOtpVerified(true);
    } catch {
      setError("Invalid OTP");
    }
  };

  /* ================= BOOK ================= */
  const confirmBooking = async () => {
    if (!roomId || !date || !slot) {
      return setError("Select room, date and time");
    }

    const idx = TIME_SLOTS.indexOf(slot);
    const endTime = TIME_SLOTS[idx + 1];
    if (!endTime) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${API}/api/public/conference/company/${slug}/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: roomId,
            booked_by: email,
            purpose: "Conference Meeting",
            booking_date: date,
            start_time: slot,
            end_time: endTime
          })
        }
      );

      if (!res.ok) throw new Error();
      alert("✅ Booking confirmed");
      setSlot("");
    } catch {
      setError("Slot already booked");
    } finally {
      setLoading(false);
    }
  };

  /* ================= SAFE GUARDS ================= */
  if (error && !company) {
    return <div className={styles.centerError}>{error}</div>;
  }

  if (!company) {
    return <div className={styles.centerError}>Loading…</div>;
  }

  /* ================= UI ================= */
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{company.name}</h1>
        {company.logo_url && <img src={company.logo_url} alt="logo" />}
      </header>

      {!otpVerified ? (
        <div className={styles.card}>
          <h3>Email Verification</h3>
          {error && <p className={styles.error}>{error}</p>}

          <input
            className={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {!otpSent ? (
            <button className={styles.btn} onClick={sendOtp}>
              Send OTP
            </button>
          ) : (
            <>
              <input
                className={styles.input}
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button className={styles.btn} onClick={verifyOtp}>
                Verify OTP
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.card}>
            <h3>Book Conference Room</h3>

            <select className={styles.input} onChange={e => setRoomId(e.target.value)}>
              <option value="">Select Room</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.room_name}</option>
              ))}
            </select>

            <input
              className={styles.input}
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={date}
              onChange={e => setDate(e.target.value)}
            />

            <div className={styles.slots}>
              {TIME_SLOTS.map(t => (
                <button
                  key={t}
                  className={`${styles.slot} ${slot === t ? styles.active : ""}`}
                  disabled={bookedSlots.has(t)}
                  onClick={() => setSlot(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <button className={styles.confirm} onClick={confirmBooking}>
              Confirm Booking
            </button>
          </div>

          <div className={styles.card}>
            <h3>Bookings</h3>
            {bookings.length === 0 && <p>No bookings</p>}
            {bookings.map(b => (
              <div key={b.id} className={styles.booking}>
                {b.start_time} → {b.end_time}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
