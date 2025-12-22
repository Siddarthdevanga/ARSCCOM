"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30"
];

export default function PublicBookingPage() {
  const params = useParams();
  const slug = params?.slug?.toLowerCase();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= LOAD COMPANY ================= */
  useEffect(() => {
    if (!slug || !API) return;

    setError("");

    fetch(`${API}/api/public/conference/company/${slug}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setCompany)
      .catch(() => setError("Invalid booking link"));
  }, [slug]);

  /* ================= LOAD ROOMS ================= */
  useEffect(() => {
    if (!company) return;

    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, [company, slug]);

  /* ================= LOAD BOOKINGS ================= */
  useEffect(() => {
    if (!roomId || !date) return;

    fetch(
      `${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}`
    )
      .then(res => res.ok ? res.json() : [])
      .then(data => setBookings(Array.isArray(data) ? data : []))
      .catch(() => setBookings([]));
  }, [roomId, date, slug]);

  /* ================= SLOT CHECK ================= */
  const isBooked = (slot) =>
    Array.isArray(bookings) &&
    bookings.some(b => slot >= b.start_time && slot < b.end_time);

  /* ================= SEND OTP ================= */
  const sendOtp = async () => {
    if (!email.includes("@")) {
      return setError("Enter a valid email");
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
      setError("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  /* ================= VERIFY OTP ================= */
  const verifyOtp = async () => {
    if (!otp) return setError("Enter OTP");

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
      setError("");
    } catch {
      setError("Invalid or expired OTP");
    }
  };

  /* ================= CONFIRM BOOKING ================= */
  const confirmBooking = async () => {
    if (!roomId || !date || !selectedSlot) {
      return setError("Select room, date & slot");
    }

    const idx = TIME_SLOTS.indexOf(selectedSlot);
    const endTime = TIME_SLOTS[idx + 1];

    if (!endTime) {
      return setError("Invalid time slot");
    }

    try {
      const res = await fetch(
        `${API}/api/public/conference/company/${slug}/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            bookedBy: email,
            date,
            startTime: selectedSlot,
            endTime,
            purpose: "Meeting"
          })
        }
      );

      if (!res.ok) throw new Error();

      alert("✅ Booking confirmed! Email sent.");
      setSelectedSlot("");
    } catch {
      setError("Slot already booked");
    }
  };

  /* ================= UI ================= */
  if (error) return <div className={styles.error}>{error}</div>;
  if (!company) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>{company.name}</h1>
        {company.logo_url && (
          <img src={company.logo_url} className={styles.logo} />
        )}
      </header>

      {/* EMAIL + OTP */}
      {!otpVerified && (
        <div className={styles.card}>
          <h3>Email Verification</h3>

          <input
            placeholder="Enter email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setOtpSent(false);
              setOtpVerified(false);
              setOtp("");
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

      {/* BOOKING UI */}
      {otpVerified && (
        <>
          <div className={styles.card}>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Select Room</option>
              {Array.isArray(rooms) &&
                rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
            </select>

            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className={styles.slotGrid}>
            {TIME_SLOTS.map(slot => (
              <button
                key={slot}
                disabled={isBooked(slot)}
                className={
                  selectedSlot === slot
                    ? styles.activeSlot
                    : styles.slot
                }
                onClick={() => setSelectedSlot(slot)}
              >
                {slot}
              </button>
            ))}
          </div>

          <button
            className={styles.confirmBtn}
            onClick={confirmBooking}
          >
            Confirm Booking
          </button>
        </>
      )}
    </div>
  );
}
