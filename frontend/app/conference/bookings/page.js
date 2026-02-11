"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

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
    value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    minutes: totalMinutes
  };
});

/* ======================================================
   NORMALIZE DB HH:MM:SS -> HH:MM
====================================================== */
const normalizeDbTime = (t = "") =>
  t.includes(":") ? t.slice(0, 5) : t;

/* Convert DB HH:MM -> "4:30 PM" */
const dbToAmPm = t => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const am = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${am}`;
};

/* Convert AM/PM -> minutes for comparison */
const ampmToMinutes = str => {
  if (!str) return 0;
  const [time, suffix] = str.split(" ");
  let [h, m] = time.split(":").map(Number);

  if (suffix === "PM" && h !== 12) h += 12;
  if (suffix === "AM" && h === 12) h = 0;

  return h * 60 + m;
};

/* Convert 24hr -> AM/PM */
const toAmPmStrict = (time24 = "") => {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const normalizeDate = (d) =>
  typeof d === "string" ? d.split("T")[0] : "";

/* ======================================================
   HELPER: Check if plan is unlimited
====================================================== */
const isUnlimitedPlan = (limit) => {
  if (!limit) return false;
  const str = String(limit).toLowerCase();
  return str === "unlimited" || str === "infinity" || limit === Infinity;
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
const TimeScroller = ({ value, onChange, label, minTime = null, disabled = false, excludedSlots = new Set(), currentDate = null, today = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollContainerRef = useRef(null);

  // Get current time in minutes (rounded up to next 15-min slot)
  const getCurrentMinutes = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // Round up to next 15-minute slot
    return Math.ceil(currentMinutes / 15) * 15;
  };

  const filteredOptions = useMemo(() => {
    let options = TIME_OPTIONS;
    
    // Filter based on current time if it's today's date
    if (currentDate === today && !minTime) {
      const nowMinutes = getCurrentMinutes();
      options = options.filter(t => t.minutes >= nowMinutes);
    }
    
    if (minTime) {
      const minMinutes = minTime.includes(":")
        ? parseInt(minTime.split(":")[0]) * 60 + parseInt(minTime.split(":")[1])
        : ampmToMinutes(minTime);
      options = options.filter(t => t.minutes > minMinutes);
    }
    
    // Filter out excluded slots
    options = options.filter(t => !excludedSlots.has(t.value));
    
    return options;
  }, [minTime, excludedSlots, currentDate, today]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current && value) {
      const selectedIndex = filteredOptions.findIndex(t => 
        t.value === value || toAmPmStrict(t.value) === value
      );
      if (selectedIndex !== -1) {
        const itemHeight = 40;
        // Use requestAnimationFrame to avoid flickering
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = selectedIndex * itemHeight - 80;
          }
        });
      }
    }
  }, [isOpen, value, filteredOptions]);

  const handleSelect = (timeValue) => {
    onChange(timeValue);
    setIsOpen(false);
  };

  const displayValue = value ? (value.includes("M") ? value : toAmPmStrict(value)) : "";

  return (
    <div className={styles.timeScroller}>
      <label>{label}</label>
      <div 
        className={`${styles.timeInput} ${disabled ? styles.timeInputDisabled : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <span className={displayValue ? styles.timeSelected : styles.timePlaceholder}>
          {displayValue || "Select time"}
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
                  className={`${styles.timeOption} ${value === time.value || toAmPmStrict(value) === time.label ? styles.timeOptionSelected : ""}`}
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
export default function ConferenceBookings() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [plan, setPlan] = useState(null);
  const [planBlocked, setPlanBlocked] = useState(false);

  const [date, setDate] = useState(today);
  const [roomId, setRoomId] = useState("");

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const [loading, setLoading] = useState(false);

  // Modal states
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, data: null });
  const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, data: null });
  const [cancelModal, setCancelModal] = useState({ isOpen: false, data: null });
  const [resultModal, setResultModal] = useState({ isOpen: false, type: "", message: "" });

  /* ======================================================
     LOAD DATA + PLAN (FIXED)
  ====================================================== */
  const loadAll = async () => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) setCompany(JSON.parse(stored));

      const [r, b, planRes] = await Promise.all([
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings"),
        apiFetch("/api/conference/plan-usage"),
      ]);

      console.log("📊 Plan Response:", planRes); // Debug log
      console.log("🏢 Rooms Response:", r); // Debug log

      setPlan(planRes);

      // Check if plan is blocked
      if (!planRes || planRes.message) {
        setPlanBlocked(true);
      } else {
        setPlanBlocked(false);
      }

      // ✅ FIXED: For unlimited plans, use ALL rooms returned by backend
      // Backend already filters by is_active = 1, so we trust it
      let allowedRooms = Array.isArray(r) ? r : [];

      // ✅ Only slice if NOT unlimited (case-insensitive check)
      if (!isUnlimitedPlan(planRes?.limit)) {
        const roomLimit = Number(planRes?.limit) || 0;
        allowedRooms = allowedRooms.slice(0, roomLimit);
        console.log(`🔒 Limited to ${roomLimit} rooms`);
      } else {
        console.log(`✅ Unlimited plan - showing all ${allowedRooms.length} active rooms`);
      }

      setRooms(allowedRooms);

      setBookings(
        Array.isArray(b)
          ? b.map((x) => ({
              ...x,
              start_time: normalizeDbTime(x.start_time),
              end_time: normalizeDbTime(x.end_time),
            }))
          : []
      );
    } catch (err) {
      console.error("❌ Load error:", err);
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ======================================================
     DAY BOOKINGS
  ====================================================== */
  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter(
      (b) =>
        normalizeDate(b.booking_date) === date &&
        Number(b.room_id) === Number(roomId) &&
        b.status === "BOOKED"
    );
  }, [bookings, date, roomId]);

  /* ======================================================
     BLOCKED SLOTS
  ====================================================== */
  const blockedSlots = useMemo(() => {
    const set = new Set();
    dayBookings.forEach((b) => {
      TIME_OPTIONS.forEach((t) => {
        if (t.value >= b.start_time && t.value < b.end_time) {
          set.add(t.value);
        }
      });
    });
    return set;
  }, [dayBookings]);

  /* ======================================================
     BLOCKED EXCLUDING CURRENT
  ====================================================== */
  const getBlockedSlotsExcluding = (id) => {
    const set = new Set();
    dayBookings.forEach((b) => {
      if (b.id === id) return;
      TIME_OPTIONS.forEach((t) => {
        if (t.value >= b.start_time && t.value < b.end_time) {
          set.add(t.value);
        }
      });
    });
    return set;
  };

  // Clear start and end times when date changes to today
  useEffect(() => {
    if (date === today && startTime) {
      const nowMinutes = Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15;
      const startMins = startTime.includes(":") && !startTime.includes("M")
        ? parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1])
        : ampmToMinutes(startTime);
      
      if (startMins < nowMinutes) {
        setStartTime("");
        setEndTime("");
      }
    }
  }, [date, today]);

  const isSlotFree = (s, e, ignore = null) => {
    const startMins = s.includes(":") && !s.includes("M")
      ? parseInt(s.split(":")[0]) * 60 + parseInt(s.split(":")[1])
      : ampmToMinutes(s);
    const endMins = e.includes(":") && !e.includes("M")
      ? parseInt(e.split(":")[0]) * 60 + parseInt(e.split(":")[1])
      : ampmToMinutes(e);

    return !dayBookings.some(
      b => {
        if (b.id === ignore) return false;
        const bStart = b.start_time.includes(":") && !b.start_time.includes("M")
          ? parseInt(b.start_time.split(":")[0]) * 60 + parseInt(b.start_time.split(":")[1])
          : ampmToMinutes(b.start_time);
        const bEnd = b.end_time.includes(":") && !b.end_time.includes("M")
          ? parseInt(b.end_time.split(":")[0]) * 60 + parseInt(b.end_time.split(":")[1])
          : ampmToMinutes(b.end_time);
        
        return bStart < endMins && bEnd > startMins;
      }
    );
  };

  /* ======================================================
     CREATE - Show Confirmation Modal
  ====================================================== */
  const initiateBooking = () => {
    setError("");
    setSuccess("");

    if (planBlocked)
      return setError("🚫 Your plan does not allow more bookings. Upgrade plan.");

    if (!date || !roomId || !startTime || !endTime || !department)
      return setError("All fields except purpose are required");

    const startMins = startTime.includes(":") && !startTime.includes("M")
      ? parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1])
      : ampmToMinutes(startTime);
    const endMins = endTime.includes(":") && !endTime.includes("M")
      ? parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1])
      : ampmToMinutes(endTime);

    if (endMins <= startMins)
      return setError("End time must be after start time");

    if (!isSlotFree(startTime, endTime))
      return setError("Selected time slot conflicts with existing booking");

    const selectedRoom = rooms.find(r => r.id === Number(roomId));
    
    setConfirmModal({
      isOpen: true,
      data: {
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date,
        startTime: startTime.includes("M") ? startTime : toAmPmStrict(startTime),
        endTime: endTime.includes("M") ? endTime : toAmPmStrict(endTime),
        department,
        purpose: purpose || "—"
      }
    });
  };

  const confirmBooking = async () => {
    setConfirmModal({ isOpen: false, data: null });
    setLoading(true);

    try {
      await apiFetch("/api/conference/bookings", {
        method: "POST",
        body: JSON.stringify({
          room_id: roomId,
          booked_by: "ADMIN",
          department,
          purpose,
          booking_date: date,
          start_time: startTime.includes("M") ? startTime : toAmPmStrict(startTime),
          end_time: endTime.includes("M") ? endTime : toAmPmStrict(endTime),
        }),
      });

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Booking created successfully!"
      });

      setStartTime("");
      setEndTime("");
      setDepartment("");
      setPurpose("");
      loadAll();
    } catch (e) {
      setResultModal({
        isOpen: true,
        type: "error",
        message: e.message || "Plan/Booking limit reached or slot conflict"
      });
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     EDIT - Show Reschedule Modal
  ====================================================== */
  const initiateEdit = (booking) => {
    setEditingId(booking.id);
    setEditStart(booking.start_time);
    setEditEnd(booking.end_time);
    setError("");
  };

  const showRescheduleConfirmation = () => {
    setError("");

    if (!editStart || !editEnd)
      return setError("Select both start and end times");

    const startMins = editStart.includes(":") && !editStart.includes("M")
      ? parseInt(editStart.split(":")[0]) * 60 + parseInt(editStart.split(":")[1])
      : ampmToMinutes(editStart);
    const endMins = editEnd.includes(":") && !editEnd.includes("M")
      ? parseInt(editEnd.split(":")[0]) * 60 + parseInt(editEnd.split(":")[1])
      : ampmToMinutes(editEnd);

    if (endMins <= startMins)
      return setError("End time must be after start time");

    if (!isSlotFree(editStart, editEnd, editingId))
      return setError("Selected time slot is not available");

    const booking = dayBookings.find(b => b.id === editingId);
    const selectedRoom = rooms.find(r => r.id === booking.room_id);

    setRescheduleModal({
      isOpen: true,
      data: {
        id: editingId,
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date: booking.booking_date,
        oldStart: booking.start_time.includes("M") ? booking.start_time : dbToAmPm(booking.start_time),
        oldEnd: booking.end_time.includes("M") ? booking.end_time : dbToAmPm(booking.end_time),
        newStart: editStart.includes("M") ? editStart : toAmPmStrict(editStart),
        newEnd: editEnd.includes("M") ? editEnd : toAmPmStrict(editEnd)
      }
    });
  };

  const confirmReschedule = async () => {
    const { id } = rescheduleModal.data;
    setRescheduleModal({ isOpen: false, data: null });
    setLoading(true);

    try {
      await apiFetch(`/api/conference/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          start_time: editStart.includes("M") ? editStart : toAmPmStrict(editStart),
          end_time: editEnd.includes("M") ? editEnd : toAmPmStrict(editEnd),
        }),
      });

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Booking updated successfully!"
      });

      setEditingId(null);
      setEditStart("");
      setEditEnd("");
      loadAll();
    } catch (e) {
      setResultModal({
        isOpen: true,
        type: "error",
        message: e.message || "Unable to update — slot conflict"
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

  /* ======================================================
     CANCEL - Show Cancellation Modal
  ====================================================== */
  const initiateCancellation = (booking) => {
    const selectedRoom = rooms.find(r => r.id === booking.room_id);
    
    setCancelModal({
      isOpen: true,
      data: {
        id: booking.id,
        room: selectedRoom?.room_name || "Unknown Room",
        roomNumber: selectedRoom?.room_number || "",
        date: booking.booking_date,
        startTime: booking.start_time.includes("M") ? booking.start_time : dbToAmPm(booking.start_time),
        endTime: booking.end_time.includes("M") ? booking.end_time : dbToAmPm(booking.end_time),
        department: booking.department
      }
    });
  };

  const confirmCancellation = async () => {
    const { id } = cancelModal.data;
    setCancelModal({ isOpen: false, data: null });
    setLoading(true);

    try {
      await apiFetch(`/api/conference/bookings/${id}/cancel`, {
        method: "PATCH",
      });

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Booking cancelled successfully!"
      });

      loadAll();
    } catch {
      setResultModal({
        isOpen: true,
        type: "error",
        message: "Failed to cancel booking"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!company) return null;

  /* ======================================================
     UI
  ====================================================== */
  return (
    <div className={styles.page}>
      {planBlocked && (
        <Banner 
          message="🚫 Booking not allowed. Upgrade plan to continue."
          type="error"
        />
      )}

      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ←
        </button>

        <h1 className={styles.companyName}>{company.name}</h1>

        <div className={styles.headerRight}>
          {company.logo_url && <img src={company.logo_url} alt="logo" />}
        </div>
      </header>

      <div className={styles.content}>
        {/* LEFT FORM */}
        <div className={styles.card}>
          <h2>Book Conference Room</h2>

          {error && <div className={styles.errorMsg}>{error}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}

          <div className={styles.formGroup}>
            <label>Date *</label>
            <input
              type="date"
              value={date}
              min={today}
              disabled={planBlocked}
              onChange={(e) => setDate(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Room * {plan && `(${rooms.length} available)`}</label>
            <select
              className={styles.select}
              value={roomId}
              disabled={planBlocked}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Select a room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_name}
                </option>
              ))}
            </select>
          </div>

          <TimeScroller
            value={startTime}
            onChange={setStartTime}
            label="Start Time"
            disabled={planBlocked || !roomId || !date}
            excludedSlots={blockedSlots}
            currentDate={date}
            today={today}
          />

          <TimeScroller
            value={endTime}
            onChange={setEndTime}
            label="End Time"
            minTime={startTime}
            disabled={planBlocked || !startTime}
            excludedSlots={blockedSlots}
            currentDate={date}
            today={today}
          />

          <div className={styles.formGroup}>
            <label>Department *</label>
            <input
              value={department}
              disabled={planBlocked}
              onChange={(e) => setDepartment(e.target.value)}
              className={styles.input}
              placeholder="e.g., Engineering, Sales"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Purpose (Optional)</label>
            <input
              value={purpose}
              disabled={planBlocked}
              onChange={(e) => setPurpose(e.target.value)}
              className={styles.input}
              placeholder="e.g., Team Meeting"
            />
          </div>

          <button 
            disabled={planBlocked || loading} 
            onClick={initiateBooking}
            className={styles.primaryBtn}
          >
            {loading ? "Processing..." : "Book Room"}
          </button>
        </div>

        {/* RIGHT LIST */}
        <div className={styles.side}>
          <h2>Bookings for {date}</h2>

          {!roomId || !date ? (
            <p className={styles.emptyState}>Select a room and date to view bookings</p>
          ) : dayBookings.length === 0 ? (
            <p className={styles.emptyState}>No bookings for this date</p>
          ) : (
            <div className={styles.bookingsList}>
              {dayBookings.map((b) => {
                const blocked = getBlockedSlotsExcluding(b.id);

                return (
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
                          excludedSlots={blocked}
                          currentDate={normalizeDate(b.booking_date)}
                          today={today}
                        />

                        <TimeScroller
                          value={editEnd}
                          onChange={setEditEnd}
                          label="New End Time"
                          minTime={editStart}
                          excludedSlots={blocked}
                          currentDate={normalizeDate(b.booking_date)}
                          today={today}
                        />

                        <div className={styles.bookingActions}>
                          <button
                            className={styles.primaryBtn}
                            onClick={showRescheduleConfirmation}
                          >
                            Save Changes
                          </button>

                          <button
                            className={styles.secondaryBtn}
                            onClick={cancelEdit}
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
                            <strong>
                              {b.start_time.includes("M") ? b.start_time : dbToAmPm(b.start_time)} – {b.end_time.includes("M") ? b.end_time : dbToAmPm(b.end_time)}
                            </strong>
                          </div>
                        </div>

                        <div className={styles.bookingDetails}>
                          <p><strong>Department:</strong> {b.department}</p>
                          {b.purpose && <p><strong>Purpose:</strong> {b.purpose}</p>}
                          <p className={styles.bookedBy}>
                            <span>👤</span> {b.booked_by}
                          </p>
                        </div>

                        <div className={styles.bookingActions}>
                          <button
                            className={styles.editBtn}
                            onClick={() => initiateEdit(b)}
                          >
                            Reschedule
                          </button>

                          <button
                            className={styles.cancelBtn}
                            onClick={() => initiateCancellation(b)}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
        onClose={() => setRescheduleModal({ isOpen: false, data: null })}
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
