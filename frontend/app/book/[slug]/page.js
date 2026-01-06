"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ======================================================
   SLOTS 9:30 AM → 7:30 PM (30 min)
====================================================== */
const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + 30 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;

  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;

  return {
    label: `${hour}:${m === 0 ? "00" : "30"} ${ampm}`,
    value: `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`
  };
});

/* DB "16:00:00" → "16:00" (safe) */
const normalizeDb = t => (t?.length >= 5 ? t.slice(0, 5) : t);

/* 24hr → AM/PM (backend required format) */
const toAmPmStrict = t => {
  const [h, m] = t.split(":").map(Number);
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

  const [resendTimer, setResendTimer] = useState(0);

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
      .then(setRooms);
  }, [company, slug]);

  /* ================= LOAD BOOKINGS ================= */
  const loadBookings = () => {
    if (!roomId || !date) return setBookings([]);

    fetch(
      `${API}/api/public/conference/company/${slug}/bookings?roomId=${roomId}&date=${date}&userEmail=${email || ""}`
    )
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const fixed = (Array.isArray(data) ? data : []).map(b => ({
          ...b,
          start_time: normalizeDb(b.start_time),
          end_time: normalizeDb(b.end_time)
        }));
        setBookings(fixed);
      });
  };

  useEffect(() => loadBookings(), [roomId, date, slug, otpVerified]);

  /* ================= SLOT FILTER LOGIC ================= */
  const availableStartTimes = useMemo(() => {
    return TIME_OPTIONS.filter(t => {
      if (date === today) {
        const [h, m] = t.value.split(":").map(Number);
        if (h * 60 + m <= nowMinutes) return false;
      }
      return true;
    });
  }, [date, today, nowMinutes]);

  const isSlotFree = (s, e, ignoreId = null) =>
    !bookings.some(b => b.id !== ignoreId && b.start_time < e && b.end_time > s);

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
      if (!r.ok) throw new Error(d?.message || "Failed");

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
    if (!email.includes("@")) return setError("Enter valid email");
    setLoading(true);
    setError("");
    setSuccess("");

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
      if (!r.ok) throw new Error(d?.message || "Failed");

      setSuccess(d?.message);
      setResendTimer(30);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    setSuccess("");

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
            start_time: toAmPmStrict(startTime),
            end_time: toAmPmStrict(endTime)
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
            start_time: toAmPmStrict(editStart),
            end_time: toAmPmStrict(editEnd),
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

  /* ================= CANCEL ================= */
  const cancelBooking = async id => {
    if (!confirm("Cancel booking?")) return;
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
              <button className={styles.logout} onClick={handleLogout}>
                ⎋
              </button>
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
              {TIME_OPTIONS.filter(t => t.value > startTime).map(t => (
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

            {bookings.map(b => {
              return (
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
                        {TIME_OPTIONS.filter(t => t.value > editStart).map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      <button onClick={() => saveEdit(b.id)}>Save</button>
                      <button onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <b>{toAmPmStrict(b.start_time)} – {toAmPmStrict(b.end_time)}</b>
                      <p>{b.department}</p>
                      <span>{b.booked_by}</span>

                      {b.can_modify && (
                        <div>
                          <button
                            onClick={() => {
                              setEditingId(b.id);
                              setEditStart(b.start_time);
                              setEditEnd(b.end_time);
                            }}
                          >
                            Edit
                          </button>

                          <button onClick={() => cancelBooking(b.id)}>Cancel</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
