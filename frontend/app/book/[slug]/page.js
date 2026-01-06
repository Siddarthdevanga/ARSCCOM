"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ======================================================
   PURE AM/PM TIME OPTIONS — Full 24 Hours (30 mins)
====================================================== */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";

  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;

  return {
    label: `${hour}:${m} ${ampm}`,     // User sees this
    value: `${hour}:${m} ${ampm}`,     // Stored in state also AM/PM
    minutes: h * 60 + Number(m)       // Used internally
  };
});

/* Convert DB HH:MM:SS → "4:30 PM" */
const dbToAmPm = t => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const am = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${am}`;
};

/* Convert AM/PM → minutes for comparison */
const ampmToMinutes = str => {
  if (!str) return 0;
  const [time, suffix] = str.split(" ");
  let [h, m] = time.split(":").map(Number);

  if (suffix === "PM" && h !== 12) h += 12;
  if (suffix === "AM" && h === 12) h = 0;

  return h * 60 + m;
};

export default function PublicConferenceBooking() {
  const { slug } = useParams();

  const today = new Date().toISOString().split("T")[0];
  const nowMinutes =
    new Date().getHours() * 60 + new Date().getMinutes();

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
  const [resendTimer, setResendTimer] = useState(0);

  /* ================= COMPANY ================= */
  useEffect(() => {
    fetch(`${API}/api/public/conference/company/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setCompany)
      .catch(() => setError("Invalid booking link"));
  }, [slug]);

  /* ================= ROOMS ================= */
  useEffect(() => {
    if (!company) return;
    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then(r => r.ok ? r.json() : [])
      .then(setRooms);
  }, [company, slug]);

  /* ================= BOOKINGS ================= */
  const loadBookings = () => {
    if (!roomId || !date) return setBookings([]);

    fetch(
      `${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}&userEmail=${email || ""}`
    )
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const fixed = (Array.isArray(data) ? data : []).map(b => ({
          ...b,
          start_time: dbToAmPm(b.start_time),
          end_time: dbToAmPm(b.end_time)
        }));
        setBookings(fixed);
      });
  };

  useEffect(() => loadBookings(), [roomId, date, slug, otpVerified]);

  /* ================= AVAILABLE STARTS ================= */
  const availableStartTimes = useMemo(() => {
    return TIME_OPTIONS.filter(t => {
      if (date === today && t.minutes <= nowMinutes) return false;
      return true;
    });
  }, [date, today, nowMinutes]);

  const isSlotFree = (s, e, ignore = null) =>
    !bookings.some(
      b =>
        b.id !== ignore &&
        ampmToMinutes(b.start_time) < ampmToMinutes(e) &&
        ampmToMinutes(b.end_time) > ampmToMinutes(s)
    );

  /* ================= AUTH ================= */
  const handleLogout = () => {
    setOtpVerified(false);
    setOtpSent(false);
    setOtp("");
    setEmail("");
    setBookings([]);
  };

  /* ================= OTP ================= */
  const sendOtp = async () => {
    if (!email.includes("@")) return setError("Enter valid email");
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message);

      setOtpSent(true);
      setSuccess("OTP sent");
      setResendTimer(30);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resendTimer) return;
    const t = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const resendOtp = async () => {
    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/resend-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message);

      setSuccess(d?.message);
      setResendTimer(30);
    } catch (e) {
      setError(e.message);
    }
  };

  const verifyOtp = async () => {
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
      setSuccess("OTP Verified");
      loadBookings();
    } catch {
      setError("Invalid OTP");
    }
  };

  /* ================= BOOK ================= */
  const confirmBooking = async () => {
    if (!roomId || !date || !startTime || !endTime || !department)
      return setError("All fields required");

    if (ampmToMinutes(endTime) <= ampmToMinutes(startTime))
      return setError("End must be after start");

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/book`,
        {
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
        }
      );

      if (!r.ok) throw new Error();

      setSuccess("Booking Confirmed");
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

  /* ================= EDIT ================= */
  const saveEdit = async id => {
    if (!editStart || !editEnd)
      return setError("Select both times");

    if (!isSlotFree(editStart, editEnd, id))
      return setError("Slot unavailable");

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
            end_time: editEnd,
            email
          })
        }
      );

      if (!r.ok) throw new Error();

      setEditingId(null);
      loadBookings();
    } catch {
      setError("Update failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= CANCEL (No popup dialog) ================= */
  const cancelBooking = async id => {
    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${id}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );
      if (!r.ok) throw new Error();
      loadBookings();
    } catch {
      alert("Cancel failed");
    }
  };

  if (!company) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
          <h1>{company.name}</h1>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {otpVerified && (
              <button className={styles.logout} onClick={handleLogout}>⎋</button>
            )}

            {company.logo_url && (
              <img src={company.logo_url} className={styles.logo} />
            )}
          </div>
        </div>
      </header>

      {/* ================= OTP ================= */}
      {!otpVerified ? (
        <div className={styles.card}>
          <h2>Email Verification</h2>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <input value={email} placeholder="Enter email" onChange={e => setEmail(e.target.value)} />

          {!otpSent ? (
            <button onClick={sendOtp} disabled={loading}>Send OTP</button>
          ) : (
            <>
              <input value={otp} placeholder="Enter OTP" onChange={e => setOtp(e.target.value)} />
              <button onClick={verifyOtp} disabled={loading}>Verify</button>

              <button onClick={resendOtp} disabled={loading || resendTimer > 0}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={styles.layout}>
          {/* ================= BOOK FORM ================= */}
          <div className={styles.card}>
            <h2>Book Conference Room</h2>

            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}

            <label>Date</label>
            <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} />

            <label>Room</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value="">Select</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.room_name}</option>
              ))}
            </select>

            <label>Start</label>
            <select value={startTime} onChange={e => setStartTime(e.target.value)}>
              <option value="">Select</option>
              {availableStartTimes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <label>End</label>
            <select value={endTime} onChange={e => setEndTime(e.target.value)}>
              <option value="">Select</option>
              {TIME_OPTIONS.filter(t => ampmToMinutes(t.value) > ampmToMinutes(startTime))
                .map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
            </select>

            <label>Department</label>
            <input value={department} onChange={e => setDepartment(e.target.value)} />

            <label>Purpose</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)} />

            <button onClick={confirmBooking} disabled={loading}>Confirm Booking</button>
          </div>

          {/* ================= BOOKINGS ================= */}
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
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>

                    <select value={editEnd} onChange={e => setEditEnd(e.target.value)}>
                      {TIME_OPTIONS.filter(t => ampmToMinutes(t.value) > ampmToMinutes(editStart))
                        .map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>

                    <button onClick={() => saveEdit(b.id)}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <b>{b.start_time} – {b.end_time}</b>
                    <p>{b.department}</p>
                    <span>{b.booked_by}</span>

                    {b.can_modify && (
                      <div>
                        <button onClick={() => {
                          setEditingId(b.id);
                          setEditStart(b.start_time);
                          setEditEnd(b.end_time);
                        }}>Edit</button>

                        <button onClick={() => cancelBooking(b.id)}>Cancel</button>
                      </div>
                    )}
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
