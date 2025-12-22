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
  const { slug } = useParams();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

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
      .then(res => res.json())
      .then(setRooms);
  }, [company, slug]);

  /* ================= LOAD BOOKINGS ================= */
  useEffect(() => {
    if (!roomId || !date) return;

    fetch(
      `${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}`
    )
      .then(res => res.json())
      .then(setBookings);
  }, [roomId, date, slug]);

  /* ================= SLOT AVAILABILITY ================= */
  const isBooked = (slot) => {
    return bookings.some(
      b => slot >= b.start_time && slot < b.end_time
    );
  };

  /* ================= OTP HANDLERS ================= */
  const sendOtp = async () => {
    if (!email) return setError("Enter email");

    setLoading(true);
    setError("");

    await fetch(`${API}/api/public/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    setOtpSent(true);
    setLoading(false);
  };

  const verifyOtp = async () => {
    const res = await fetch(`${API}/api/public/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
    });

    if (!res.ok) return setError("Invalid OTP");

    setOtpVerified(true);
  };

  /* ================= CREATE BOOKING ================= */
  const confirmBooking = async () => {
    if (!roomId || !date || !selectedSlot) {
      return setError("Select room, date & slot");
    }

    const endTime =
      TIME_SLOTS[TIME_SLOTS.indexOf(selectedSlot) + 1];

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

    if (!res.ok) {
      return setError("Slot already booked");
    }

    alert("Booking confirmed! Confirmation sent to email.");
  };

  /* ================= UI ================= */
  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!company) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>{company.name}</h1>
        <img src={company.logo_url} className={styles.logo} />
      </header>

      {/* EMAIL + OTP */}
      {!otpVerified && (
        <div className={styles.card}>
          <h3>Email Verification</h3>

          <input
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {!otpSent ? (
            <button onClick={sendOtp} disabled={loading}>
              Send OTP
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
            <select onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Select Room</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* SLOT PICKER */}
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
