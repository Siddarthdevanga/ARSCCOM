"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ===== TIME SLOTS ===== */
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const mins = 9 * 60 + 30 + i * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function PublicBookingPage() {
  const { slug } = useParams();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ===== LOAD COMPANY ===== */
  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/public/conference/company/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setCompany)
      .catch(() => setError("Invalid booking link"));
  }, [slug]);

  /* ===== LOAD ROOMS ===== */
  useEffect(() => {
    if (!company) return;
    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then(r => r.ok ? r.json() : [])
      .then(setRooms);
  }, [company, slug]);

  /* ===== LOAD BOOKINGS ===== */
  useEffect(() => {
    if (!roomId || !date) {
      setBookings([]);
      return;
    }

    fetch(`${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}`)
      .then(r => r.ok ? r.json() : [])
      .then(setBookings);
  }, [roomId, date, slug]);

  /* ===== BOOKED SLOTS ===== */
  const bookedSlots = useMemo(() => {
    const set = new Set();
    bookings.forEach(b => {
      TIME_SLOTS.forEach(t => {
        if (t >= b.start_time && t < b.end_time) set.add(t);
      });
    });
    return set;
  }, [bookings]);

  /* ===== OTP ===== */
  const sendOtp = async () => {
    if (!email.includes("@")) return setError("Enter valid email");
    setLoading(true); setError("");
    try {
      await fetch(`${API}/api/public/conference/company/${slug}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setOtpSent(true);
    } catch {
      setError("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      await fetch(`${API}/api/public/conference/company/${slug}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });
      setOtpVerified(true);
    } catch {
      setError("Invalid OTP");
    }
  };

  /* ===== BOOK ===== */
  const confirmBooking = async () => {
    const idx = TIME_SLOTS.indexOf(start);
    const end = TIME_SLOTS[idx + 1];
    if (!roomId || !date || !start || !end) {
      return setError("Select all fields");
    }

    setLoading(true); setError("");
    try {
      await fetch(`${API}/api/public/conference/company/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          booked_by: email,
          purpose: "Public Booking",
          booking_date: date,
          start_time: start,
          end_time: end
        })
      });

      alert("✅ Booking successful");
      setStart("");
      setBookings([]);
    } catch {
      setError("Slot already booked");
    } finally {
      setLoading(false);
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <h1>{company.name}</h1>
        {company.logo_url && <img src={company.logo_url} alt="logo" />}
      </header>

      {/* OTP */}
      {!otpVerified && (
        <div className={styles.centerCard}>
          <h2>Email Verification</h2>
          {error && <p className={styles.error}>{error}</p>}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
          {!otpSent ? (
            <button onClick={sendOtp}>Send OTP</button>
          ) : (
            <>
              <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="OTP" />
              <button onClick={verifyOtp}>Verify</button>
            </>
          )}
        </div>
      )}

      {/* BOOKING UI */}
      {otpVerified && (
        <div className={styles.content}>
          {/* LEFT */}
          <div className={styles.card}>
            <h2>Book Conference Room</h2>

            <label>Room</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value="">Select</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.room_name}</option>
              ))}
            </select>

            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />

            <label>Start Time</label>
            <select value={start} onChange={e => setStart(e.target.value)}>
              <option value="">Select</option>
              {TIME_SLOTS.map(t => (
                <option key={t} value={t} disabled={bookedSlots.has(t)}>
                  {t}
                </option>
              ))}
            </select>

            <button onClick={confirmBooking} disabled={loading}>
              Confirm Booking
            </button>
          </div>

          {/* RIGHT */}
          <div className={styles.side}>
            <h3>Bookings</h3>
            {bookings.length === 0 && <p>No bookings</p>}
            {bookings.map(b => (
              <div key={b.id} className={styles.slot}>
                {b.start_time} – {b.end_time}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
