"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ======================================================
   TIME OPTIONS — 15-minute intervals (00, 15, 30, 45)
====================================================== */
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const totalMinutes = i * 15;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;

  return {
    label: `${hour}:${String(m).padStart(2, "0")} ${ampm}`,
    value: `${hour}:${String(m).padStart(2, "0")} ${ampm}`,
    minutes: totalMinutes
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

/* ======================================================
   MODAL COMPONENT
====================================================== */
const Modal = ({ isOpen, onClose, title, children, type = "info" }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✕";
      default:
        return "ℹ";
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={`${styles.modalHeader} ${styles[`modal${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
          <span className={styles.modalIcon}>{getIcon()}</span>
          <h3>{title}</h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ======================================================
   TIME SCROLLER COMPONENT
====================================================== */
const TimeScroller = ({ value, onChange, label, minTime = null, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollContainerRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (minTime) {
      const minMinutes = ampmToMinutes(minTime);
      return TIME_OPTIONS.filter(t => t.minutes > minMinutes);
    }
    return TIME_OPTIONS;
  }, [minTime]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current && value) {
      const selectedIndex = filteredOptions.findIndex(t => t.value === value);
      if (selectedIndex !== -1) {
        const itemHeight = 40;
        scrollContainerRef.current.scrollTop = selectedIndex * itemHeight - 80;
      }
    }
  }, [isOpen, value, filteredOptions]);

  const handleSelect = (timeValue) => {
    onChange(timeValue);
    setIsOpen(false);
  };

  return (
    <div className={styles.timeScroller}>
      <label>{label}</label>
      <div 
        className={`${styles.timeInput} ${disabled ? styles.timeInputDisabled : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <span className={value ? styles.timeSelected : styles.timePlaceholder}>
          {value || "Select time"}
        </span>
        <span className={styles.timeIcon}>🕒</span>
      </div>

      {isOpen && (
        <>
          <div className={styles.timeDropdownBackdrop} onClick={() => setIsOpen(false)} />
          <div className={styles.timeDropdown}>
            <div className={styles.timeDropdownHeader}>
              <span>Select {label}</span>
              <button onClick={() => setIsOpen(false)}>×</button>
            </div>
            <div 
              className={styles.timeList} 
              ref={scrollContainerRef}
            >
              {filteredOptions.map(time => (
                <div
                  key={time.value}
                  className={`${styles.timeOption} ${value === time.value ? styles.timeOptionSelected : ""}`}
                  onClick={() => handleSelect(time.value)}
                >
                  {time.label}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ======================================================
   BANNER COMPONENT
====================================================== */
const Banner = ({ message, type = "warning", onClose }) => {
  if (!message) return null;

  return (
    <div className={`${styles.banner} ${styles[`banner${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
      <div className={styles.bannerContent}>
        <span className={styles.bannerIcon}>
          {type === "warning" && "⚠"}
          {type === "error" && "✕"}
          {type === "info" && "ℹ"}
        </span>
        <p>{message}</p>
      </div>
      {onClose && (
        <button className={styles.bannerClose} onClick={onClose}>×</button>
      )}
    </div>
  );
};

/* ======================================================
   MAIN COMPONENT
====================================================== */
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
  const [planBanner, setPlanBanner] = useState("");

  // Modal states
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, data: null });
  const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, data: null });
  const [cancelModal, setCancelModal] = useState({ isOpen: false, data: null });
  const [resultModal, setResultModal] = useState({ isOpen: false, type: "", message: "" });

  /* ================= COMPANY ================= */
  useEffect(() => {
    fetch(`${API}/api/public/conference/company/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error("Invalid booking link");
        return r.json();
      })
      .then(setCompany)
      .catch(err => {
        setError(err.message);
      });
  }, [slug]);

  /* ================= ROOMS ================= */
  useEffect(() => {
    if (!company) return;
    
    fetch(`${API}/api/public/conference/company/${slug}/rooms`)
      .then(async r => {
        if (!r.ok) {
          const data = await r.json();
          if (r.status === 403 && data.message?.includes("Plan validity exceeded")) {
            setPlanBanner(data.message);
          }
          return [];
        }
        return r.json();
      })
      .then(setRooms)
      .catch(() => setRooms([]));
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
      })
      .catch(() => setBookings([]));
  };

  useEffect(() => {
    loadBookings();
  }, [roomId, date, slug, otpVerified]);

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
    setRoomId("");
    setDate(today);
    setStartTime("");
    setEndTime("");
    setDepartment("");
    setPurpose("");
    setError("");
    setSuccess("");
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
      setSuccess("OTP sent to your email");
      setResendTimer(30);
    } catch (e) {
      setError(e.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resendTimer) return;
    const t = setInterval(() => setResendTimer(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const resendOtp = async () => {
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

      setSuccess("OTP resent to your email");
      setResendTimer(30);
    } catch (e) {
      setError(e.message || "Failed to resend OTP");
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return setError("Enter OTP");
    
    setLoading(true);
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

      if (!r.ok) throw new Error("Invalid or expired OTP");

      setOtpVerified(true);
      setSuccess("Email verified successfully");
      loadBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= BOOK - Show Confirmation Modal ================= */
  const initiateBooking = () => {
    setError("");
    setSuccess("");
    
    if (!roomId || !date || !startTime || !endTime || !department) {
      return setError("All fields except purpose are required");
    }

    if (ampmToMinutes(endTime) <= ampmToMinutes(startTime)) {
      return setError("End time must be after start time");
    }

    if (!isSlotFree(startTime, endTime)) {
      return setError("Selected time slot conflicts with existing booking");
    }

    const selectedRoom = rooms.find(r => r.id === Number(roomId));
    
    setConfirmModal({
      isOpen: true,
      data: {
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date,
        startTime,
        endTime,
        department,
        purpose: purpose || "—"
      }
    });
  };

  const confirmBooking = async () => {
    setConfirmModal({ isOpen: false, data: null });
    setLoading(true);

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

      const responseData = await r.json();

      if (!r.ok) {
        throw new Error(responseData?.message || "Booking failed");
      }

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Your conference room has been booked successfully! A confirmation email has been sent to you."
      });

      setStartTime("");
      setEndTime("");
      setDepartment("");
      setPurpose("");
      loadBookings();
    } catch (err) {
      setResultModal({
        isOpen: true,
        type: "error",
        message: err.message || "Failed to book the room. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= EDIT - Show Reschedule Modal ================= */
  const initiateEdit = (booking) => {
    setEditingId(booking.id);
    setEditStart(booking.start_time);
    setEditEnd(booking.end_time);
    setError("");
  };

  const showRescheduleConfirmation = () => {
    setError("");
    
    if (!editStart || !editEnd) {
      return setError("Select both start and end times");
    }

    if (ampmToMinutes(editEnd) <= ampmToMinutes(editStart)) {
      return setError("End time must be after start time");
    }

    if (!isSlotFree(editStart, editEnd, editingId)) {
      return setError("Selected time slot is not available");
    }

    const booking = bookings.find(b => b.id === editingId);
    const selectedRoom = rooms.find(r => r.id === booking.room_id);

    setRescheduleModal({
      isOpen: true,
      data: {
        id: editingId,
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date: booking.booking_date,
        oldStart: booking.start_time,
        oldEnd: booking.end_time,
        newStart: editStart,
        newEnd: editEnd
      }
    });
  };

  const confirmReschedule = async () => {
    const { id } = rescheduleModal.data;
    setRescheduleModal({ isOpen: false, data: null });
    setLoading(true);

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

      const responseData = await r.json();

      if (!r.ok) {
        throw new Error(responseData?.message || "Update failed");
      }

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Your booking has been rescheduled successfully! A confirmation email has been sent to you."
      });

      setEditingId(null);
      setEditStart("");
      setEditEnd("");
      loadBookings();
    } catch (err) {
      setResultModal({
        isOpen: true,
        type: "error",
        message: err.message || "Failed to reschedule. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
    setError("");
  };

  /* ================= CANCEL - Show Cancellation Modal ================= */
  const initiateCancellation = (booking) => {
    const selectedRoom = rooms.find(r => r.id === booking.room_id);
    
    setCancelModal({
      isOpen: true,
      data: {
        id: booking.id,
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date: booking.booking_date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        department: booking.department
      }
    });
  };

  const confirmCancellation = async () => {
    const { id } = cancelModal.data;
    setCancelModal({ isOpen: false, data: null });
    setLoading(true);

    try {
      const r = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${id}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      const responseData = await r.json();

      if (!r.ok) {
        throw new Error(responseData?.message || "Cancellation failed");
      }

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Your booking has been cancelled successfully. A confirmation email has been sent to you."
      });

      loadBookings();
    } catch (err) {
      setResultModal({
        isOpen: true,
        type: "error",
        message: err.message || "Failed to cancel booking. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  if (!company) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Plan Limit Banner */}
      {planBanner && (
        <Banner 
          message={planBanner} 
          type="error"
          onClose={() => setPlanBanner("")}
        />
      )}

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1>{company.name}</h1>
            <p className={styles.subtitle}>Conference Room Booking</p>
          </div>

          <div className={styles.headerRight}>
            {otpVerified && (
              <>
                <span className={styles.userEmail}>{email}</span>
                <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
                  <span>⎋</span>
                </button>
              </>
            )}

            {company.logo_url && (
              <img src={company.logo_url} alt={company.name} className={styles.logo} />
            )}
          </div>
        </div>
      </header>

      {/* ================= OTP VERIFICATION ================= */}
      {!otpVerified ? (
        <div className={styles.container}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2>Email Verification</h2>
              <p>Enter your email to receive a one-time password</p>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}
            {success && <div className={styles.successMsg}>{success}</div>}

            <div className={styles.formGroup}>
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                placeholder="your.email@company.com"
                onChange={e => setEmail(e.target.value)}
                className={styles.input}
                disabled={otpSent}
              />
            </div>

            {!otpSent ? (
              <button 
                onClick={sendOtp} 
                disabled={loading}
                className={styles.primaryBtn}
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label>Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    placeholder="000000"
                    onChange={e => setOtp(e.target.value)}
                    className={styles.input}
                    maxLength={6}
                  />
                </div>

                <button 
                  onClick={verifyOtp} 
                  disabled={loading}
                  className={styles.primaryBtn}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>

                <button 
                  onClick={resendOtp} 
                  disabled={loading || resendTimer > 0}
                  className={styles.secondaryBtn}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.container}>
          <div className={styles.layout}>
            {/* ================= BOOKING FORM ================= */}
            <div className={styles.card}>
              <h2>Book a Conference Room</h2>

              {error && <div className={styles.errorMsg}>{error}</div>}
              {success && <div className={styles.successMsg}>{success}</div>}

              <div className={styles.formGroup}>
                <label>Date *</label>
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={e => setDate(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Room *</label>
                <select 
                  value={roomId} 
                  onChange={e => setRoomId(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Select a room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.room_name} (#{r.room_number})
                    </option>
                  ))}
                </select>
              </div>

              <TimeScroller
                value={startTime}
                onChange={setStartTime}
                label="Start Time"
                disabled={!roomId || !date}
              />

              <TimeScroller
                value={endTime}
                onChange={setEndTime}
                label="End Time"
                minTime={startTime}
                disabled={!startTime}
              />

              <div className={styles.formGroup}>
                <label>Department *</label>
                <input
                  type="text"
                  value={department}
                  placeholder="e.g., Engineering, Sales"
                  onChange={e => setDepartment(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Purpose (Optional)</label>
                <input
                  type="text"
                  value={purpose}
                  placeholder="e.g., Team Meeting, Client Call"
                  onChange={e => setPurpose(e.target.value)}
                  className={styles.input}
                />
              </div>

              <button
                onClick={initiateBooking}
                disabled={loading || !roomId || !date}
                className={styles.primaryBtn}
              >
                {loading ? "Processing..." : "Book Room"}
              </button>
            </div>

            {/* ================= BOOKINGS LIST ================= */}
            <div className={styles.card}>
              <h2>Current Bookings</h2>
              
              {!roomId || !date ? (
                <p className={styles.emptyState}>Select a room and date to view bookings</p>
              ) : !bookings.length ? (
                <p className={styles.emptyState}>No bookings for this date</p>
              ) : (
                <div className={styles.bookingsList}>
                  {bookings.map(b => (
                    <div key={b.id} className={styles.bookingItem}>
                      {editingId === b.id ? (
                        <>
                          <div className={styles.bookingHeader}>
                            <h4>Reschedule Booking</h4>
                          </div>
                          
                          <div className={styles.bookingDetails}>
                            <p><strong>Department:</strong> {b.department}</p>
                          </div>

                          <TimeScroller
                            value={editStart}
                            onChange={setEditStart}
                            label="New Start Time"
                          />

                          <TimeScroller
                            value={editEnd}
                            onChange={setEditEnd}
                            label="New End Time"
                            minTime={editStart}
                          />

                          <div className={styles.bookingActions}>
                            <button 
                              onClick={showRescheduleConfirmation}
                              className={styles.primaryBtn}
                            >
                              Save Changes
                            </button>
                            <button 
                              onClick={cancelEdit}
                              className={styles.secondaryBtn}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.bookingHeader}>
                            <div className={styles.bookingTime}>
                              <span className={styles.timeIcon}>🕒</span>
                              <strong>{b.start_time} – {b.end_time}</strong>
                            </div>
                          </div>

                          <div className={styles.bookingDetails}>
                            <p><strong>Department:</strong> {b.department}</p>
                            {b.purpose && <p><strong>Purpose:</strong> {b.purpose}</p>}
                            <p className={styles.bookedBy}>
                              <span>👤</span> {b.booked_by}
                            </p>
                          </div>

                          {b.can_modify && (
                            <div className={styles.bookingActions}>
                              <button
                                onClick={() => initiateEdit(b)}
                                className={styles.editBtn}
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => initiateCancellation(b)}
                                className={styles.cancelBtn}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      
      {/* Booking Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, data: null })}
        title="Confirm Booking"
        type="info"
      >
        {confirmModal.data && (
          <>
            <div className={styles.modalInfo}>
              <p><strong>Room:</strong> {confirmModal.data.room} {confirmModal.data.roomNumber && `(#${confirmModal.data.roomNumber})`}</p>
              <p><strong>Date:</strong> {confirmModal.data.date}</p>
              <p><strong>Time:</strong> {confirmModal.data.startTime} – {confirmModal.data.endTime}</p>
              <p><strong>Department:</strong> {confirmModal.data.department}</p>
              <p><strong>Purpose:</strong> {confirmModal.data.purpose}</p>
            </div>
            <div className={styles.modalActions}>
              <button onClick={confirmBooking} className={styles.primaryBtn} disabled={loading}>
                {loading ? "Booking..." : "Confirm Booking"}
              </button>
              <button 
                onClick={() => setConfirmModal({ isOpen: false, data: null })}
                className={styles.secondaryBtn}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Reschedule Confirmation Modal */}
      <Modal
        isOpen={rescheduleModal.isOpen}
        onClose={() => setRescheduleModal({ isOpen:false, data: null })}
        title="Confirm Reschedule"
        type="warning"
      >
        {rescheduleModal.data && (
          <>
            <div className={styles.modalInfo}>
              <p><strong>Room:</strong> {rescheduleModal.data.room} {rescheduleModal.data.roomNumber && `(#${rescheduleModal.data.roomNumber})`}</p>
              <p><strong>Date:</strong> {rescheduleModal.data.date}</p>
              <div className={styles.modalTimeComparison}>
                <div className={styles.modalTimeOld}>
                  <span className={styles.modalTimeLabel}>Current Time:</span>
                  <span>{rescheduleModal.data.oldStart} – {rescheduleModal.data.oldEnd}</span>
                </div>
                <div className={styles.modalTimeArrow}>→</div>
                <div className={styles.modalTimeNew}>
                  <span className={styles.modalTimeLabel}>New Time:</span>
                  <span>{rescheduleModal.data.newStart} – {rescheduleModal.data.newEnd}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button onClick={confirmReschedule} className={styles.primaryBtn} disabled={loading}>
                {loading ? "Rescheduling..." : "Confirm Reschedule"}
              </button>
              <button 
                onClick={() => setRescheduleModal({ isOpen: false, data: null })}
                className={styles.secondaryBtn}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, data: null })}
        title="Cancel Booking"
        type="error"
      >
        {cancelModal.data && (
          <>
            <div className={styles.modalInfo}>
              <p className={styles.modalWarning}>Are you sure you want to cancel this booking?</p>
              <p><strong>Room:</strong> {cancelModal.data.room} {cancelModal.data.roomNumber && `(#${cancelModal.data.roomNumber})`}</p>
              <p><strong>Date:</strong> {cancelModal.data.date}</p>
              <p><strong>Time:</strong> {cancelModal.data.startTime} – {cancelModal.data.endTime}</p>
              <p><strong>Department:</strong> {cancelModal.data.department}</p>
            </div>
            <div className={styles.modalActions}>
              <button onClick={confirmCancellation} className={styles.dangerBtn} disabled={loading}>
                {loading ? "Cancelling..." : "Yes, Cancel Booking"}
              </button>
              <button 
                onClick={() => setCancelModal({ isOpen: false, data: null })}
                className={styles.secondaryBtn}
                disabled={loading}
              >
                No, Keep Booking
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Result Modal (Success/Error) */}
      <Modal
        isOpen={resultModal.isOpen}
        onClose={() => setResultModal({ isOpen: false, type: "", message: "" })}
        title={resultModal.type === "success" ? "Success" : "Error"}
        type={resultModal.type}
      >
        <div className={styles.modalInfo}>
          <p>{resultModal.message}</p>
        </div>
        <div className={styles.modalActions}>
          <button 
            onClick={() => setResultModal({ isOpen: false, type: "", message: "" })}
            className={styles.primaryBtn}
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}
