"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ======================================================
   TIME OPTIONS — 15-minute intervals
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
    minutes: totalMinutes,
  };
});

const normalizeDbTime = (t = "") => (t.includes(":") ? t.slice(0, 5) : t);
const dbToAmPm = (t) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
const ampmToMinutes = (str) => { if (!str) return 0; const [time, suffix] = str.split(" "); let [h, m] = time.split(":").map(Number); if (suffix === "PM" && h !== 12) h += 12; if (suffix === "AM" && h === 12) h = 0; return h * 60 + m; };
const toAmPmStrict = (time24 = "") => { const [h, m] = time24.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
const normalizeDate = (d) => (typeof d === "string" ? d.split("T")[0] : "");
const isUnlimitedPlan = (limit) => { if (!limit) return false; const s = String(limit).toLowerCase(); return s === "unlimited" || s === "infinity" || limit === Infinity; };

/* ======================================================
   TIME SCROLLER
====================================================== */
const TimeScroller = ({ value, onChange, label, minTime = null, disabled = false, excludedSlots = new Set(), currentDate = null, today = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef(null);

  const getCurrentMinutes = () => { const now = new Date(); return Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15; };

  const filteredOptions = useMemo(() => {
    let opts = TIME_OPTIONS;
    if (currentDate === today && !minTime) { const now = getCurrentMinutes(); opts = opts.filter((t) => t.minutes >= now); }
    if (minTime) {
      const minM = minTime.includes(":") && !minTime.includes("M") ? parseInt(minTime.split(":")[0]) * 60 + parseInt(minTime.split(":")[1]) : ampmToMinutes(minTime);
      opts = opts.filter((t) => t.minutes > minM);
    }
    return opts.filter((t) => !excludedSlots.has(t.value));
  }, [minTime, excludedSlots, currentDate, today]);

  useEffect(() => {
    if (isOpen && scrollRef.current && value) {
      const idx = filteredOptions.findIndex((t) => t.value === value || toAmPmStrict(t.value) === value);
      if (idx !== -1) requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = idx * 40 - 80; });
    }
  }, [isOpen, value, filteredOptions]);

  const display = value ? (value.includes("M") ? value : toAmPmStrict(value)) : "";

  return (
    <div className={styles.timeScroller}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={`${styles.timeInput} ${disabled ? styles.timeDisabled : ""}`} onClick={() => !disabled && setIsOpen(true)}>
        <span className={display ? styles.timeVal : styles.timePH}>{display || "Select time"}</span>
        <span className={styles.timeClock}>🕒</span>
      </div>
      {isOpen && (
        <>
          <div className={styles.timeBackdrop} onClick={() => setIsOpen(false)} />
          <div className={styles.timeDrop}>
            <div className={styles.timeDropHead}><span>Select {label}</span><button onClick={() => setIsOpen(false)}>×</button></div>
            <div className={styles.timeList} ref={scrollRef}>
              {filteredOptions.map((t) => (
                <div key={t.value} className={`${styles.timeOpt} ${value === t.value || toAmPmStrict(value) === t.label ? styles.timeOptSel : ""}`} onClick={() => { onChange(t.value); setIsOpen(false); }}>
                  {t.label}
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
   MODAL
====================================================== */
const Modal = ({ isOpen, onClose, title, children, type = "info" }) => {
  if (!isOpen) return null;
  const icon = type === "success" ? "✓" : type === "warning" ? "⚠" : type === "error" ? "✕" : "ℹ";
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.modalHead} ${styles[`mh${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
          <span className={styles.modalIcon}>{icon}</span>
          <h3>{title}</h3>
          <button className={styles.modalX} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
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
  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, data: null });
  const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, data: null });
  const [cancelModal, setCancelModal] = useState({ isOpen: false, data: null });
  const [resultModal, setResultModal] = useState({ isOpen: false, type: "", message: "" });

  /* ===== LOAD ===== */
  const loadAll = async () => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) setCompany(JSON.parse(stored));
      const [r, b, planRes] = await Promise.all([apiFetch("/api/conference/rooms"), apiFetch("/api/conference/bookings"), apiFetch("/api/conference/plan-usage")]);
      setPlan(planRes);
      setPlanBlocked(!planRes || !!planRes.message);
      let allowed = Array.isArray(r) ? r : [];
      if (!isUnlimitedPlan(planRes?.limit)) allowed = allowed.slice(0, Number(planRes?.limit) || 0);
      setRooms(allowed);
      setBookings(Array.isArray(b) ? b.map((x) => ({ ...x, start_time: normalizeDbTime(x.start_time), end_time: normalizeDbTime(x.end_time) })) : []);
    } catch { router.replace("/auth/login"); }
  };

  useEffect(() => { loadAll(); }, []);

  const dayBookings = useMemo(() => {
    if (!date || !roomId) return [];
    return bookings.filter((b) => normalizeDate(b.booking_date) === date && Number(b.room_id) === Number(roomId) && b.status === "BOOKED");
  }, [bookings, date, roomId]);

  const blockedSlots = useMemo(() => {
    const set = new Set();
    dayBookings.forEach((b) => { TIME_OPTIONS.forEach((t) => { if (t.value >= b.start_time && t.value < b.end_time) set.add(t.value); }); });
    return set;
  }, [dayBookings]);

  const getBlockedExcluding = (id) => {
    const set = new Set();
    dayBookings.forEach((b) => { if (b.id === id) return; TIME_OPTIONS.forEach((t) => { if (t.value >= b.start_time && t.value < b.end_time) set.add(t.value); }); });
    return set;
  };

  useEffect(() => {
    if (date === today && startTime) {
      const now = Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15;
      const sm = startTime.includes(":") && !startTime.includes("M") ? parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]) : ampmToMinutes(startTime);
      if (sm < now) { setStartTime(""); setEndTime(""); }
    }
  }, [date, today]);

  const isSlotFree = (s, e, ignore = null) => {
    const sM = s.includes(":") && !s.includes("M") ? parseInt(s.split(":")[0]) * 60 + parseInt(s.split(":")[1]) : ampmToMinutes(s);
    const eM = e.includes(":") && !e.includes("M") ? parseInt(e.split(":")[0]) * 60 + parseInt(e.split(":")[1]) : ampmToMinutes(e);
    return !dayBookings.some((b) => { if (b.id === ignore) return false; const bS = b.start_time.includes(":") && !b.start_time.includes("M") ? parseInt(b.start_time.split(":")[0]) * 60 + parseInt(b.start_time.split(":")[1]) : ampmToMinutes(b.start_time); const bE = b.end_time.includes(":") && !b.end_time.includes("M") ? parseInt(b.end_time.split(":")[0]) * 60 + parseInt(b.end_time.split(":")[1]) : ampmToMinutes(b.end_time); return bS < eM && bE > sM; });
  };

  /* ===== BOOK ===== */
  const initiateBooking = () => {
    setError("");
    if (planBlocked) return setError("Plan does not allow bookings. Upgrade.");
    if (!date || !roomId || !startTime || !endTime || !department) return setError("All fields except purpose are required");
    const sM = startTime.includes(":") && !startTime.includes("M") ? parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]) : ampmToMinutes(startTime);
    const eM = endTime.includes(":") && !endTime.includes("M") ? parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]) : ampmToMinutes(endTime);
    if (eM <= sM) return setError("End time must be after start time");
    if (!isSlotFree(startTime, endTime)) return setError("Time slot conflicts with existing booking");
    const room = rooms.find((r) => r.id === Number(roomId));
    setConfirmModal({ isOpen: true, data: { room: room?.room_name || "Unknown", roomNumber: room?.room_number || "", date, startTime: startTime.includes("M") ? startTime : toAmPmStrict(startTime), endTime: endTime.includes("M") ? endTime : toAmPmStrict(endTime), department, purpose: purpose || "—" } });
  };

  const confirmBooking = async () => {
    setConfirmModal({ isOpen: false, data: null }); setLoading(true);
    try {
      await apiFetch("/api/conference/bookings", { method: "POST", body: JSON.stringify({ room_id: roomId, booked_by: "ADMIN", department, purpose, booking_date: date, start_time: startTime.includes("M") ? startTime : toAmPmStrict(startTime), end_time: endTime.includes("M") ? endTime : toAmPmStrict(endTime) }) });
      setResultModal({ isOpen: true, type: "success", message: "Booking created!" }); setStartTime(""); setEndTime(""); setDepartment(""); setPurpose(""); loadAll();
    } catch (e) { setResultModal({ isOpen: true, type: "error", message: e.message || "Booking failed" }); } finally { setLoading(false); }
  };

  /* ===== EDIT ===== */
  const initiateEdit = (b) => { setEditingId(b.id); setEditStart(b.start_time); setEditEnd(b.end_time); setError(""); };
  const cancelEdit = () => { setEditingId(null); setEditStart(""); setEditEnd(""); setError(""); };

  const showRescheduleConfirm = () => {
    setError("");
    if (!editStart || !editEnd) return setError("Select both times");
    const sM = editStart.includes(":") && !editStart.includes("M") ? parseInt(editStart.split(":")[0]) * 60 + parseInt(editStart.split(":")[1]) : ampmToMinutes(editStart);
    const eM = editEnd.includes(":") && !editEnd.includes("M") ? parseInt(editEnd.split(":")[0]) * 60 + parseInt(editEnd.split(":")[1]) : ampmToMinutes(editEnd);
    if (eM <= sM) return setError("End must be after start");
    if (!isSlotFree(editStart, editEnd, editingId)) return setError("Slot not available");
    const b = dayBookings.find((x) => x.id === editingId); const room = rooms.find((r) => r.id === b.room_id);
    setRescheduleModal({ isOpen: true, data: { id: editingId, room: room?.room_name || "Unknown", roomNumber: room?.room_number || "", date: b.booking_date, oldStart: b.start_time.includes("M") ? b.start_time : dbToAmPm(b.start_time), oldEnd: b.end_time.includes("M") ? b.end_time : dbToAmPm(b.end_time), newStart: editStart.includes("M") ? editStart : toAmPmStrict(editStart), newEnd: editEnd.includes("M") ? editEnd : toAmPmStrict(editEnd) } });
  };

  const confirmReschedule = async () => {
    const { id } = rescheduleModal.data; setRescheduleModal({ isOpen: false, data: null }); setLoading(true);
    try {
      await apiFetch(`/api/conference/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ start_time: editStart.includes("M") ? editStart : toAmPmStrict(editStart), end_time: editEnd.includes("M") ? editEnd : toAmPmStrict(editEnd) }) });
      setResultModal({ isOpen: true, type: "success", message: "Booking updated!" }); setEditingId(null); setEditStart(""); setEditEnd(""); loadAll();
    } catch (e) { setResultModal({ isOpen: true, type: "error", message: e.message || "Update failed" }); } finally { setLoading(false); }
  };

  /* ===== CANCEL ===== */
  const initiateCancellation = (b) => {
    const room = rooms.find((r) => r.id === b.room_id);
    setCancelModal({ isOpen: true, data: { id: b.id, room: room?.room_name || "Unknown", roomNumber: room?.room_number || "", date: b.booking_date, startTime: b.start_time.includes("M") ? b.start_time : dbToAmPm(b.start_time), endTime: b.end_time.includes("M") ? b.end_time : dbToAmPm(b.end_time), department: b.department } });
  };

  const confirmCancellation = async () => {
    const { id } = cancelModal.data; setCancelModal({ isOpen: false, data: null }); setLoading(true);
    try { await apiFetch(`/api/conference/bookings/${id}/cancel`, { method: "PATCH" }); setResultModal({ isOpen: true, type: "success", message: "Booking cancelled!" }); loadAll(); }
    catch { setResultModal({ isOpen: true, type: "error", message: "Cancel failed" }); } finally { setLoading(false); }
  };

  if (!company) return <div className={styles.container}><div className={styles.loadingState}>Loading…</div></div>;

  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          {company.logo_url && <img src={company.logo_url} alt="Logo" className={styles.companyLogo} />}
          <button className={styles.backBtn} onClick={() => router.push("/conference/dashboard")}>← Back</button>
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Book <span>Conference Room</span></h1>
          <p className={styles.heroSub}>Select room, date, and time to create a booking</p>
        </section>

        {/* ===== PLAN BLOCKED ===== */}
        {planBlocked && <div className={styles.blockedMsg}>🚫 Booking not allowed. Upgrade plan to continue.</div>}

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>
          <div className={styles.layoutGrid}>

            {/* ── LEFT: Booking Form ── */}
            <div className={styles.formCard}>
              <div className={styles.sectionHeader}>
                <span className={styles.cardDot} />
                <h3 className={styles.cardTitle}>New Booking</h3>
              </div>

              {error && <div className={styles.errorBox}>{error}</div>}

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Date *</label>
                <input type="date" value={date} min={today} disabled={planBlocked} onChange={(e) => setDate(e.target.value)} className={styles.input} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Room * {plan && `(${rooms.length} available)`}</label>
                <select className={styles.input} value={roomId} disabled={planBlocked} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Select a room</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_name}</option>)}
                </select>
              </div>

              <TimeScroller value={startTime} onChange={setStartTime} label="Start Time *" disabled={planBlocked || !roomId || !date} excludedSlots={blockedSlots} currentDate={date} today={today} />
              <TimeScroller value={endTime} onChange={setEndTime} label="End Time *" minTime={startTime} disabled={planBlocked || !startTime} excludedSlots={blockedSlots} currentDate={date} today={today} />

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Department *</label>
                <input value={department} disabled={planBlocked} onChange={(e) => setDepartment(e.target.value)} className={styles.input} placeholder="e.g., Engineering" />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Purpose (Optional)</label>
                <input value={purpose} disabled={planBlocked} onChange={(e) => setPurpose(e.target.value)} className={styles.input} placeholder="e.g., Team Meeting" />
              </div>

              <button disabled={planBlocked || loading} onClick={initiateBooking} className={styles.bookBtn}>
                {loading ? "Processing…" : "Book Room"}
              </button>
            </div>

            {/* ── RIGHT: Day Bookings ── */}
            <div className={styles.bookingsCard}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.cardDot} ${styles.cardDotGreen}`} />
                <h3 className={styles.cardTitle}>Bookings for {date}</h3>
                <span className={styles.cardCount}>{dayBookings.length}</span>
              </div>

              {!roomId || !date ? (
                <div className={styles.emptyState}><span className={styles.emptyIcon}>📅</span>Select room & date to view bookings</div>
              ) : dayBookings.length === 0 ? (
                <div className={styles.emptyState}><span className={styles.emptyIcon}>✨</span>No bookings for this date</div>
              ) : (
                <div className={styles.bkList}>
                  {dayBookings.map((b) => {
                    const blocked = getBlockedExcluding(b.id);
                    return (
                      <div key={b.id} className={styles.bkItem}>
                        {editingId === b.id ? (
                          <>
                            <div className={styles.bkEditTitle}>Reschedule</div>
                            <p className={styles.bkDept}>{b.department}</p>
                            <TimeScroller value={editStart} onChange={setEditStart} label="New Start" excludedSlots={blocked} currentDate={normalizeDate(b.booking_date)} today={today} />
                            <TimeScroller value={editEnd} onChange={setEditEnd} label="New End" minTime={editStart} excludedSlots={blocked} currentDate={normalizeDate(b.booking_date)} today={today} />
                            <div className={styles.bkActions}>
                              <button className={styles.saveBk} onClick={showRescheduleConfirm}>Save</button>
                              <button className={styles.cancelEditBk} onClick={cancelEdit}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.bkTime}>🕒 <b>{b.start_time.includes("M") ? b.start_time : dbToAmPm(b.start_time)} – {b.end_time.includes("M") ? b.end_time : dbToAmPm(b.end_time)}</b></div>
                            <p className={styles.bkDept}>{b.department}{b.purpose && ` • ${b.purpose}`}</p>
                            <p className={styles.bkBy}>👤 {b.booked_by}</p>
                            <div className={styles.bkActions}>
                              <button className={styles.editBk} onClick={() => initiateEdit(b)}>Reschedule</button>
                              <button className={styles.cancelBk} onClick={() => initiateCancellation(b)}>Cancel</button>
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
        </main>
      </div>

      {/* ===== MODALS ===== */}
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, data: null })} title="Confirm Booking" type="info">
        {confirmModal.data && (<>
          <div className={styles.mInfo}><p><b>Room:</b> {confirmModal.data.room} {confirmModal.data.roomNumber && `(#${confirmModal.data.roomNumber})`}</p><p><b>Date:</b> {confirmModal.data.date}</p><p><b>Time:</b> {confirmModal.data.startTime} – {confirmModal.data.endTime}</p><p><b>Dept:</b> {confirmModal.data.department}</p><p><b>Purpose:</b> {confirmModal.data.purpose}</p></div>
          <div className={styles.mActions}><button className={styles.mPrimary} onClick={confirmBooking} disabled={loading}>{loading ? "Booking…" : "Confirm"}</button><button className={styles.mSecondary} onClick={() => setConfirmModal({ isOpen: false, data: null })} disabled={loading}>Cancel</button></div>
        </>)}
      </Modal>

      <Modal isOpen={rescheduleModal.isOpen} onClose={() => setRescheduleModal({ isOpen: false, data: null })} title="Confirm Reschedule" type="warning">
        {rescheduleModal.data && (<>
          <div className={styles.mInfo}><p><b>Room:</b> {rescheduleModal.data.room}</p><p><b>Date:</b> {rescheduleModal.data.date}</p>
            <div className={styles.timeCompare}><div className={styles.timeOld}><small>Current</small><span>{rescheduleModal.data.oldStart} – {rescheduleModal.data.oldEnd}</span></div><div className={styles.timeArrow}>→</div><div className={styles.timeNew}><small>New</small><span>{rescheduleModal.data.newStart} – {rescheduleModal.data.newEnd}</span></div></div>
          </div>
          <div className={styles.mActions}><button className={styles.mPrimary} onClick={confirmReschedule} disabled={loading}>{loading ? "Updating…" : "Confirm"}</button><button className={styles.mSecondary} onClick={() => setRescheduleModal({ isOpen: false, data: null })} disabled={loading}>Cancel</button></div>
        </>)}
      </Modal>

      <Modal isOpen={cancelModal.isOpen} onClose={() => setCancelModal({ isOpen: false, data: null })} title="Cancel Booking" type="error">
        {cancelModal.data && (<>
          <div className={styles.mInfo}><p className={styles.mWarn}>Are you sure you want to cancel?</p><p><b>Room:</b> {cancelModal.data.room}</p><p><b>Date:</b> {cancelModal.data.date}</p><p><b>Time:</b> {cancelModal.data.startTime} – {cancelModal.data.endTime}</p></div>
          <div className={styles.mActions}><button className={styles.mDanger} onClick={confirmCancellation} disabled={loading}>{loading ? "Cancelling…" : "Yes, Cancel"}</button><button className={styles.mSecondary} onClick={() => setCancelModal({ isOpen: false, data: null })} disabled={loading}>Keep</button></div>
        </>)}
      </Modal>

      <Modal isOpen={resultModal.isOpen} onClose={() => setResultModal({ isOpen: false, type: "", message: "" })} title={resultModal.type === "success" ? "Success" : "Error"} type={resultModal.type}>
        <div className={styles.mInfo}><p>{resultModal.message}</p></div>
        <div className={styles.mActions}><button className={styles.mPrimary} onClick={() => setResultModal({ isOpen: false, type: "", message: "" })}>Close</button></div>
      </Modal>
    </div>
  );
}
