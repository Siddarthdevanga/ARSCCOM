"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
   ENHANCED TOAST NOTIFICATION
====================================================== */
const Toast = ({ message, type = "info", isVisible, onHide }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onHide, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case "success": return "✅";
      case "error": return "❌";
      case "warning": return "⚠️";
      case "info": return "ℹ️";
      default: return "ℹ️";
    }
  };

  return (
    <div className={`${styles.toast} ${styles[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`]} ${isVisible ? styles.toastVisible : ''}`}>
      <span className={styles.toastIcon}>{getIcon()}</span>
      <span className={styles.toastMessage}>{message}</span>
      <button className={styles.toastClose} onClick={onHide}>×</button>
    </div>
  );
};

/* ======================================================
   MODAL COMPONENT WITH BETTER ACCESSIBILITY
====================================================== */
const Modal = ({ isOpen, onClose, title, children, type = "info", size = "medium" }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      setTimeout(() => {
        const focusableElement = modalRef.current?.querySelector('button, input, select');
        focusableElement?.focus();
      }, 100);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "ℹ️";
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        ref={modalRef}
        className={`${styles.modal} ${styles[`modal${size.charAt(0).toUpperCase() + size.slice(1)}`]}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={`${styles.modalHeader} ${styles[`modal${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
          <span className={styles.modalIcon}>{getIcon()}</span>
          <h3 id="modal-title">{title}</h3>
          <button 
            className={styles.modalClose} 
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ======================================================
   TIME SCROLLER WITH IMPROVED UX
====================================================== */
const TimeScroller = ({ value, onChange, label, minTime = null, disabled = false, currentDate = null, today = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollContainerRef = useRef(null);
  const dropdownRef = useRef(null);

  const getCurrentMinutes = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return Math.ceil(currentMinutes / 15) * 15;
  };

  const filteredOptions = useMemo(() => {
    let options = TIME_OPTIONS;

    if (currentDate === today && !minTime) {
      const nowMinutes = getCurrentMinutes();
      options = options.filter(t => t.minutes >= nowMinutes);
    }

    if (minTime) {
      const minMinutes = ampmToMinutes(minTime);
      options = options.filter(t => t.minutes > minMinutes);
    }

    return options;
  }, [minTime, currentDate, today]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current && value) {
      const selectedIndex = filteredOptions.findIndex(t => t.value === value);
      if (selectedIndex !== -1) {
        const itemHeight = 40;
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

  const handleKeyDown = (e, timeValue) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(timeValue);
    }
  };

  return (
    <div className={styles.timeScroller} ref={dropdownRef}>
      <label>{label} {!disabled && <span className={styles.required}>*</span>}</label>
      <div 
        className={`${styles.timeInput} ${disabled ? styles.timeInputDisabled : ''} ${isOpen ? styles.timeInputOpen : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label={`${label}. Current value: ${value || 'Not selected'}`}
      >
        <span className={value ? styles.timeSelected : styles.timePlaceholder}>
          {value || "Select time"}
        </span>
        <span className={styles.timeIcon}>🕒</span>
      </div>

      {isOpen && (
        <div className={styles.timeDropdown}>
          <div className={styles.timeDropdownHeader}>
            <span>Select {label}</span>
            <button onClick={() => setIsOpen(false)} aria-label="Close time picker">×</button>
          </div>
          <div 
            className={styles.timeList} 
            ref={scrollContainerRef}
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <div className={styles.timeOptionEmpty}>No available times</div>
            ) : (
              filteredOptions.map(time => (
                <div
                  key={time.value}
                  className={`${styles.timeOption} ${value === time.value ? styles.timeOptionSelected : ""}`}
                  onClick={() => handleSelect(time.value)}
                  onKeyDown={(e) => handleKeyDown(e, time.value)}
                  role="option"
                  tabIndex={0}
                  aria-selected={value === time.value}
                >
                  {time.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ======================================================
   PUBLIC CALENDAR GRID — Google Calendar vertical style
====================================================== */
const PUB_PALETTE = [
  "#7c3aed","#0891b2","#059669","#d97706","#dc2626","#9333ea","#0284c7","#16a34a",
];

function PublicCalendarGrid({ rooms, scrollContainerRef, dayBookings }) {
  const HOUR_H  = 60;
  const START_H = 7;
  const END_H   = 22;
  const ROOM_W  = 110;
  const TIME_W  = 48;
  const totalH  = (END_H - START_H) * HOUR_H;
  const hours   = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

  const toMin = (t) => { if (!t) return 0; const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
  const fmt   = (t) => { if (!t) return ""; const [h, m] = String(t).split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };

  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const nowMin = nowIST.getHours() * 60 + nowIST.getMinutes();
  const nowTop = ((nowMin - START_H * 60) / 60) * HOUR_H;
  const nowH   = nowIST.getHours();

  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (!popup) return;
    const handler = () => setPopup(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [popup]);

  useEffect(() => {
    if (scrollContainerRef?.current) {
      scrollContainerRef.current.scrollTop = Math.max(0, nowTop - 80);
    }
  }, [nowTop, scrollContainerRef]);

  return (
    <>
    <div style={{ minWidth: TIME_W + rooms.length * ROOM_W }}>
      {/* Sticky room name header */}
      <div style={{ display:"flex", borderBottom:"2px solid #e5e7eb", background:"#fafafa",
        position:"sticky", top:0, zIndex:10 }}>
        <div style={{ width:TIME_W, flexShrink:0 }} />
        {rooms.map((r, i) => (
          <div key={r.id} style={{ width:ROOM_W, flexShrink:0, padding:"0.5rem 0.35rem",
            borderLeft:"1px solid #e5e7eb", textAlign:"center",
            borderTop:`3px solid ${PUB_PALETTE[i % PUB_PALETTE.length]}` }}>
            <div style={{ fontSize:"0.68rem", fontWeight:800, color:"#1f2937",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.room_name}</div>
            <div style={{ fontSize:"0.58rem", color:"#9ca3af" }}>#{r.room_number}</div>
          </div>
        ))}
      </div>

      {/* Body — parent container handles both-axis scroll */}
      <div>
        <div style={{ display:"flex", position:"relative" }}>
          {/* Time labels */}
          <div style={{ width:TIME_W, flexShrink:0 }}>
            {hours.map(h => (
              <div key={h} style={{ height:HOUR_H, display:"flex", alignItems:"flex-start",
                paddingTop:4, paddingRight:6, justifyContent:"flex-end", boxSizing:"border-box" }}>
                <span style={{ fontSize:"0.58rem", fontWeight: h===nowH ? 800 : 400,
                  color: h===nowH ? "#7c3aed" : "#9ca3af", whiteSpace:"nowrap" }}>
                  {h===12?"12 PM":h<12?`${h} AM`:`${h-12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Room columns */}
          {rooms.map((room, ri) => {
            const color = PUB_PALETTE[ri % PUB_PALETTE.length];
            return (
              <div key={room.id} style={{ width:ROOM_W, flexShrink:0, position:"relative",
                borderLeft:"1px solid #e5e7eb", height:totalH }}>
                {hours.map(h => (
                  <div key={h} style={{ position:"absolute", top:(h-START_H)*HOUR_H, left:0, right:0,
                    height:HOUR_H, borderBottom:"1px solid #f3f4f6",
                    background: h===nowH ? `${color}0a` : h%2===0 ? "#fafafa" : "#fff" }} />
                ))}
                {nowTop >= 0 && nowTop <= totalH && (
                  <div style={{ position:"absolute", top:nowTop, left:0, right:0,
                    height:2, background:"#ef4444", zIndex:5, display:"flex", alignItems:"center" }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:"#ef4444", marginLeft:-3, flexShrink:0 }} />
                  </div>
                )}
                {(dayBookings ? (dayBookings[room.id] || []) : (room.today_bookings || [])).map((b, bi) => {
                  const sMin = toMin(b.start_time), eMin = toMin(b.end_time);
                  const top  = Math.max(0, ((sMin-START_H*60)/60)*HOUR_H);
                  const ht   = Math.max(18, ((eMin-sMin)/60)*HOUR_H - 2);
                  const past = eMin < nowMin;
                  return (
                    <div key={bi}
                      onClick={(e) => { e.stopPropagation(); setPopup({ booking:b, roomName:room.room_name, color, x:e.clientX, y:e.clientY }); }}
                      style={{ position:"absolute", top, left:2, right:2, height:ht,
                        background:past?`${color}99`:color, borderRadius:5,
                        padding:"2px 4px", overflow:"hidden", zIndex:3,
                        opacity: past ? 0.6 : 1, cursor:"pointer" }}>
                      <div style={{ fontSize:"0.56rem", color:"#fff", fontWeight:700,
                        lineHeight:1.3, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                        {fmt(b.start_time)}
                      </div>
                      {ht > 28 && (
                        <div style={{ fontSize:"0.54rem", color:"rgba(255,255,255,0.85)",
                          overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                          {b.booked_by || "Booked"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {popup && (() => {
      const b = popup.booking;
      return (
        <div onClick={e => e.stopPropagation()}
          style={{ position:"fixed", top: Math.min(popup.y + 8, window.innerHeight - 270),
            left: Math.min(popup.x + 8, window.innerWidth - 250),
            width:240, background:"#fff", borderRadius:"0.75rem",
            boxShadow:"0 8px 32px rgba(0,0,0,0.18)", zIndex:9999, overflow:"hidden" }}>
          <div style={{ background:popup.color, padding:"0.625rem 0.875rem",
            display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontWeight:800, fontSize:"0.8rem", color:"#fff" }}>{popup.roomName}</div>
              <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.85)", marginTop:2 }}>
                {fmt(b.start_time)} – {fmt(b.end_time)}
              </div>
            </div>
            <button onClick={() => setPopup(null)}
              style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff",
                borderRadius:"50%", width:20, height:20, cursor:"pointer", fontSize:"0.8rem",
                display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
          <div style={{ padding:"0.625rem 0.875rem", fontSize:"0.75rem", color:"#374151" }}>
            <div style={{ marginBottom:"0.35rem" }}>
              <span style={{ color:"#9ca3af", fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Booked By</span>
              <div style={{ fontWeight:700, color:"#1f2937", marginTop:1 }}>{b.booked_by || "—"}</div>
              {b.booked_by_email && b.booked_by_email !== b.booked_by && (
                <div style={{ fontSize:"0.62rem", color:"#6b7280", marginTop:1 }}>{b.booked_by_email}</div>
              )}
            </div>
            {b.department && (
              <div style={{ marginBottom:"0.35rem" }}>
                <span style={{ color:"#9ca3af", fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Department</span>
                <div style={{ marginTop:1 }}>{b.department}</div>
              </div>
            )}
            {b.purpose && (
              <div style={{ marginBottom:"0.35rem" }}>
                <span style={{ color:"#9ca3af", fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Purpose</span>
                <div style={{ marginTop:1 }}>{b.purpose}</div>
              </div>
            )}
            {b.team_members?.length > 0 && (
              <div>
                <span style={{ color:"#9ca3af", fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Team</span>
                <div style={{ marginTop:3, display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
                  {b.team_members.map((m, i) => (
                    <span key={i} style={{ background:"#ede9fe", color:"#7c3aed", borderRadius:99,
                      padding:"2px 7px", fontSize:"0.6rem", fontWeight:700 }}>{m.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    })()}
    </>
  );
}

/* Wrapper that owns scroll ref + view state + week/month data */
function CalendarScrollWrapper({ rooms, slug }) {
  const scrollRef = useRef(null);
  const todayIST = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), []);

  const [calView, setCalView] = useState("day");
  const [calDate, setCalDate] = useState(todayIST);
  const [rangeBookings, setRangeBookings] = useState(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [dayPopup, setDayPopup] = useState(null);

  const fmt = (t) => { if (!t) return ""; const [h, m] = String(t).split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };

  const getWeekDates = (ds) => {
    const d = new Date(ds + "T12:00:00"); const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({length:7}, (_, i) => { const dt = new Date(mon); dt.setDate(mon.getDate() + i); return dt.toLocaleDateString("en-CA"); });
  };
  const getMonthCells = (ds) => {
    const [y, m] = ds.split("-").map(Number);
    const first = new Date(y, m-1, 1); const last = new Date(y, m, 0);
    const pad = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const cells = Array(pad).fill(null);
    for (let dd = 1; dd <= last.getDate(); dd++) cells.push(`${y}-${String(m).padStart(2,"0")}-${String(dd).padStart(2,"0")}`);
    return cells;
  };
  const navigate = (dir) => {
    if (calView === "day") {
      const d = new Date(calDate + "T12:00:00"); d.setDate(d.getDate() + dir); setCalDate(d.toLocaleDateString("en-CA"));
    } else if (calView === "week") {
      const d = new Date(calDate + "T12:00:00"); d.setDate(d.getDate() + 7 * dir); setCalDate(d.toLocaleDateString("en-CA"));
    } else {
      const [y, m] = calDate.split("-").map(Number); const nm = m + dir;
      const ny = y + Math.floor((nm - 1) / 12); const am = ((nm - 1 + 120) % 12) + 1;
      setCalDate(`${ny}-${String(am).padStart(2,"0")}-01`);
    }
  };

  const weekDates  = useMemo(() => calView === "week"  ? getWeekDates(calDate)  : [], [calView, calDate]);
  const monthCells = useMemo(() => calView === "month" ? getMonthCells(calDate) : [], [calView, calDate]);

  const headerLabel = useMemo(() => {
    if (calView === "day") {
      const d = new Date(calDate + "T12:00:00");
      return d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric", year:"numeric" });
    }
    if (calView === "week") {
      const wk = getWeekDates(calDate);
      const f = new Date(wk[0] + "T12:00:00"), l = new Date(wk[6] + "T12:00:00");
      return `${f.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${l.toLocaleDateString("en-US",{month:"short",day:"numeric"})}, ${l.getFullYear()}`;
    }
    const [y, m] = calDate.split("-").map(Number);
    return new Date(y, m-1, 1).toLocaleDateString("en-US", { month:"long", year:"numeric" });
  }, [calView, calDate]);

  useEffect(() => {
    if (calView === "day" && calDate === todayIST) { setRangeBookings(null); return; }
    const [start, end] = calView === "week"
      ? (() => { const wk = getWeekDates(calDate); return [wk[0], wk[6]]; })()
      : calView === "month"
        ? (() => { const c = getMonthCells(calDate).filter(Boolean); return [c[0], c[c.length-1]]; })()
        : [calDate, calDate];
    if (!start || !end) return;
    setRangeLoading(true);
    fetch(`${API}/api/public/conference/company/${slug}/rooms/bookings/range?start_date=${start}&end_date=${end}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const byDate = {};
        const byRoom = {};
        data.forEach(b => {
          if (!byDate[b.booking_date]) byDate[b.booking_date] = [];
          byDate[b.booking_date].push(b);
          if (!byRoom[b.room_id]) byRoom[b.room_id] = [];
          byRoom[b.room_id].push(b);
        });
        setRangeBookings({ byDate, byRoom });
      })
      .catch(() => setRangeBookings(null))
      .finally(() => setRangeLoading(false));
  }, [calView, calDate, slug, todayIST]);

  useEffect(() => {
    if (!dayPopup) return;
    const handler = () => setDayPopup(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [dayPopup]);

  const dayViewBookings = useMemo(() => {
    if (calView !== "day" || !rangeBookings) return null;
    return rangeBookings.byRoom;
  }, [calView, rangeBookings]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* View controls */}
      <div style={{ padding:"0.4rem 0.75rem", borderBottom:"1px solid #f3f4f6",
        background:"linear-gradient(135deg,#7c3aed,#a78bfa)",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.3rem", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.25rem" }}>
          {["day","week","month"].map(v => (
            <button key={v} onClick={() => setCalView(v)}
              style={{ padding:"0.15rem 0.45rem", borderRadius:99, fontSize:"0.62rem", fontWeight:700, cursor:"pointer", border:"none",
                background: calView === v ? "#fff" : "rgba(255,255,255,0.18)",
                color: calView === v ? "#7c3aed" : "#fff" }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"0.2rem" }}>
          <button onClick={() => navigate(-1)} style={{ background:"rgba(255,255,255,0.18)", border:"none", color:"#fff", borderRadius:99, width:22, height:22, cursor:"pointer", fontSize:"0.9rem", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
          <span style={{ fontSize:"0.6rem", fontWeight:700, color:"#fff", minWidth:80, textAlign:"center" }}>{headerLabel}</span>
          <button onClick={() => navigate(1)} style={{ background:"rgba(255,255,255,0.18)", border:"none", color:"#fff", borderRadius:99, width:22, height:22, cursor:"pointer", fontSize:"0.9rem", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          {(calView !== "day" || calDate !== todayIST) && (
            <button onClick={() => { setCalDate(todayIST); setCalView("day"); }}
              style={{ padding:"0.15rem 0.4rem", borderRadius:99, fontSize:"0.6rem", fontWeight:700, cursor:"pointer", border:"none", background:"rgba(255,255,255,0.18)", color:"#fff" }}>
              Today
            </button>
          )}
          {calView === "month" ? (
            <input type="month" value={calDate.slice(0,7)} onChange={e => setCalDate(e.target.value + "-01")}
              style={{ fontSize:"0.58rem", borderRadius:5, border:"1px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.15)", color:"#fff", padding:"0.1rem 0.2rem", cursor:"pointer" }} />
          ) : (
            <input type="date" value={calDate} onChange={e => e.target.value && setCalDate(e.target.value)}
              style={{ fontSize:"0.58rem", borderRadius:5, border:"1px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.15)", color:"#fff", padding:"0.1rem 0.2rem", cursor:"pointer" }} />
          )}
        </div>
      </div>

      {rangeLoading && (
        <div style={{ padding:"0.75rem", textAlign:"center", fontSize:"0.7rem", color:"#9ca3af" }}>Loading…</div>
      )}

      {/* Day view */}
      {calView === "day" && !rangeLoading && (
        <div ref={scrollRef} style={{ flex:1, overflow:"auto", WebkitOverflowScrolling:"touch" }}>
          <PublicCalendarGrid rooms={rooms} scrollContainerRef={scrollRef} dayBookings={dayViewBookings} />
        </div>
      )}

      {/* Week view */}
      {calView === "week" && !rangeLoading && (
        <div style={{ flex:1, overflowY:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:`repeat(7, minmax(80px, 1fr))` }}>
            {weekDates.map((d, di) => {
              const dateObj = new Date(d + "T12:00:00");
              const dayBks = rangeBookings?.byDate?.[d] || [];
              const isTd = d === todayIST;
              return (
                <div key={d}
                  onClick={(e) => { e.stopPropagation(); setDayPopup({ date:d, bookings:dayBks, x:e.clientX, y:e.clientY }); }}
                  style={{ padding:"0.5rem 0.4rem", borderLeft: di > 0 ? "1px solid #f3f4f6" : "none", borderBottom:"1px solid #f3f4f6",
                    cursor:"pointer", minHeight:110, background: isTd ? "#f5f3ff" : "#fff" }}
                  onMouseEnter={e => !isTd && (e.currentTarget.style.background="#fafafa")}
                  onMouseLeave={e => !isTd && (e.currentTarget.style.background="#fff")}>
                  <div style={{ fontSize:"0.56rem", color: isTd ? "#7c3aed" : "#9ca3af", fontWeight:700, textTransform:"uppercase" }}>
                    {dateObj.toLocaleDateString("en-US",{weekday:"short"})}
                  </div>
                  <div style={{ fontSize:"0.9rem", fontWeight:800, color: isTd ? "#7c3aed" : "#1f2937", marginBottom:"0.2rem" }}>{dateObj.getDate()}</div>
                  {dayBks.length === 0
                    ? <div style={{ fontSize:"0.55rem", color:"#d1d5db" }}>–</div>
                    : <>
                        <div style={{ fontSize:"0.58rem", fontWeight:700, color:"#7c3aed", marginBottom:"0.15rem" }}>{dayBks.length} bk.</div>
                        {dayBks.slice(0,3).map((b, i) => {
                          const rIdx = rooms.findIndex(r => r.id === b.room_id);
                          const color = PUB_PALETTE[rIdx >= 0 ? rIdx % PUB_PALETTE.length : 0];
                          return (
                            <div key={i} style={{ fontSize:"0.53rem", color:"#374151", marginBottom:2, padding:"1px 3px", borderLeft:`2px solid ${color}`, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {fmt(b.start_time)}
                            </div>
                          );
                        })}
                        {dayBks.length > 3 && <div style={{ fontSize:"0.5rem", color:"#9ca3af" }}>+{dayBks.length-3}</div>}
                      </>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month view */}
      {calView === "month" && !rangeLoading && (() => {
        const fmt2 = (t) => { if (!t) return ""; const [h, m] = String(t).split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };
        const MAX_CHIPS = 2;
        return (
          <div style={{ flex:1, overflowY:"auto", padding:"0.4rem", overscrollBehavior:"contain" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", marginBottom:"0.3rem" }}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                <div key={i} style={{ textAlign:"center", fontSize:"0.6rem", fontWeight:700, color:"#7c3aed", letterSpacing:"0.04em" }}>{d}</div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:3 }}>
              {monthCells.map((d, idx) => {
                if (!d) return <div key={idx} />;
                const isTd   = d === todayIST;
                const dayBks = rangeBookings?.byDate?.[d] || [];
                const shown  = dayBks.slice(0, MAX_CHIPS);
                const extra  = dayBks.length - MAX_CHIPS;
                return (
                  <div key={d}
                    onClick={(e) => { e.stopPropagation(); setDayPopup({ date:d, bookings:dayBks, x:e.clientX, y:e.clientY }); }}
                    style={{ padding:"0.3rem 0.28rem", borderRadius:"0.5rem", minHeight:72, cursor:"pointer",
                      background: isTd ? "#f5f3ff" : "#fff",
                      border:`1.5px solid ${isTd ? "#a78bfa" : "#e5e7eb"}`,
                      boxShadow: dayBks.length > 0 ? "0 1px 4px rgba(124,58,237,0.06)" : "none",
                      transition:"background 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = isTd ? "#ede9fe" : "#f5f3ff"; e.currentTarget.style.borderColor = "#a78bfa"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isTd ? "#f5f3ff" : "#fff"; e.currentTarget.style.borderColor = isTd ? "#a78bfa" : "#e5e7eb"; }}>
                    {/* Date number */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{
                        fontSize:"0.68rem", fontWeight: isTd ? 800 : 600,
                        color: isTd ? "#fff" : "#374151",
                        background: isTd ? "#7c3aed" : "transparent",
                        borderRadius:"50%", width:18, height:18,
                        display:"flex", alignItems:"center", justifyContent:"center"
                      }}>{parseInt(d.split("-")[2])}</span>
                      {dayBks.length > 0 && (
                        <span style={{ fontSize:"0.48rem", fontWeight:700, color:"#7c3aed", background:"#ede9fe", borderRadius:99, padding:"1px 4px" }}>
                          {dayBks.length}
                        </span>
                      )}
                    </div>
                    {/* Booking chips */}
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      {shown.map((b, bi) => {
                        const rIdx = rooms.findIndex(r => r.id === b.room_id);
                        const col  = PUB_PALETTE[rIdx >= 0 ? rIdx % PUB_PALETTE.length : 0];
                        return (
                          <div key={bi} style={{
                            background: col, color:"#fff",
                            borderRadius:3, padding:"1px 4px",
                            fontSize:"0.48rem", fontWeight:700,
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                            lineHeight:"1.5"
                          }}>
                            {rooms.find(r=>r.id===b.room_id)?.room_name || "Room"} · {fmt2(b.start_time)}
                          </div>
                        );
                      })}
                      {extra > 0 && (
                        <div style={{ fontSize:"0.46rem", color:"#7c3aed", fontWeight:700, paddingLeft:2 }}>
                          +{extra} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Day summary popup (week/month cell click) */}
      {dayPopup && (() => {
        const fmt2 = (t) => { if (!t) return ""; const [h, m] = String(t).split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };
        const dl = new Date(dayPopup.date + "T12:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
        return (
          <div onClick={e => e.stopPropagation()}
            style={{ position:"fixed", top: Math.min(dayPopup.y + 8, window.innerHeight - 320), left: Math.min(dayPopup.x + 8, window.innerWidth - 260),
              width:252, background:"#fff", borderRadius:"0.75rem", boxShadow:"0 8px 32px rgba(0,0,0,0.2)", zIndex:9999, overflow:"hidden" }}>
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#a78bfa)", padding:"0.625rem 0.875rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:800, fontSize:"0.8rem", color:"#fff" }}>{dl}</div>
                <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.85)", marginTop:1 }}>{dayPopup.bookings.length} booking{dayPopup.bookings.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => setDayPopup(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"50%", width:20, height:20, cursor:"pointer", fontSize:"0.8rem", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ maxHeight:260, overflowY:"auto" }}>
              {dayPopup.bookings.length === 0
                ? <div style={{ padding:"1rem", textAlign:"center", color:"#9ca3af", fontSize:"0.7rem" }}>No bookings</div>
                : dayPopup.bookings.map((b, i) => {
                    const rIdx = rooms.findIndex(r => r.id === b.room_id);
                    const color = PUB_PALETTE[rIdx >= 0 ? rIdx % PUB_PALETTE.length : 0];
                    return (
                      <div key={i} style={{ padding:"0.5rem 0.875rem", borderBottom:"1px solid #f3f4f6", borderLeft:`3px solid ${color}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ fontWeight:700, fontSize:"0.72rem", color:"#1f2937" }}>
                            {rooms.find(r=>r.id===b.room_id)?.room_name || "Room"}
                          </div>
                          <div style={{ fontSize:"0.6rem", color:"#7c3aed", fontWeight:700 }}>{fmt2(b.start_time)}–{fmt2(b.end_time)}</div>
                        </div>
                        <div style={{ fontSize:"0.65rem", color:"#374151", marginTop:2, fontWeight:600 }}>{b.booked_by}</div>
                        {b.booked_by_email && b.booked_by_email !== b.booked_by && (
                          <div style={{ fontSize:"0.6rem", color:"#6b7280" }}>{b.booked_by_email}</div>
                        )}
                        {b.department && <div style={{ fontSize:"0.6rem", color:"#9ca3af", marginTop:1 }}>{b.department}</div>}
                        {b.purpose && <div style={{ fontSize:"0.6rem", color:"#6b7280", marginTop:1 }}>"{b.purpose}"</div>}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ======================================================
   PUBLIC ROOM CARD
====================================================== */
const prettyTimePub = (t = "") => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
};

function PublicRoomCard({ room, onSelect, nowMinutes = 0 }) {
  const toMin = (t) => { const [h, m] = String(t||"0:0").split(":").map(Number); return h*60+(m||0); };
  return (
    <div
      onClick={() => onSelect(room)}
      style={{
        borderRadius:"0.875rem", border:"1.5px solid #7c3aed",
        background:"#fff", overflow:"hidden", cursor:"pointer",
        boxShadow:"0 2px 12px rgba(124,58,237,0.08)",
        transition:"transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(124,58,237,0.15)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 2px 12px rgba(124,58,237,0.08)"; }}
    >
      {/* 16:9 image */}
      <div style={{ width:"100%", aspectRatio:"16/9", background:"#ede9fe", position:"relative",
        overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {room.image_url
          ? <img src={room.image_url} alt={room.room_name}
              style={{ width:"100%", height:"100%", objectFit:"cover", position:"absolute", inset:0 }} />
          : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.3rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
              </svg>
              <span style={{ fontSize:"1rem", fontWeight:800, color:"#7c3aed" }}>
                {room.room_name.charAt(0).toUpperCase()}
              </span>
            </div>
        }
      </div>

      <div style={{ padding:"0.875rem" }}>
        <div style={{ fontWeight:700, fontSize:"0.9rem", color:"#1f2937", marginBottom:"0.25rem" }}>
          {room.room_name}
        </div>
        {room.capacity && (
          <div style={{ fontSize:"0.78rem", color:"#6b7280", marginBottom:"0.5rem", display:"flex", alignItems:"center", gap:"0.5rem", flexWrap:"wrap" }}>
            <span style={{ display:"flex", alignItems:"center", gap:"0.3rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              {room.capacity} people
            </span>
            {room.total_bookings > 0 && (
              <>
                <span style={{ color:"#d1d5db" }}>·</span>
                <span style={{ display:"flex", alignItems:"center", gap:"0.25rem" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {room.total_bookings} bookings
                </span>
              </>
            )}
          </div>
        )}

        {room.today_bookings?.length > 0 && (
          <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:"0.5rem" }}>
            <div style={{ fontSize:"0.67rem", fontWeight:700, color:"#9ca3af",
              textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"0.3rem" }}>
              Today&apos;s Schedule
            </div>
            {[...room.today_bookings].sort((a,b)=>a.start_time.localeCompare(b.start_time)).map((b, i) => {
              const ended = toMin(b.end_time) <= nowMinutes;
              return (
                <div key={i} style={{ fontSize:"0.72rem", marginBottom:"0.2rem",
                  color: ended ? "#9ca3af" : "#374151", opacity: ended ? 0.6 : 1 }}>
                  <span style={{ fontWeight:600, textDecoration: ended ? "line-through" : "none" }}>
                    {prettyTimePub(b.start_time)} – {prettyTimePub(b.end_time)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop:"0.75rem", width:"100%", padding:"0.45rem",
          background:"#7c3aed", color:"#fff",
          borderRadius:"0.5rem", fontSize:"0.8rem", fontWeight:600, textAlign:"center" }}>
          Select Room
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   GREETING HELPER
====================================================== */
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
};

/* ======================================================
   MAIN COMPONENT
====================================================== */
export default function PublicConferenceBooking() {
  const { slug } = useParams();

  const today = new Date().toISOString().split("T")[0];

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
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

  const [teamMembers, setTeamMembers]         = useState([]);
  const [memberSearch, setMemberSearch]       = useState("");
  const [memberResults, setMemberResults]     = useState([]);
  const [memberSearching, setMemberSearching] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [formErrors, setFormErrors] = useState({});

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, data: null });
  const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, data: null });
  const [cancelModal, setCancelModal] = useState({ isOpen: false, data: null });
  const [resultModal, setResultModal] = useState({ isOpen: false, type: "", message: "" });

  // Range booking
  const [bookingMode,         setBookingMode]         = useState("single"); // "single" | "range"
  const [rangeEndDate,        setRangeEndDate]        = useState("");
  const [includeWeekends,     setIncludeWeekends]     = useState(false);
  const [rangeResult,         setRangeResult]         = useState(null);
  const [rangeSubmitting,     setRangeSubmitting]     = useState(false);
  const [rangeConfirmPreview, setRangeConfirmPreview] = useState(null);

  /* ================= ENHANCED TOAST MANAGEMENT ================= */
  const showToast = useCallback((message, type = "info") => {
    setToast({ show: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ show: false, message: "", type: "info" });
  }, []);

  /* ================= FORM VALIDATION ================= */
  const validateForm = () => {
    const errors = {};

    if (!roomId) errors.roomId = "Please select a room";
    if (!date) errors.date = "Please select a date";
    if (!startTime) errors.startTime = "Please select start time";
    if (!endTime) errors.endTime = "Please select end time";
    if (!purpose || !purpose.trim()) errors.purpose = "Please enter a purpose";

    if (startTime && endTime && ampmToMinutes(endTime) <= ampmToMinutes(startTime)) {
      errors.endTime = "End time must be after start time";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ================= API ERROR HANDLER ================= */
  const handleApiError = async (response, defaultMessage) => {
    try {
      const data = await response.json();
      
      if (response.status === 403 && data.code) {
        switch (data.code) {
          case "SUBSCRIPTION_EXPIRED":
          case "TRIAL_EXPIRED":
            showToast("Service temporarily unavailable. Please contact the organization.", "info");
            break;
          case "BOOKING_LIMIT_REACHED":
          case "ROOM_LIMIT_REACHED":
            showToast("Booking unavailable at this time. Please try again later or contact support.", "warning");
            break;
          default:
            showToast(data.message || defaultMessage, "error");
        }
        return;
      }

      showToast(data.message || defaultMessage, "error");
    } catch {
      showToast(defaultMessage, "error");
    }
  };

  /* ================= COMPANY DATA ================= */
  useEffect(() => {
    const loadCompany = async () => {
      try {
        const response = await fetch(`${API}/api/public/conference/company/${slug}`);
        
        if (!response.ok) {
          await handleApiError(response, "Invalid booking link");
          return;
        }

        const data = await response.json();
        setCompany({
          id: data.id,
          name: data.name,
          logo_url: data.logo_url
        });
        
        console.log("[COMPANY_LOADED]", data.name);
      } catch (error) {
        console.error("[COMPANY_ERROR]", error);
        showToast("Failed to load company information", "error");
      }
    };

    loadCompany();
  }, [slug]);

  /* ================= ROOMS DATA ================= */
  const loadRooms = useCallback(async () => {
    if (!company) return;
    try {
      const response = await fetch(`${API}/api/public/conference/company/${slug}/rooms`);
      if (!response.ok) {
        if (response.status === 403) showToast("Some features may be limited. Contact your organization if you need assistance.", "info");
        setRooms([]); return;
      }
      const data = await response.json();
      setRooms(data || []);
    } catch { setRooms([]); }
  }, [company, slug]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  /* ================= BOOKINGS DATA ================= */
  const loadBookings = useCallback(async (overrideRoomId) => {
    const effectiveRoomId = overrideRoomId || roomId;
    if (!effectiveRoomId || !date) {
      setBookings([]);
      return;
    }

    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings?roomId=${effectiveRoomId}&date=${date}&userEmail=${email || ""}`
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to load bookings");
        return;
      }

      const data = await response.json();
      const formattedBookings = (Array.isArray(data) ? data : []).map(b => ({
        ...b,
        start_time: dbToAmPm(b.start_time),
        end_time: dbToAmPm(b.end_time)
      }));

      setBookings(formattedBookings);
      console.log("[BOOKINGS_LOADED]", formattedBookings.length, "bookings");
    } catch (error) {
      console.error("[BOOKINGS_ERROR]", error);
      setBookings([]);
    }
  }, [roomId, date, slug, email]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings, otpVerified]);

  // Auto-refresh rooms (cards + calendar) and bookings every 60 seconds
  useEffect(() => {
    if (!otpVerified) return;
    const timer = setInterval(() => {
      loadRooms();
      loadBookings();
    }, 60000);
    return () => clearInterval(timer);
  }, [otpVerified, loadRooms, loadBookings]);

  /* ================= TIME VALIDATION ================= */
  useEffect(() => {
    if (date === today && startTime) {
      const nowMinutes = Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15;
      const startMinutes = ampmToMinutes(startTime);
      
      if (startMinutes < nowMinutes) {
        setStartTime("");
        setEndTime("");
        showToast("Selected time has passed. Please choose a future time.", "warning");
      }
    }
  }, [date, today, startTime]);

  /* ================= SLOT VALIDATION ================= */
  const isSlotFree = useCallback((s, e, ignore = null) =>
    !bookings.some(
      b =>
        b.id !== ignore &&
        ampmToMinutes(b.start_time) < ampmToMinutes(e) &&
        ampmToMinutes(b.end_time) > ampmToMinutes(s)
    ), [bookings]);

  /* ================= AUTH FUNCTIONS ================= */
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
    setFormErrors({});
    hideToast();
    showToast("Logged out successfully", "info");
  };

  /* ================= OTP FUNCTIONS ================= */
  const sendOtp = async () => {
    if (!email.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    setLoading(true);
    hideToast();

    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      showToast("OTP sent to your email", "success");
      setResendTimer(30);
    } catch (error) {
      console.error("[OTP_SEND_ERROR]", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resendTimer) return;
    const timer = setInterval(() => setResendTimer(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  /* ===== TEAM MEMBER SEARCH ===== */
  useEffect(() => {
    if (!memberSearch.trim() || !slug) { setMemberResults([]); return; }
    const timer = setTimeout(async () => {
      setMemberSearching(true);
      try {
        const res = await fetch(`${API}/api/public/conference/company/${slug}/employees/search?q=${encodeURIComponent(memberSearch)}`);
        const data = await res.json();
        setMemberResults(Array.isArray(data) ? data.filter(e => !teamMembers.some(m => m.id === e.id)) : []);
      } catch { setMemberResults([]); }
      finally { setMemberSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch, slug, teamMembers]);

  const addMember  = (emp) => { setTeamMembers(prev => [...prev, emp]); setMemberSearch(""); setMemberResults([]); };
  const removeMember = (id) => setTeamMembers(prev => prev.filter(m => m.id !== id));

  const resendOtp = async () => {
    hideToast();
    
    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to resend OTP");
        return;
      }

      showToast("OTP resent to your email", "success");
      setResendTimer(30);
    } catch (error) {
      console.error("[OTP_RESEND_ERROR]", error);
      showToast("Network error. Please try again.", "error");
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      showToast("Please enter the OTP", "error");
      return;
    }
    
    setLoading(true);
    hideToast();
    
    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Invalid or expired OTP");
        return;
      }

      setOtpVerified(true);
      showToast("Email verified successfully", "success");
      loadBookings();
    } catch (error) {
      console.error("[OTP_VERIFY_ERROR]", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ================= BOOKING FUNCTIONS ================= */
  const initiateBooking = () => {
    hideToast();
    
    if (!validateForm()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    if (!isSlotFree(startTime, endTime)) {
      showToast("Selected time slot conflicts with existing booking", "error");
      return;
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
      const response = await fetch(
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
            end_time: endTime,
            teamMembers
          })
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          const data = await response.json();
          if (data.code && (data.code.includes("SUBSCRIPTION") || data.code.includes("TRIAL") || data.code.includes("LIMIT"))) {
            setResultModal({
              isOpen: true,
              type: "error",
              message: "Booking is currently unavailable. Please contact your organization's administrator for assistance."
            });
            return;
          }
        }
        
        await handleApiError(response, "Booking failed");
        return;
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
      setTeamMembers([]);
      setMemberSearch("");
      setFormErrors({});
      setSelectedRoom(null);
      setRoomId("");

      // Refresh rooms so cards show the new booking, then reload bookings
      await loadRooms();
      loadBookings();
    } catch (error) {
      console.error("[BOOKING_ERROR]", error);
      setResultModal({
        isOpen: true,
        type: "error",
        message: "Network error occurred. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= RANGE BOOKING ================= */
  const confirmRangeBooking = () => {
    const errors = {};
    if (!roomId) errors.roomId = "Please select a room";
    if (!date) errors.date = "Please select a start date";
    if (!rangeEndDate) errors.rangeEndDate = "Please select an end date";
    if (rangeEndDate && rangeEndDate < date) errors.rangeEndDate = "End date must be on or after start date";
    if (!startTime) errors.startTime = "Please select start time";
    if (!endTime) errors.endTime = "Please select end time";
    if (!purpose?.trim()) errors.purpose = "Please enter a purpose";
    if (startTime && endTime && ampmToMinutes(endTime) <= ampmToMinutes(startTime)) {
      errors.endTime = "End time must be after start time";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const room = rooms.find(r => r.id === roomId);
    setRangeConfirmPreview({
      roomName:       room?.room_name || "Room",
      roomNumber:     room?.room_number || "",
      startDate:      date,
      endDate:        rangeEndDate,
      startTime,
      endTime,
      purpose:        purpose.trim(),
      department:     department.trim() || "—",
      includeWeekends,
      teamMembers,
    });
  };

  const submitRangeBooking = async () => {
    setRangeConfirmPreview(null);
    setRangeSubmitting(true);
    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/book-range`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: roomId,
            booked_by: email,
            department,
            purpose,
            start_date: date,
            end_date: rangeEndDate,
            start_time: startTime,
            end_time: endTime,
            include_weekends: includeWeekends,
            teamMembers,
          }),
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Range booking failed");
        return;
      }

      const data = await response.json();
      setRangeResult(data);
      setStartTime(""); setEndTime(""); setDepartment(""); setPurpose("");
      setTeamMembers([]); setMemberSearch(""); setFormErrors({});
      setRangeEndDate(""); setIncludeWeekends(false);
      setSelectedRoom(null); setRoomId("");
      await loadRooms(); loadBookings();
    } catch (err) {
      console.error("[RANGE_BOOKING_ERROR]", err);
      showToast("Network error. Please try again.", "error");
    } finally { setRangeSubmitting(false); }
  };

  /* ================= EDIT FUNCTIONS ================= */
  const initiateEdit = (booking) => {
    setEditingId(booking.id);
    setEditStart(booking.start_time);
    setEditEnd(booking.end_time);
    hideToast();
  };

  const showRescheduleConfirmation = () => {
    hideToast();
    
    if (!editStart || !editEnd) {
      showToast("Please select both start and end times", "error");
      return;
    }

    if (ampmToMinutes(editEnd) <= ampmToMinutes(editStart)) {
      showToast("End time must be after start time", "error");
      return;
    }

    if (!isSlotFree(editStart, editEnd, editingId)) {
      showToast("Selected time slot is not available", "error");
      return;
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
      const response = await fetch(
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

      if (!response.ok) {
        await handleApiError(response, "Failed to reschedule booking");
        return;
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
    } catch (error) {
      console.error("[RESCHEDULE_ERROR]", error);
      setResultModal({
        isOpen: true,
        type: "error",
        message: "Network error occurred. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
    hideToast();
  };

  /* ================= CANCEL FUNCTIONS ================= */
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
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${id}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      if (!response.ok) {
        await handleApiError(response, "Failed to cancel booking");
        return;
      }

      setResultModal({
        isOpen: true,
        type: "success",
        message: "Your booking has been cancelled successfully. A confirmation email has been sent to you."
      });

      loadBookings();
    } catch (error) {
      console.error("[CANCELLATION_ERROR]", error);
      setResultModal({
        isOpen: true,
        type: "error",
        message: "Network error occurred. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const extendBooking = async (bookingId, extraMinutes) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API}/api/public/conference/company/${slug}/bookings/${bookingId}/extend`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, extra_minutes: extraMinutes })
        }
      );
      if (!response.ok) { await handleApiError(response, "Could not extend booking"); return; }
      const data = await response.json().catch(() => null);
      const newEnd = data?.new_end_time ? (() => {
        const [h, m] = data.new_end_time.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      })() : "";
      showToast(newEnd ? `Extended +${extraMinutes} min — now ends at ${newEnd}` : `Meeting extended by ${extraMinutes} minutes`, "success");
      loadBookings();
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOADING STATE ================= */
  if (!company) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
      <p>Loading conference booking system...</p>
    </div>
  );

  return (
    <div className={styles.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      {/* Enhanced Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onHide={hideToast}
      />

      {/* ================= HEADER — matches SaaS nav bar ================= */}
      <header className={styles.header}>
        <div className={styles.headerContent} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%" }}>
          {/* Left: hamburger (after OTP) or logo */}
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
            {otpVerified ? (
              <button
                onClick={() => setShowSchedule(true)}
                title="Today's Schedule"
                style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:"0.5rem",
                  padding:"0.4rem 0.5rem", cursor:"pointer", display:"flex",
                  flexDirection:"column", gap:"4px", alignItems:"center", justifyContent:"center" }}>
                <span style={{ display:"block", width:18, height:2, background:"#374151", borderRadius:1 }} />
                <span style={{ display:"block", width:13, height:2, background:"#374151", borderRadius:1 }} />
                <span style={{ display:"block", width:18, height:2, background:"#374151", borderRadius:1 }} />
              </button>
            ) : (
              company.id && (
                <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`}
                  alt={`${company.name} logo`} className={styles.logo}
                  onError={e => { e.currentTarget.style.display = "none"; }} />
              )
            )}
            <div>
              <h1 style={{ margin:0, fontSize:"1rem", fontWeight:700 }}>{company.name}</h1>
              <span className={styles.subtitle}>Conference Booking</span>
            </div>
          </div>

          {/* Right: logout */}
          {otpVerified && (
            <button onClick={handleLogout}
              style={{ padding:"0.4rem 1.1rem", borderRadius:99, border:"none",
                background:"#7c3aed", color:"#fff", fontSize:"0.82rem", fontWeight:600,
                cursor:"pointer" }}>
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ── Today's Schedule Popup Modal — mobile-first ── */}
      {showSchedule && (
        <div style={{ position:"fixed", inset:0, zIndex:200,
          display:"flex", alignItems:"flex-end", justifyContent:"center",
          background:"rgba(0,0,0,0.5)", padding:"0" }}
          onClick={() => setShowSchedule(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width:"100%", maxWidth:"100vw",
              height:"90vh",
              background:"#fff", borderRadius:"1.25rem 1.25rem 0 0",
              display:"flex", flexDirection:"column",
              boxShadow:"0 -8px 40px rgba(0,0,0,0.2)",
              animation:"slideUp 0.25s ease",
            }}>
            {/* Modal header */}
            <div style={{ padding:"1rem 1.25rem", background:"linear-gradient(135deg,#7c3aed,#a78bfa)",
              borderRadius:"1.25rem 1.25rem 0 0", display:"flex", justifyContent:"space-between",
              alignItems:"center", flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:"1rem", color:"#fff" }}>Today&apos;s Schedule</div>
                <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.82)", marginTop:2 }}>
                  {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}
                </div>
              </div>
              <button onClick={() => setShowSchedule(false)}
                style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff",
                  borderRadius:"50%", width:32, height:32, cursor:"pointer",
                  fontSize:"1.2rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
                ×
              </button>
            </div>

            {/* Drag handle */}
            <div style={{ display:"flex", justifyContent:"center", padding:"0.5rem 0",
              flexShrink:0, borderBottom:"1px solid #f3f4f6" }}>
              <div style={{ width:40, height:4, borderRadius:99, background:"#d1d5db" }} />
            </div>

            {/* Calendar grid — both-axis scrollable */}
            <CalendarScrollWrapper rooms={rooms} slug={slug} />
          </div>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to   { transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Banner only shown before OTP verification */}
      {!otpVerified && (
        <div className={styles.heroBanner}>
          <div className={styles.heroBannerContent}>
            <div className={styles.heroBannerGreeting}>
              <span className={styles.heroBannerDot}></span>
              {getGreeting()}
            </div>
            <h2 className={styles.heroBannerTitle}>
              Welcome, <span>Let&apos;s Get This Meeting Rolling</span>
            </h2>
            <p className={styles.heroBannerSub}>
              Verify your email to start booking conference rooms
            </p>
          </div>
        </div>
      )}

      {/* ================= OTP VERIFICATION SECTION ================= */}
      {!otpVerified ? (
        <div className={styles.container}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2>Email Verification</h2>
              <p>Enter your email to receive a one-time password for booking confirmation</p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address <span className={styles.required}>*</span></label>
              <input
                id="email"
                type="email"
                value={email}
                placeholder="your.email@company.com"
                onChange={e => setEmail(e.target.value)}
                className={styles.input}
                disabled={otpSent}
                autoComplete="email"
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
                  <label htmlFor="otp">Enter OTP <span className={styles.required}>*</span></label>
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    placeholder="000000"
                    onChange={e => setOtp(e.target.value)}
                    className={styles.input}
                    maxLength={6}
                    autoComplete="one-time-code"
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
      ) : !selectedRoom ? (
        /* ── Room Selection Grid ── */
        <div style={{ maxWidth:960, margin:"0 auto", padding:"0.5rem 1rem 2rem" }}>

          {/* ── Sticky search bar ── */}
          <div style={{ position:"sticky", top:64, zIndex:30, background:"rgba(240,238,248,0.95)",
            backdropFilter:"blur(8px)", padding:"0.75rem 0", marginBottom:"0.875rem" }}>
            <div style={{ position:"relative", maxWidth:400 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search rooms…"
                style={{ width:"100%", padding:"0.55rem 0.875rem 0.55rem 2.25rem",
                  border:"1.5px solid #e5e7eb", borderRadius:"99px", fontSize:"0.875rem",
                  background:"#fff", outline:"none", boxSizing:"border-box",
                  boxShadow:"0 1px 8px rgba(124,58,237,0.08)" }}
                onFocus={e => e.target.style.borderColor="#7c3aed"}
                onBlur={e => e.target.style.borderColor="#e5e7eb"}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}
                  style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", color:"#9ca3af",
                    fontSize:"1rem", lineHeight:1, padding:2 }}>×</button>
              )}
            </div>
            {searchQuery && (
              <div style={{ fontSize:"0.75rem", color:"#6b7280", marginTop:"0.35rem", paddingLeft:4 }}>
                {rooms.filter(r => r.room_name.toLowerCase().includes(searchQuery.toLowerCase())).length} result{rooms.filter(r => r.room_name.toLowerCase().includes(searchQuery.toLowerCase())).length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* ── Room grid ── */}
          {(() => {
            const filtered = searchQuery
              ? rooms.filter(r => r.room_name.toLowerCase().includes(searchQuery.toLowerCase()))
              : rooms;
            return filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"3rem", color:"#9ca3af" }}>
                <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>🔍</div>
                <div style={{ fontWeight:600 }}>No rooms match &ldquo;{searchQuery}&rdquo;</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"1rem" }}>
                {filtered.map(room => (
                  <PublicRoomCard key={room.id} room={room}
                    nowMinutes={new Date().getHours()*60+new Date().getMinutes()}
                    onSelect={(r) => {
                      setSelectedRoom(r);
                      setSearchQuery("");
                      setRoomId(String(r.id));
                      loadBookings(r.id);
                    }} />
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className={styles.container}>
          {/* ── Room summary — full width above the grid ── */}
          <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb",
            overflow:"hidden", marginBottom:"1.25rem", display:"flex", alignItems:"center" }}>
            <div style={{ width:90, flexShrink:0, background:"#ede9fe", alignSelf:"stretch",
              display:"flex", alignItems:"center", justifyContent:"center", minHeight:72 }}>
              {selectedRoom.image_url
                ? <img src={selectedRoom.image_url} alt={selectedRoom.room_name}
                    style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
                  </svg>
              }
            </div>
            <div style={{ padding:"0.875rem", flex:1 }}>
              <div style={{ fontWeight:700, fontSize:"0.95rem", color:"#1f2937" }}>{selectedRoom.room_name}</div>
              <div style={{ fontSize:"0.78rem", color:"#6b7280", marginTop:"0.2rem" }}>
                {selectedRoom.capacity ? `${selectedRoom.capacity} people` : ""}
                {selectedRoom.room_number ? ` · Room #${selectedRoom.room_number}` : ""}
              </div>
            </div>
            <button onClick={() => { setSelectedRoom(null); setRoomId(""); }}
              style={{ margin:"0 1rem", padding:"0.4rem 1rem", borderRadius:99,
                border:"1.5px solid #7c3aed", background:"#fff", color:"#7c3aed",
                fontSize:"0.8rem", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
              ← Rooms
            </button>
          </div>

          <div className={styles.layout}>
            {/* ================= BOOKING FORM ================= */}
            <div className={styles.card}>
              <h2>Book a Conference Room</h2>

              {/* Booking mode toggle */}
              <div style={{ display:"flex", gap:"0.4rem", marginBottom:"1rem", background:"#f5f3ff",
                borderRadius:"0.625rem", padding:"0.25rem" }}>
                {["single","range"].map(mode => (
                  <button key={mode} onClick={() => { setBookingMode(mode); setFormErrors({}); }}
                    style={{ flex:1, padding:"0.45rem 0", border:"none", borderRadius:"0.45rem",
                      fontSize:"0.82rem", fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                      background: bookingMode === mode ? "#7c3aed" : "transparent",
                      color: bookingMode === mode ? "#fff" : "#7c3aed" }}>
                    {mode === "single" ? "Single Day" : "Date Range"}
                  </button>
                ))}
              </div>

              {bookingMode === "single" ? (
                <div className={styles.formGroup}>
                  <label htmlFor="date">Date <span className={styles.required}>*</span></label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    min={today}
                    onChange={e => setDate(e.target.value)}
                    className={`${styles.input} ${formErrors.date ? styles.inputError : ''}`}
                  />
                  {formErrors.date && <span className={styles.errorText}>{formErrors.date}</span>}
                </div>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label>Start Date <span className={styles.required}>*</span></label>
                    <input type="date" value={date} min={today}
                      onChange={e => { setDate(e.target.value); setRangeEndDate(""); }}
                      className={`${styles.input} ${formErrors.date ? styles.inputError : ''}`} />
                    {formErrors.date && <span className={styles.errorText}>{formErrors.date}</span>}
                  </div>
                  <div className={styles.formGroup}>
                    <label>End Date <span className={styles.required}>*</span></label>
                    <input type="date" value={rangeEndDate} min={date || today}
                      onChange={e => setRangeEndDate(e.target.value)}
                      className={`${styles.input} ${formErrors.rangeEndDate ? styles.inputError : ''}`} />
                    {formErrors.rangeEndDate && <span className={styles.errorText}>{formErrors.rangeEndDate}</span>}
                  </div>
                  <div className={styles.formGroup}>
                    <label style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer" }}>
                      <input type="checkbox" checked={includeWeekends}
                        onChange={e => setIncludeWeekends(e.target.checked)}
                        style={{ width:15, height:15, accentColor:"#7c3aed" }} />
                      Include weekends
                    </label>
                  </div>
                </>
              )}

              <div className={formErrors.startTime ? styles.formGroupError : styles.formGroup}>
                <TimeScroller
                  value={startTime}
                  onChange={setStartTime}
                  label="Start Time"
                  disabled={!roomId || !date}
                  currentDate={date}
                  today={today}
                />
                {formErrors.startTime && <span className={styles.errorText}>{formErrors.startTime}</span>}
              </div>

              <div className={formErrors.endTime ? styles.formGroupError : styles.formGroup}>
                <TimeScroller
                  value={endTime}
                  onChange={setEndTime}
                  label="End Time"
                  minTime={startTime}
                  disabled={!startTime}
                  currentDate={date}
                  today={today}
                />
                {formErrors.endTime && <span className={styles.errorText}>{formErrors.endTime}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="department">Department</label>
                <input
                  id="department"
                  type="text"
                  value={department}
                  placeholder="e.g., Engineering, Sales, Marketing"
                  onChange={e => setDepartment(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={formErrors.purpose ? styles.formGroupError : styles.formGroup}>
                <label htmlFor="purpose">Purpose <span style={{ color:"#ef4444" }}>*</span></label>
                <input
                  id="purpose"
                  type="text"
                  value={purpose}
                  placeholder="e.g., Team Meeting, Client Call, Training"
                  onChange={e => setPurpose(e.target.value)}
                  className={`${styles.input} ${formErrors.purpose ? styles.inputError : ""}`}
                />
                {formErrors.purpose && <span className={styles.errorText}>{formErrors.purpose}</span>}
              </div>

              {/* ── Team Members ── */}
              <div className={styles.formGroup}>
                <label>Team Members</label>
                <div className={styles.memberSearchWrap}>
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search by name or department…"
                    className={styles.input}
                  />
                  {memberSearching && (
                    <div className={styles.memberDropdown}>
                      <div className={styles.memberSearching}>Searching…</div>
                    </div>
                  )}
                  {!memberSearching && memberResults.length > 0 && (
                    <div className={styles.memberDropdown}>
                      {memberResults.map(e => (
                        <div key={e.id} className={styles.memberOption} onClick={() => addMember(e)}>
                          <span className={styles.memberName}>{e.name}</span>
                          {e.department && <span className={styles.memberDept}>{e.department}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {teamMembers.length > 0 && (
                  <div className={styles.memberChips}>
                    {teamMembers.map(m => (
                      <span key={m.id} className={styles.memberChip}>
                        {m.name}
                        <button className={styles.chipRemove} onClick={() => removeMember(m.id)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={bookingMode === "single" ? initiateBooking : confirmRangeBooking}
                disabled={loading || rangeSubmitting || !roomId || !date}
                className={styles.primaryBtn}
              >
                {(loading || rangeSubmitting) ? "Processing..." : bookingMode === "single" ? "Book Room" : "Book All Days"}
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
                  {bookings.map(b => {
                    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone:"Asia/Kolkata" }));
                    const nowMins = nowIST.getHours() * 60 + nowIST.getMinutes();
                    const bDate = b.booking_date?.split("T")[0] || b.booking_date;
                    const sMins = ampmToMinutes(b.start_time), eMins = ampmToMinutes(b.end_time);
                    const isInProgress = bDate === today && sMins <= nowMins && eMins > nowMins;
                    const isPast = !isInProgress && (bDate < today || (bDate === today && eMins <= nowMins));
                    return (
                    <div key={b.id} className={styles.bookingItem}
                      style={isPast ? { opacity:0.55, background:"#f9fafb", borderColor:"#e5e7eb" } :
                             isInProgress ? { borderColor:"#16a34a", boxShadow:"0 0 0 2px #bbf7d0" } : {}}>
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
                            currentDate={b.booking_date}
                            today={today}
                          />

                          <TimeScroller
                            value={editEnd}
                            onChange={setEditEnd}
                            label="New End Time"
                            minTime={editStart}
                            currentDate={b.booking_date}
                            today={today}
                          />

                          <div className={styles.bookingActions}>
                            <button 
                              onClick={showRescheduleConfirmation}
                              className={styles.primaryBtn}
                              disabled={loading}
                            >
                              {loading ? "Saving..." : "Save Changes"}
                            </button>
                            <button 
                              onClick={cancelEdit}
                              className={styles.secondaryBtn}
                              disabled={loading}
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
                            {isInProgress ? (
                              <span style={{ display:"flex", alignItems:"center", gap:"0.3rem",
                                fontSize:"0.68rem", background:"#dcfce7", color:"#15803d",
                                borderRadius:99, padding:"2px 8px", fontWeight:700 }}>
                                <span style={{ width:6, height:6, borderRadius:"50%", background:"#16a34a",
                                  display:"inline-block", animation:"pulse 1.5s infinite" }} />
                                In Progress
                              </span>
                            ) : b.can_modify && (
                              <span className={styles.bookingBadge}>Your Booking</span>
                            )}
                          </div>

                          <div className={styles.bookingDetails}>
                            <p><strong>Department:</strong> {b.department}</p>
                            {b.purpose && <p><strong>Purpose:</strong> {b.purpose}</p>}
                            <p className={styles.bookedBy}>
                              <span>👤</span> {b.booked_by}
                            </p>
                          </div>

                          {isInProgress && b.can_modify && (
                            <div style={{ marginTop:"0.5rem" }}>
                              <div style={{ fontSize:"0.7rem", fontWeight:700, color:"#15803d", marginBottom:"0.3rem" }}>
                                Extend meeting
                              </div>
                              <div style={{ display:"flex", gap:"0.4rem" }}>
                                {[15, 30, 60].map(mins => (
                                  <button key={mins} onClick={() => extendBooking(b.id, mins)}
                                    disabled={loading}
                                    style={{ flex:1, padding:"0.35rem 0", background:"#16a34a", color:"#fff",
                                      border:"none", borderRadius:"0.4rem", fontSize:"0.75rem",
                                      fontWeight:700, cursor:"pointer", boxShadow:"0 1px 4px rgba(22,163,74,0.35)" }}>
                                    +{mins}m
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {!isInProgress && b.can_modify && (
                            <div className={styles.bookingActions}>
                              <button
                                onClick={() => !isPast && initiateEdit(b)}
                                className={styles.editBtn}
                                disabled={loading || isPast}
                                style={isPast ? { opacity:0.45, cursor:"not-allowed", pointerEvents:"none" } : {}}
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => !isPast && initiateCancellation(b)}
                                className={styles.cancelBtn}
                                disabled={loading || isPast}
                                style={isPast ? { opacity:0.45, cursor:"not-allowed", pointerEvents:"none" } : {}}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {isPast && (
                            <div style={{ marginTop:"0.4rem", fontSize:"0.7rem", fontWeight:700,
                              color:"#9ca3af", letterSpacing:"0.3px" }}>
                              This booking has ended
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    );
                  })}
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
              {teamMembers.length > 0 && <p><strong>Team:</strong> {teamMembers.map(m => m.name).join(", ")}</p>}
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

      {/* Range Confirm Modal */}
      {rangeConfirmPreview && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setRangeConfirmPreview(null)}>
          <div style={{ background:"#fff", borderRadius:"1rem", width:"100%", maxWidth:420,
            overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#a78bfa)", padding:"1.25rem 1.5rem" }}>
              <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"1px",
                textTransform:"uppercase", color:"rgba(255,255,255,0.7)", marginBottom:4 }}>Confirm Range Booking</div>
              <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#fff" }}>{rangeConfirmPreview.roomName}</div>
              {rangeConfirmPreview.roomNumber && (
                <div style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.8)", marginTop:2 }}>Room #{rangeConfirmPreview.roomNumber}</div>
              )}
            </div>
            <div style={{ padding:"1.25rem 1.5rem" }}>
              {[
                ["Date Range",  `${rangeConfirmPreview.startDate} → ${rangeConfirmPreview.endDate}`],
                ["Weekends",    rangeConfirmPreview.includeWeekends ? "Included" : "Excluded"],
                ["Time",        `${rangeConfirmPreview.startTime} – ${rangeConfirmPreview.endTime}`],
                ["Purpose",     rangeConfirmPreview.purpose],
                ["Department",  rangeConfirmPreview.department],
                ...(rangeConfirmPreview.teamMembers.length > 0
                  ? [["Team", rangeConfirmPreview.teamMembers.map(m => m.name).join(", ")]]
                  : []),
              ].map(([label, value]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  padding:"0.5rem 0", borderBottom:"1px solid #f3f4f6", fontSize:"0.83rem" }}>
                  <span style={{ color:"#6b7280", fontWeight:600 }}>{label}</span>
                  <span style={{ color:"#111827", fontWeight:700, textAlign:"right", maxWidth:"60%" }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ padding:"0 1.5rem 1.25rem", display:"flex", gap:"0.75rem" }}>
              <button onClick={() => setRangeConfirmPreview(null)}
                style={{ flex:1, padding:"0.7rem", borderRadius:"0.625rem", border:"1px solid #d1d5db",
                  background:"#fff", color:"#374151", fontSize:"0.875rem", fontWeight:700, cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={submitRangeBooking} disabled={rangeSubmitting}
                style={{ flex:2, padding:"0.7rem", borderRadius:"0.625rem", border:"none",
                  background: rangeSubmitting ? "#a78bfa" : "#7c3aed", color:"#fff",
                  fontSize:"0.875rem", fontWeight:700, cursor: rangeSubmitting ? "not-allowed" : "pointer" }}>
                {rangeSubmitting ? "Booking…" : "Book All Days"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Range Result Modal */}
      {rangeResult && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setRangeResult(null)}>
          <div style={{ background:"#fff", borderRadius:"1rem", width:"100%", maxWidth:440,
            overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#a78bfa)", padding:"1.25rem 1.5rem" }}>
              <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"1px",
                textTransform:"uppercase", color:"rgba(255,255,255,0.7)", marginBottom:4 }}>Range Booking Result</div>
              <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#fff" }}>
                {rangeResult.total_booked} booked · {rangeResult.total_skipped} skipped
              </div>
            </div>
            <div style={{ padding:"1.25rem 1.5rem", maxHeight:340, overflowY:"auto" }}>
              {rangeResult.booked?.length > 0 && (
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#15803d", marginBottom:"0.4rem" }}>
                    Booked ({rangeResult.booked.length})
                  </div>
                  {rangeResult.booked.map(b => (
                    <div key={b.id} style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                      padding:"0.35rem 0", borderBottom:"1px solid #f0fdf4", fontSize:"0.82rem" }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:"#16a34a", flexShrink:0 }} />
                      <span style={{ color:"#166534" }}>{b.date}</span>
                    </div>
                  ))}
                </div>
              )}
              {rangeResult.skipped?.length > 0 && (
                <div>
                  <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#b91c1c", marginBottom:"0.4rem" }}>
                    Skipped ({rangeResult.skipped.length})
                  </div>
                  {rangeResult.skipped.map((b, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                      padding:"0.35rem 0", borderBottom:"1px solid #fef2f2", fontSize:"0.82rem" }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444", flexShrink:0 }} />
                      <span style={{ color:"#991b1b" }}>{b.date}</span>
                      <span style={{ color:"#9ca3af", fontSize:"0.75rem", marginLeft:"auto" }}>{b.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding:"0 1.5rem 1.25rem" }}>
              <button onClick={() => setRangeResult(null)}
                style={{ width:"100%", padding:"0.7rem", borderRadius:"0.625rem", border:"none",
                  background:"#7c3aed", color:"#fff", fontSize:"0.875rem", fontWeight:700, cursor:"pointer" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
