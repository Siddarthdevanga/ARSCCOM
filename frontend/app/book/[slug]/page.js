"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ================= TIME OPTIONS (09:30 – 19:00) ================= */
const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/* ================= AM/PM FORMAT ================= */
const toAmPm = (time24) => {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function PublicConferenceBooking() {
  const { slug } = useParams();

  const today = new Date().toISOString().split("T")[0];
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ================= LOAD COMPANY ================= */
  useEffect(() => {
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
      .then(d => setRooms(Array.isArray(d) ? d : []));
  }, [company, slug]);

  /* ================= LOAD BOOKINGS ================= */
  const loadBookings = () => {
    if (!roomId || !date) {
      setBookings([]);
      return;
    }

    fetch(`${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setBookings(Array.isArray(d) ? d : []));
  };

  useEffect(() => loadBookings(), [roomId, date, slug]);

  /* ================= START TIMES ================= */
  const availableStartTimes = useMemo(() => {
    return TIME_OPTIONS.filter(t => {
      if (date !== today) return true;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    });
  }, [date, today, nowMinutes]);

  const availableEndTimes = useMemo(() => {
    if (!startTime) return [];
    return TIME_OPTIONS.filter(t => t > startTime);
  }, [startTime]);

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    setOtpVerified(false);
    setOtpSent(false);
    setOtp("");
    setEmail("");
    setError("");
    setSuccess("");
  };

  /* ================= SEND OTP ================= */
  const sendOtp = async () => {
    if (!email.includes("@")) return setError("Enter a valid email");

    setLoading(true);
    setError("");

    try {
      const r = await fetch(`${API}/api/public/conference/company/${slug}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

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
    try {
      const r = await fetch(`${API}/api/public/conference/company/${slug}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });

      if (!r.ok) throw new Error();
      setOtpVerified(true);
    } catch {
      setError("Invalid OTP");
    }
  };

  /* ================= CONFIRM BOOKING ================= */
  const confirmBooking = async () => {
    if (!roomId || !date || !startTime || !endTime || !department)
      return setError("All fields except purpose are required");

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const r = await fetch(`${API}/api/public/conference/company/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          booked_by: email,
          department,
          purpose,
          booking_date: date,
          start_time: startTime,
          end_time: endTime
        })
      });

      if (!r.ok) throw new Error();

      setSuccess("Booking confirmed successfully");
      setStartTime("");
      setEndTime("");
      setDepartment("");
      setPurpose("");

      loadBookings();
    } catch {
      setError("Slot already booked");
    } finally {
      setLoading(false);
    }
  };

  /* ================= EDIT BOOKING ================= */
  const saveEdit = async (id) => {
    if (!editStart || !editEnd) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: editStart,
            end_time: editEnd
          })
        }
      );

      if (!r.ok) throw new Error();

      setSuccess("Booking updated successfully");
      setEditingId(null);
      loadBookings();
    } catch {
      setError("Unable to update booking — Slot may be booked");
    } finally {
      setLoading(false);
    }
  };

  /* ================= CANCEL BOOKING ================= */
  const cancelBooking = async (id) => {
    if (!confirm("Cancel this booking?")) return;

    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${id}/cancel`,
        { method: "PATCH" }
      );

      if (!r.ok) throw new Error();
      loadBookings();
    } catch {
      alert("Failed to cancel");
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {otpVerified ? (
          <button className={styles.logout} onClick={handleLogout}>
            ⎋
          </button>
        ) : (
          <span />
        )}

        <h1>{company.name}</h1>
        {company.logo_url && <img src={company.logo_url} alt="logo" />}
      </header>

      {!otpVerified ? (
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
      ) : (
        <div className={styles.layout}>
          <div className={styles.card}>
            <h2>Book Conference Room</h2>

            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}

            <label>Date</label>
            <input type="date" value={date} min={today}
              onChange={e => setDate(e.target.value)}
            />

            <label>Room</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value="">Select</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.room_name}</option>
              ))}
            </select>

            <label>Start Time</label>
            <select value={startTime} onChange={e => setStartTime(e.target.value)}>
              <option value="">Select</option>
              {availableStartTimes.map(t => (
                <option key={t} value={t}>{toAmPm(t)}</option>
              ))}
            </select>

            <label>End Time</label>
            <select value={endTime} onChange={e => setEndTime(e.target.value)}>
              <option value="">Select</option>
              {TIME_OPTIONS.filter(t => t > startTime).map(t => (
                <option key={t} value={t}>{toAmPm(t)}</option>
              ))}
            </select>

            <label>Department</label>
            <input value={department} onChange={e => setDepartment(e.target.value)} />

            <label>Purpose</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)} />

            <button onClick={confirmBooking} disabled={loading}>
              Confirm Booking
            </button>
          </div>

          <div className={styles.card}>
            <h2>Bookings</h2>

            {!bookings.length && <p>No bookings</p>}

            {bookings.map(b => (
              <div key={b.id} className={styles.booking}>
                {editingId === b.id ? (
                  <>
                    <b>{b.department}</b>

                    <select value={editStart} onChange={e => setEditStart(e.target.value)}>
                      {TIME_OPTIONS.map(t => (
                        <option key={t} value={t}>{toAmPm(t)}</option>
                      ))}
                    </select>

                    <select value={editEnd} onChange={e => setEditEnd(e.target.value)}>
                      {TIME_OPTIONS.filter(t => t > editStart).map(t => (
                        <option key={t} value={t}>{toAmPm(t)}</option>
                      ))}
                    </select>

                    <button onClick={() => saveEdit(b.id)}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <b>{toAmPm(b.start_time)} – {toAmPm(b.end_time)}</b>
                    <p>{b.department}</p>
                    <span>{b.booked_by}</span>

                    <div>
                      <button onClick={() => {
                        setEditingId(b.id);
                        setEditStart(b.start_time);
                        setEditEnd(b.end_time);
                      }}>
                        Edit
                      </button>

                      <button onClick={() => cancelBooking(b.id)}>
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
