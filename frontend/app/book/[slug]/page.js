"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ===== TIME SLOTS (ADMIN MATCHING) ===== */
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function PublicConferenceBooking() {
  const { slug } = useParams();
  const router = useRouter();

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= LOAD COMPANY ================= */
  useEffect(() => {
    if (!slug) return;

    fetch(`${API}/api/public/conference/company/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setCompany)
      .catch(() => setError("Invalid or expired booking link"));
  }, [slug]);

  /* ================= LOAD ROOMS ================= */
  useEffect(() => {
    if (!company) return;

    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setRooms(Array.isArray(d) ? d : []))
      .catch(() => setRooms([]));
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
      .then(d => setBookings(Array.isArray(d) ? d : []))
      .catch(() => setBookings([]));
  }, [roomId, date, slug]);

  /* ================= BOOKED SLOTS ================= */
  const bookedSlots = useMemo(() => {
    const s = new Set();
    bookings.forEach(b => {
      TIME_SLOTS.forEach(t => {
        if (t >= b.start_time && t < b.end_time) {
          s.add(t);
        }
      });
    });
    return s;
  }, [bookings]);

  /* ================= SEND OTP ================= */
  const sendOtp = async () => {
    if (!email.includes("@")) return setError("Enter valid email");

    setLoading(true);
    setError("");

    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );
      if (!r.ok) throw new Error();
      setOtpSent(true);
    } catch {
      setError("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  /* ================= VERIFY OTP ================= */
  const verifyOtp = async () => {
    setError("");
    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp })
        }
      );
      if (!r.ok) throw new Error();
      setOtpVerified(true);
    } catch {
      setError("Invalid OTP");
    }
  };

  /* ================= CONFIRM BOOKING ================= */
  const confirmBooking = async () => {
    if (!roomId || !date || !slot) {
      return setError("Select room, date and time");
    }

    const idx = TIME_SLOTS.indexOf(slot);
    const end = TIME_SLOTS[idx + 1];
    if (!end) return;

    setLoading(true);
    setError("");

    try {
      const r = await fetch(
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
            end_time: end
          })
        }
      );
      if (!r.ok) throw new Error();

      alert("✅ Booking confirmed");
      setSlot("");
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
        <button onClick={() => router.back()} className={styles.back}>←</button>
        <h1>{company.name}</h1>
        {company.logo_url && <img src={company.logo_url} alt="logo" />}
      </header>

      {/* OTP */}
      {!otpVerified && (
        <div className={styles.card}>
          <h2>Email Verification</h2>
          {error && <p className={styles.error}>{error}</p>}

          <input
            placeholder="Enter email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          {!otpSent ? (
            <button onClick={sendOtp}>Send OTP</button>
          ) : (
            <>
              <input
                placeholder="Enter OTP"
                value={otp}
                onChange={e => setOtp(e.target.value)}
              />
              <button onClick={verifyOtp}>Verify</button>
            </>
          )}
        </div>
      )}

      {/* BOOKING */}
      {otpVerified && (
        <div className={styles.layout}>
          {/* LEFT */}
          <div className={styles.card}>
            <h2>Book Conference Room</h2>
            {error && <p className={styles.error}>{error}</p>}

            <label>Room</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value="">Select</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.room_name}
                </option>
              ))}
            </select>

            <label>Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setDate(e.target.value)}
            />

            <label>Time Slot</label>
            <div className={styles.slots}>
              {TIME_SLOTS.map(t => (
                <button
                  key={t}
                  disabled={bookedSlots.has(t)}
                  className={slot === t ? styles.active : ""}
                  onClick={() => setSlot(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <button onClick={confirmBooking} disabled={loading}>
              Confirm Booking
            </button>
          </div>

          {/* RIGHT */}
          <div className={styles.card}>
            <h2>Bookings</h2>
            {!bookings.length && <p>No bookings</p>}
            {bookings.map(b => (
              <div key={b.id} className={styles.booking}>
                <b>{b.start_time} – {b.end_time}</b>
                <p>{b.booked_by}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
