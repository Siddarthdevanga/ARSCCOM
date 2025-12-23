"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ================= TIME SLOTS: 09:30 → 19:00 ================= */
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
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
  const [slot, setSlot] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= LOAD COMPANY ================= */
  useEffect(() => {
    if (!slug) return;

    setError("");

    fetch(`${API}/api/public/conference/company/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCompany)
      .catch(() => setError("Invalid or expired booking link"));
  }, [slug]);

  /* ================= LOAD ROOMS ================= */
  useEffect(() => {
    if (!company) return;

    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, [company, slug]);

  /* ================= LOAD BOOKINGS ================= */
  useEffect(() => {
    if (!roomId || !date) {
      setBookings([]);
      setSlot("");
      return;
    }

    fetch(
      `${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}`
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch(() => setBookings([]));
  }, [roomId, date, slug]);

  /* ================= BOOKED SLOT MAP ================= */
  const bookedSlots = useMemo(() => {
    const set = new Set();
    bookings.forEach((b) => {
      TIME_SLOTS.forEach((t) => {
        if (t >= b.start_time && t < b.end_time) {
          set.add(t);
        }
      });
    });
    return set;
  }, [bookings]);

  /* ================= SEND OTP ================= */
  const sendOtp = async () => {
    if (!email || !email.includes("@")) {
      return setError("Enter a valid email address");
    }

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
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ================= VERIFY OTP ================= */
  const verifyOtp = async () => {
    if (!otp) return setError("Enter OTP");

    setError("");

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
      setError("Invalid or expired OTP");
    }
  };

  /* ================= CONFIRM BOOKING ================= */
  const confirmBooking = async () => {
    if (!roomId || !date || !slot) {
      return setError("Select room, date and time");
    }

    const idx = TIME_SLOTS.indexOf(slot);
    const endTime = TIME_SLOTS[idx + 1];
    if (!endTime) return setError("Invalid time slot");

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

      alert("✅ Booking confirmed successfully!");
      setSlot("");
      setBookings([]);
    } catch {
      setError("This slot was just booked. Please choose another.");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RENDER ================= */
  if (error && !company) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!company) return null;

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <h1>{company.name}</h1>
        {company.logo_url && (
          <img src={company.logo_url} className={styles.logo} alt="Logo" />
        )}
      </header>

      {/* ================= OTP ================= */}
      {!otpVerified && (
        <div className={styles.card}>
          <h3>Email Verification</h3>

          {error && <p className={styles.error}>{error}</p>}

          <input
            placeholder="Enter email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setOtp("");
              setOtpSent(false);
              setError("");
            }}
          />

          {!otpSent ? (
            <button onClick={sendOtp} disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </button>
          ) : (
            <>
              <input
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button onClick={verifyOtp}>Verify</button>
            </>
          )}
        </div>
      )}

      {/* ================= BOOKING ================= */}
      {otpVerified && (
        <>
          <div className={styles.card}>
            {error && <p className={styles.error}>{error}</p>}

            <label>Conference Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Select Room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_name}
                </option>
              ))}
            </select>

            <label>Date</label>
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <label>Time Slot</label>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">Select time</option>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t} disabled={bookedSlots.has(t)}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <button
            className={styles.confirmBtn}
            onClick={confirmBooking}
            disabled={loading || !roomId || !date || !slot}
          >
            {loading ? "Booking..." : "Confirm Booking"}
          </button>
        </>
      )}
    </div>
  );
}

