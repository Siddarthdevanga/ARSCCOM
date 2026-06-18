"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/* ── Time helpers ── */
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const totalMinutes = i * 15;
  const h = Math.floor(totalMinutes / 60), m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM", hour = h % 12 || 12;
  return { label: `${hour}:${String(m).padStart(2,"0")} ${ampm}`, value: `${hour}:${String(m).padStart(2,"0")} ${ampm}`, minutes: totalMinutes };
});

const ampmToMinutes = (str) => {
  if (!str) return 0;
  const [time, suffix] = str.split(" "); let [h, m] = time.split(":").map(Number);
  if (suffix === "PM" && h !== 12) h += 12; if (suffix === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const prettyTime = (t = "") => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
};

/* ── SVG Icons ── */
const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconBuilding = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
  </svg>
);

const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

/* ── Room Card ── */
function RoomCard({ room, onSelect, nowMinutes = 0 }) {
  const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
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
      <div style={{ width:"100%", aspectRatio:"16/9", background:"#ede9fe", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {room.image_url
          ? <img src={room.image_url} alt={room.room_name}
              style={{ width:"100%", height:"100%", objectFit:"cover", position:"absolute", inset:0 }} />
          : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.4rem" }}>
              <IconBuilding />
              <span style={{ fontSize:"1.1rem", fontWeight:800, color:"#7c3aed", letterSpacing:1 }}>
                {room.room_name.charAt(0).toUpperCase()}
              </span>
            </div>
        }
      </div>
      <div style={{ padding:"0.875rem" }}>
        <div style={{ fontWeight:700, fontSize:"0.95rem", color:"#1f2937", marginBottom:"0.3rem" }}>{room.room_name}</div>
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", color:"#6b7280", fontSize:"0.8rem", marginBottom:"0.625rem", flexWrap:"wrap" }}>
          <span style={{ display:"flex", alignItems:"center", gap:"0.3rem" }}>
            <IconUsers />{room.capacity ? `${room.capacity} people` : "Capacity N/A"}
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
        {room.today_bookings?.length > 0 && (
          <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:"0.5rem" }}>
            <div style={{ fontSize:"0.68rem", fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"0.35rem" }}>Today&apos;s Schedule</div>
            {[...room.today_bookings].sort((a,b) => a.start_time.localeCompare(b.start_time)).map((b, i) => {
              const ended = toMin(b.end_time) <= nowMinutes;
              return (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"0.35rem",
                  fontSize:"0.75rem", color: ended ? "#9ca3af" : "#374151",
                  marginBottom:"0.25rem", opacity: ended ? 0.6 : 1 }}>
                  <IconClock />
                  <div>
                    <span style={{ fontWeight:600, textDecoration: ended ? "line-through" : "none" }}>
                      {prettyTime(b.start_time)} – {prettyTime(b.end_time)}
                    </span>
                    <div style={{ color:"#9ca3af", fontSize:"0.7rem" }}>{b.booked_by}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button style={{ marginTop:"0.75rem", width:"100%", padding:"0.5rem",
          background:"#7c3aed", color:"#fff", border:"none", borderRadius:"0.5rem",
          fontSize:"0.82rem", fontWeight:600, cursor:"pointer", display:"flex",
          alignItems:"center", justifyContent:"center", gap:"0.35rem" }}>
          Select Room <IconArrow />
        </button>
      </div>
    </div>
  );
}

/* ── Time Picker Dropdown ── */
function TimePicker({ value, onChange, label, minMinutes = null, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const opts = useMemo(() => TIME_OPTIONS.filter(o =>
    minMinutes === null ? true : o.minutes > minMinutes
  ), [minMinutes]);

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button type="button" onClick={() => !disabled && setOpen(p => !p)}
        style={{ width:"100%", padding:"0.65rem 0.875rem", border:"1px solid #d1d5db",
          borderRadius:"0.5rem", background: disabled ? "#f9fafb" : "#fff",
          color: value ? "#1f2937" : "#9ca3af", fontSize:"0.875rem",
          cursor: disabled ? "not-allowed" : "pointer", textAlign:"left",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        {value || label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, marginTop:4,
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:"0.5rem",
          boxShadow:"0 4px 16px rgba(0,0,0,0.1)", maxHeight:220, overflowY:"auto" }}>
          {opts.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ width:"100%", padding:"0.5rem 0.875rem", border:"none",
                background: value === o.value ? "#ede9fe" : "none",
                color: value === o.value ? "#7c3aed" : "#374151",
                fontSize:"0.875rem", cursor:"pointer", textAlign:"left",
                fontWeight: value === o.value ? 600 : 400 }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Employee Search Field ── */
function EmployeeSearch({ label, selected, onSelect, onClear, placeholder = "Search by name or email…" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setResults([]); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch(`/api/conference/employees/search?q=${encodeURIComponent(query)}`);
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (selected) {
    return (
      <div>
        <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#374151", marginBottom:"0.35rem" }}>{label}</label>
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.55rem 0.875rem",
          border:"1px solid #7c3aed", borderRadius:"0.5rem", background:"#f5f3ff" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:"0.875rem", color:"#1f2937" }}>{selected.name}</div>
            <div style={{ fontSize:"0.75rem", color:"#6b7280" }}>{selected.email}{selected.department ? ` · ${selected.department}` : ""}</div>
          </div>
          <button onClick={onClear} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", fontSize:"1rem", lineHeight:1 }}>×</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#374151", marginBottom:"0.35rem" }}>{label}</label>
      <div style={{ position:"relative" }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder}
          style={{ width:"100%", padding:"0.65rem 0.875rem", border:"1px solid #d1d5db",
            borderRadius:"0.5rem", fontSize:"0.875rem", boxSizing:"border-box" }} />
        {searching && <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, marginTop:4,
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:"0.5rem",
          boxShadow:"0 4px 16px rgba(0,0,0,0.1)", padding:"0.75rem", fontSize:"0.82rem", color:"#6b7280" }}>
          Searching…
        </div>}
        {!searching && results.length > 0 && (
          <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, marginTop:4,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:"0.5rem",
            boxShadow:"0 4px 16px rgba(0,0,0,0.1)", maxHeight:200, overflowY:"auto" }}>
            {results.map(emp => (
              <div key={emp.id} onClick={() => { onSelect(emp); setQuery(""); setResults([]); }}
                style={{ padding:"0.5rem 0.875rem", cursor:"pointer", borderBottom:"1px solid #f3f4f6" }}
                onMouseEnter={e => e.currentTarget.style.background="#f5f3ff"}
                onMouseLeave={e => e.currentTarget.style.background="none"}>
                <div style={{ fontWeight:600, fontSize:"0.875rem", color:"#1f2937" }}>{emp.name}</div>
                <div style={{ fontSize:"0.75rem", color:"#6b7280" }}>{emp.email}{emp.department ? ` · ${emp.department}` : ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function ConferenceBookPage() {
  const router = useRouter();
  const [company, setCompany]   = useState(null);
  const [rooms,   setRooms]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [step,    setStep]      = useState(1);
  const [selected, setSelected] = useState(null);

  // Booking form
  const [bookingDate, setBookingDate] = useState("");
  const [startTime,   setStartTime]   = useState("");
  const [endTime,     setEndTime]     = useState("");
  const [purpose,     setPurpose]     = useState("");
  const [department,  setDepartment]  = useState("");
  const [formError,    setFormError]    = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [extendMsg, setExtendMsg] = useState("");
  const [confirmPreview, setConfirmPreview] = useState(null);

  // Range booking
  const [bookingMode,       setBookingMode]       = useState("single"); // "single" | "range"
  const [rangeEndDate,      setRangeEndDate]      = useState("");
  const [includeWeekends,   setIncludeWeekends]   = useState(false);
  const [rangeResult,       setRangeResult]       = useState(null);
  const [rangeSubmitting,   setRangeSubmitting]   = useState(false);
  const [rangeConfirmPreview, setRangeConfirmPreview] = useState(null);

  // Book on behalf of
  const [onBehalfOf, setOnBehalfOf] = useState(null);

  // Team members
  const [teamMembers,    setTeamMembers]    = useState([]);
  const [memberSearch,   setMemberSearch]   = useState("");
  const [memberResults,  setMemberResults]  = useState([]);
  const [memberSearching,setMemberSearching]= useState(false);
  const memberRef = useRef(null);

  // Room schedule sidebar
  const [roomSchedule,    setRoomSchedule]    = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleDate,    setScheduleDate]    = useState(""); // date currently shown in right panel
  const [rangeBookings,   setRangeBookings]   = useState([]); // grouped range bookings for left panel
  const [rangeLoading,    setRangeLoading]    = useState(false);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // booking
  const [rsDate,  setRsDate]  = useState("");
  const [rsRoom,  setRsRoom]  = useState("");
  const [rsStart, setRsStart] = useState("");
  const [rsEnd,   setRsEnd]   = useState("");
  const [rsError, setRsError] = useState("");
  const [rsSaving,setRsSaving]= useState(false);
  const [rsScope, setRsScope] = useState("single"); // "single" | "range"

  // Cancel modal
  const [cancelTarget,  setCancelTarget]  = useState(null);
  const [cancelSaving,  setCancelSaving]  = useState(false);
  const [cancelScope,   setCancelScope]   = useState("single"); // "single" | "range"

  // Range scope picker (shown before cancel/reschedule when booking has range_booking_id)
  const [scopePicker,        setScopePicker]        = useState(null); // { booking, action: "cancel"|"reschedule" }
  const [scopeRangeUpcoming, setScopeRangeUpcoming] = useState(0);
  const [scopeLoading,       setScopeLoading]        = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const nowMinutes = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, []);

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Override the dashboard's :global(body){overflow:hidden} CSS
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const token  = localStorage.getItem("token");
    const stored = localStorage.getItem("company");
    if (!token || !stored) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/auth/login"); return; }
    setBookingDate(today);

    apiFetch("/api/conference/rooms")
      .then(data => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [router, today]);

  // Team member search
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    const t = setTimeout(async () => {
      setMemberSearching(true);
      try {
        const data = await apiFetch(`/api/conference/employees/search?q=${encodeURIComponent(memberSearch)}`);
        setMemberResults(Array.isArray(data) ? data.filter(e =>
          e.id !== onBehalfOf?.id && !teamMembers.some(m => m.id === e.id)
        ) : []);
      } catch { setMemberResults([]); } finally { setMemberSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch, teamMembers, onBehalfOf]);

  useEffect(() => {
    const handler = (e) => { if (memberRef.current && !memberRef.current.contains(e.target)) setMemberResults([]); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addMember = (emp) => { setTeamMembers(p => [...p, emp]); setMemberSearch(""); setMemberResults([]); };
  const removeMember = (id) => setTeamMembers(p => p.filter(m => m.id !== id));

  // Fetch today's bookings for selected room
  const loadRoomSchedule = (roomId, date) => {
    if (!roomId) return;
    const d = date || today;
    setScheduleDate(d);
    setScheduleLoading(true);
    apiFetch(`/api/conference/bookings?roomId=${roomId}&date=${d}`)
      .then(data => setRoomSchedule(Array.isArray(data) ? data.filter(b => b.status === "BOOKED") : []))
      .catch(() => setRoomSchedule([]))
      .finally(() => setScheduleLoading(false));
  };

  const loadRangeBookings = (roomId) => {
    if (!roomId) return;
    setRangeLoading(true);
    apiFetch(`/api/conference/bookings?roomId=${roomId}`)
      .then(data => {
        const all = Array.isArray(data) ? data : [];
        // Group by range_booking_id, only include groups with upcoming BOOKED days
        const groups = {};
        for (const b of all) {
          if (!b.range_booking_id || b.status !== "BOOKED") continue;
          if (!groups[b.range_booking_id]) groups[b.range_booking_id] = [];
          groups[b.range_booking_id].push(b);
        }
        const result = Object.entries(groups)
          .map(([rid, days]) => {
            const upcoming = days.filter(d => d.booking_date >= today).sort((a,b) => a.booking_date.localeCompare(b.booking_date));
            return { range_booking_id: rid, days: days.sort((a,b) => a.booking_date.localeCompare(b.booking_date)), upcoming };
          })
          .filter(g => g.upcoming.length > 0);
        setRangeBookings(result);
      })
      .catch(() => setRangeBookings([]))
      .finally(() => setRangeLoading(false));
  };

  useEffect(() => {
    if (selected) { loadRoomSchedule(selected.id); loadRangeBookings(selected.id); }
    else { setRoomSchedule([]); setRangeBookings([]); }
  }, [selected]);

  // Classify a booking relative to now
  const extendBooking = async (b, extraMinutes) => {
    try {
      const data = await apiFetch(`/api/conference/bookings/${b.id}/extend`, {
        method: "PATCH",
        body: JSON.stringify({ extra_minutes: extraMinutes }),
      });
      const newEnd = data?.new_end_time ? prettyTime(data.new_end_time) : "";
      const msg = newEnd
        ? `Extended +${extraMinutes} min — now ends at ${newEnd}`
        : `Extended by ${extraMinutes} minutes`;
      setExtendMsg(msg);
      setTimeout(() => setExtendMsg(""), 4000);
      loadRoomSchedule(selected.id, bookingDate || today); loadRangeBookings(selected.id);
    } catch (err) {
      setFormError(err?.message || "Could not extend booking");
    }
  };

  // Reload schedule when selected date changes
  useEffect(() => {
    if (selected && bookingDate) loadRoomSchedule(selected.id, bookingDate);
    else if (selected) loadRoomSchedule(selected.id, today);
  }, [bookingDate]);

  const classifyBooking = (b) => {
    const bDate = (b.booking_date || "").split("T")[0];
    if (bDate > today) return "upcoming";
    if (bDate < today) return "past";
    // Same day: use time comparison
    const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
    const s = toMin(b.start_time), e = toMin(b.end_time);
    if (e <= nowMinutes) return "past";
    if (s <= nowMinutes && e > nowMinutes) return "active";
    return "upcoming";
  };

  // Open scope picker if booking belongs to a range, otherwise go straight to modal
  const openScopePicker = async (b, action) => {
    if (!b.range_booking_id) {
      if (action === "cancel") { setCancelScope("single"); setCancelTarget(b); }
      else { setRsScope("single"); openRescheduleModal(b); }
      return;
    }
    // Today's slot already ended — skip scope picker, go straight to range action
    if (b._forceRange) {
      setScopeLoading(true);
      try {
        const data = await apiFetch(`/api/conference/bookings/range/${b.range_booking_id}`);
        setScopeRangeUpcoming(data.upcoming_count || 0);
      } catch { setScopeRangeUpcoming(0); }
      finally { setScopeLoading(false); }
      if (action === "cancel") { setCancelScope("range"); setCancelTarget(b); }
      else { setRsScope("range"); openRescheduleModal(b); }
      return;
    }
    setScopeLoading(true);
    setScopePicker({ booking: b, action });
    try {
      const data = await apiFetch(`/api/conference/bookings/range/${b.range_booking_id}`);
      setScopeRangeUpcoming(data.upcoming_count || 0);
    } catch { setScopeRangeUpcoming(0); }
    finally { setScopeLoading(false); }
  };

  const confirmScopeChoice = (scope) => {
    const { booking, action } = scopePicker;
    setScopePicker(null);
    if (action === "cancel") {
      setCancelScope(scope);
      setCancelTarget(booking);
    } else {
      setRsScope(scope);
      openRescheduleModal(booking);
    }
  };

  const openRescheduleModal = (b) => {
    setRescheduleTarget(b);
    setRsDate(b.booking_date?.split("T")[0] || today);
    setRsRoom(String(b.room_id));
    setRsStart("");
    setRsEnd("");
    setRsError("");
  };

  const confirmReschedule = async () => {
    if (!rsStart || !rsEnd) { setRsError("Select both start and end time"); return; }
    if (ampmToMinutes(rsEnd) <= ampmToMinutes(rsStart)) { setRsError("End must be after start"); return; }
    setRsError(""); setRsSaving(true);
    try {
      if (rsScope === "range" && rescheduleTarget.range_booking_id) {
        await apiFetch(`/api/conference/bookings/range/${rescheduleTarget.range_booking_id}/reschedule`, {
          method: "PATCH",
          body: JSON.stringify({ start_time: rsStart, end_time: rsEnd, room_id: Number(rsRoom) }),
        });
      } else {
        await apiFetch(`/api/conference/bookings/${rescheduleTarget.id}`, {
          method: "PATCH",
          body: JSON.stringify({ start_time: rsStart, end_time: rsEnd, booking_date: rsDate, room_id: Number(rsRoom) }),
        });
      }
      setRescheduleTarget(null);
      loadRoomSchedule(selected.id, bookingDate || today); loadRangeBookings(selected.id);
    } catch (err) { setRsError(err?.message || "Reschedule failed"); }
    finally { setRsSaving(false); }
  };

  const confirmCancel = async () => {
    setCancelSaving(true);
    try {
      if (cancelScope === "range" && cancelTarget.range_booking_id) {
        await apiFetch(`/api/conference/bookings/range/${cancelTarget.range_booking_id}/cancel`, { method: "PATCH" });
      } else {
        await apiFetch(`/api/conference/bookings/${cancelTarget.id}/cancel`, { method: "PATCH" });
      }
      setCancelTarget(null);
      loadRoomSchedule(selected.id, bookingDate || today); loadRangeBookings(selected.id);
    } catch { /* silent */ }
    finally { setCancelSaving(false); }
  };

  const startMinutes = useMemo(() => startTime ? ampmToMinutes(startTime) : null, [startTime]);

  const handleBook = () => {
    if (!bookingDate) { setFormError("Date is required"); return; }
    if (!startTime)   { setFormError("Start time is required"); return; }
    if (!endTime)     { setFormError("End time is required"); return; }
    if (ampmToMinutes(endTime) <= ampmToMinutes(startTime)) {
      setFormError("End time must be after start time"); return;
    }
    if (!purpose.trim()) { setFormError("Purpose is required"); return; }
    setFormError("");
    setConfirmPreview({
      room:       selected.room_name,
      roomNumber: selected.room_number,
      date:       bookingDate,
      startTime,
      endTime,
      bookedBy:   onBehalfOf ? `${onBehalfOf.name} (${onBehalfOf.email})` : "Admin",
      purpose:    purpose.trim(),
      department: department.trim() || "—",
      teamMembers,
    });
  };

  const handleConfirmBooking = async () => {
    setConfirmPreview(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/conference/bookings", {
        method: "POST",
        body: JSON.stringify({
          room_id:      selected.id,
          booked_by:    onBehalfOf?.email || "ADMIN",
          department:   department.trim() || undefined,
          purpose:      purpose.trim(),
          booking_date: bookingDate,
          start_time:   startTime,
          end_time:     endTime,
          teamMembers:  teamMembers.length > 0 ? teamMembers : undefined,
        }),
      });
      setStartTime(""); setEndTime(""); setPurpose(""); setDepartment("");
      setOnBehalfOf(null); setTeamMembers([]); setMemberSearch("");
      setBookingSuccess(`Booking confirmed for ${selected.room_name} on ${bookingDate} · ${startTime} – ${endTime}`);
      loadRoomSchedule(selected.id, bookingDate || today); loadRangeBookings(selected.id);
      setTimeout(() => setBookingSuccess(""), 6000);
    } catch (err) {
      setFormError(err?.message || "Booking failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  const handleBookRange = () => {
    if (!bookingDate)    { setFormError("Start date is required"); return; }
    if (!rangeEndDate)   { setFormError("End date is required"); return; }
    if (rangeEndDate < bookingDate) { setFormError("End date must be on or after start date"); return; }
    if (!startTime)      { setFormError("Start time is required"); return; }
    if (!endTime)        { setFormError("End time is required"); return; }
    if (ampmToMinutes(endTime) <= ampmToMinutes(startTime)) { setFormError("End time must be after start time"); return; }
    if (!purpose.trim()) { setFormError("Purpose is required"); return; }
    setFormError("");
    setRangeConfirmPreview({
      room:           selected.room_name,
      roomNumber:     selected.room_number,
      startDate:      bookingDate,
      endDate:        rangeEndDate,
      startTime,
      endTime,
      bookedBy:       onBehalfOf ? `${onBehalfOf.name} (${onBehalfOf.email})` : "Admin",
      purpose:        purpose.trim(),
      department:     department.trim() || "—",
      includeWeekends,
      teamMembers,
    });
  };

  const handleConfirmRangeBooking = async () => {
    setRangeConfirmPreview(null);
    setRangeSubmitting(true);
    try {
      const data = await apiFetch("/api/conference/bookings/range", {
        method: "POST",
        body: JSON.stringify({
          room_id:          selected.id,
          booked_by:        onBehalfOf?.email || "ADMIN",
          department:       department.trim() || undefined,
          purpose:          purpose.trim(),
          start_date:       bookingDate,
          end_date:         rangeEndDate,
          start_time:       startTime,
          end_time:         endTime,
          include_weekends: includeWeekends,
          teamMembers:      teamMembers.length > 0 ? teamMembers : undefined,
        }),
      });
      setRangeResult(data);
      setStartTime(""); setEndTime(""); setPurpose(""); setDepartment("");
      setOnBehalfOf(null); setTeamMembers([]); setMemberSearch("");
      setRangeEndDate(""); setIncludeWeekends(false);
      loadRoomSchedule(selected.id, bookingDate || today); loadRangeBookings(selected.id);
    } catch (err) {
      setFormError(err?.message || "Range booking failed. Please try again.");
    } finally { setRangeSubmitting(false); }
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif", color:"#7c3aed" }}>
      Loading rooms…
    </div>
  );

  const inp = { width:"100%", padding:"0.65rem 0.875rem", border:"1px solid #d1d5db",
    borderRadius:"0.5rem", fontSize:"0.875rem", boxSizing:"border-box" };
  const lbl = { display:"block", fontSize:"0.82rem", fontWeight:600, color:"#374151", marginBottom:"0.35rem" };
  const opt = { color:"#9ca3af", fontWeight:400, fontSize:"0.75rem" };

  return (
    <div style={{ background:"#f8f7ff", fontFamily:"'Nunito', sans-serif", paddingBottom:"3rem" }}>

      {/* ===== CONFIRM BOOKING MODAL ===== */}
      {confirmPreview && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setConfirmPreview(null)}>
          <div style={{ background:"#fff", borderRadius:"1rem", width:"100%", maxWidth:420,
            overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#a78bfa)", padding:"1.25rem 1.5rem" }}>
              <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"1px",
                textTransform:"uppercase", color:"rgba(255,255,255,0.7)", marginBottom:4 }}>Confirm Booking</div>
              <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#fff" }}>{confirmPreview.room}</div>
              <div style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.8)", marginTop:2 }}>
                Room #{confirmPreview.roomNumber}
              </div>
            </div>
            {/* Details */}
            <div style={{ padding:"1.25rem 1.5rem" }}>
              {[
                ["Date",       confirmPreview.date],
                ["Time",       `${confirmPreview.startTime} – ${confirmPreview.endTime}`],
                ["Booked by",  confirmPreview.bookedBy],
                ["Purpose",    confirmPreview.purpose],
                ["Department", confirmPreview.department],
                ...(confirmPreview.teamMembers.length > 0
                  ? [["Team", confirmPreview.teamMembers.map(m => m.name).join(", ")]]
                  : []),
              ].map(([label, value]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  padding:"0.5rem 0", borderBottom:"1px solid #f3f4f6", fontSize:"0.83rem" }}>
                  <span style={{ color:"#6b7280", fontWeight:600 }}>{label}</span>
                  <span style={{ color:"#111827", fontWeight:700, textAlign:"right", maxWidth:"60%" }}>{value}</span>
                </div>
              ))}
            </div>
            {/* Actions */}
            <div style={{ padding:"0 1.5rem 1.25rem", display:"flex", gap:"0.75rem" }}>
              <button onClick={() => setConfirmPreview(null)}
                style={{ flex:1, padding:"0.7rem", borderRadius:"0.625rem", border:"1px solid #d1d5db",
                  background:"#fff", color:"#374151", fontSize:"0.875rem", fontWeight:700, cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={handleConfirmBooking} disabled={submitting}
                style={{ flex:2, padding:"0.7rem", borderRadius:"0.625rem", border:"none",
                  background: submitting ? "#a78bfa" : "#7c3aed", color:"#fff",
                  fontSize:"0.875rem", fontWeight:700, cursor: submitting ? "not-allowed" : "pointer" }}>
                {submitting ? "Booking…" : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RANGE CONFIRM MODAL ===== */}
      {rangeConfirmPreview && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setRangeConfirmPreview(null)}>
          <div style={{ background:"#fff", borderRadius:"1rem", width:"100%", maxWidth:420,
            overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#a78bfa)", padding:"1.25rem 1.5rem" }}>
              <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"1px",
                textTransform:"uppercase", color:"rgba(255,255,255,0.7)", marginBottom:4 }}>Confirm Range Booking</div>
              <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#fff" }}>{rangeConfirmPreview.room}</div>
              {rangeConfirmPreview.roomNumber && (
                <div style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.8)", marginTop:2 }}>Room #{rangeConfirmPreview.roomNumber}</div>
              )}
            </div>
            <div style={{ padding:"1.25rem 1.5rem" }}>
              {[
                ["Date Range",  `${rangeConfirmPreview.startDate} → ${rangeConfirmPreview.endDate}`],
                ["Weekends",    rangeConfirmPreview.includeWeekends ? "Included" : "Excluded"],
                ["Time",        `${rangeConfirmPreview.startTime} – ${rangeConfirmPreview.endTime}`],
                ["Booked by",   rangeConfirmPreview.bookedBy],
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
              <button onClick={handleConfirmRangeBooking} disabled={rangeSubmitting}
                style={{ flex:2, padding:"0.7rem", borderRadius:"0.625rem", border:"none",
                  background: rangeSubmitting ? "#a78bfa" : "#7c3aed", color:"#fff",
                  fontSize:"0.875rem", fontWeight:700, cursor: rangeSubmitting ? "not-allowed" : "pointer" }}>
                {rangeSubmitting ? "Booking…" : "Book All Days"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RANGE RESULT MODAL ===== */}
      {rangeResult && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000,
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

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* Header */}
      <header style={{ padding:"0.75rem 1.25rem", background:"#fff",
        borderBottom:"1px solid #e5e7eb", display:"flex", alignItems:"center",
        justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>
        {/* Logo — left */}
        <img src={`${API}/api/logo/${company?.id}`} alt="Logo"
          style={{ height:32, objectFit:"contain" }}
          onError={e => { e.currentTarget.style.display="none"; }} />
        {/* Company name — center */}
        <div style={{ fontWeight:800, fontSize:"1rem", color:"#1f2937",
          position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
          {company?.name}
        </div>
        {/* Back button — right, purple filled */}
        <button onClick={() => step === 2 ? setStep(1) : router.back()}
          style={{ background:"#7c3aed", border:"none", cursor:"pointer",
            color:"#fff", display:"flex", alignItems:"center", gap:"0.4rem",
            fontSize:"0.82rem", fontWeight:700, borderRadius:"99px", padding:"0.4rem 1.1rem",
            whiteSpace:"nowrap" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
      </header>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"1.5rem 1rem 3rem" }}>

        {/* ── STEP 1: Room selection ── */}
        {step === 1 && (
          <>
            <div style={{ marginBottom:"1.5rem" }}>
              <h1 style={{ fontSize:"clamp(1.25rem,3vw,1.6rem)", fontWeight:800, color:"#1f2937", margin:0 }}>
                Select a Conference Room
              </h1>
              <p style={{ color:"#6b7280", fontSize:"0.875rem", marginTop:"0.35rem" }}>
                {rooms.length} room{rooms.length !== 1 ? "s" : ""} available &mdash; today&apos;s bookings shown on each card
              </p>
            </div>
            {rooms.length === 0 ? (
              <div style={{ textAlign:"center", padding:"3rem", color:"#9ca3af" }}>
                No active conference rooms found. Add and activate rooms from the dashboard.
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1rem" }}>
                {rooms.map(room => (
                  <RoomCard key={room.id} room={room} nowMinutes={nowMinutes}
                    onSelect={r => { setSelected(r); setStep(2); window.scrollTo({ top:0, behavior:"smooth" }); }} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Two-column layout ── */}
        {step === 2 && selected && (
          <div style={{ display:"grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr minmax(0,340px)", gap:"1.25rem", alignItems:"start" }}>

            {/* ── LEFT: Form ── */}
            <div>
              {/* Room summary */}
              <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb",
                overflow:"hidden", marginBottom:"1.25rem", display:"flex" }}>
                <div style={{ width:110, flexShrink:0, background:"#ede9fe",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {selected.image_url
                    ? <img src={selected.image_url} alt={selected.room_name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <IconBuilding />}
                </div>
                <div style={{ padding:"0.875rem" }}>
                  <div style={{ fontWeight:800, fontSize:"1rem", color:"#1f2937" }}>{selected.room_name}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.3rem", color:"#6b7280", fontSize:"0.82rem", marginTop:"0.2rem" }}>
                    <IconUsers /> {selected.capacity ? `${selected.capacity} people` : "Capacity N/A"}
                  </div>
                  <button onClick={() => setStep(1)}
                    style={{ marginTop:"0.4rem", fontSize:"0.72rem", color:"#7c3aed", background:"none",
                      border:"none", cursor:"pointer", padding:0, fontWeight:700 }}>
                    ← Change room
                  </button>
                </div>
              </div>

              {/* Booking form */}
              <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb", padding:"1.25rem" }}>
                <h2 style={{ fontSize:"1rem", fontWeight:700, color:"#1f2937", marginBottom:"1.25rem" }}>New Booking</h2>

                {bookingSuccess && (
                <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"0.5rem",
                  padding:"0.625rem 0.875rem", fontSize:"0.82rem", color:"#166534",
                  marginBottom:"1rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {bookingSuccess}
                </div>
              )}
              {formError && (
                  <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"0.5rem",
                    padding:"0.625rem 0.875rem", fontSize:"0.82rem", color:"#b91c1c", marginBottom:"1rem" }}>
                    {formError}
                  </div>
                )}

                {/* Booking mode toggle */}
                <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1rem", background:"#f5f3ff",
                  borderRadius:"0.625rem", padding:"0.25rem" }}>
                  {["single","range"].map(mode => (
                    <button key={mode} onClick={() => { setBookingMode(mode); setFormError(""); }}
                      style={{ flex:1, padding:"0.45rem 0", border:"none", borderRadius:"0.45rem",
                        fontSize:"0.82rem", fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                        background: bookingMode === mode ? "#7c3aed" : "transparent",
                        color: bookingMode === mode ? "#fff" : "#7c3aed" }}>
                      {mode === "single" ? "Single Day" : "Date Range"}
                    </button>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <EmployeeSearch
                      label={<>Book on behalf of <span style={opt}>(optional)</span></>}
                      selected={onBehalfOf} onSelect={setOnBehalfOf} onClear={() => setOnBehalfOf(null)}
                    />
                  </div>
                  {bookingMode === "single" ? (
                    <div style={{ gridColumn:"1/-1" }}>
                      <label style={lbl}>Date</label>
                      <input type="date" value={bookingDate} min={today}
                        onChange={e => { setBookingDate(e.target.value); setStartTime(""); setEndTime(""); }} style={inp} />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label style={lbl}>Start Date</label>
                        <input type="date" value={bookingDate} min={today}
                          onChange={e => { setBookingDate(e.target.value); setStartTime(""); setEndTime(""); setRangeEndDate(""); }} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>End Date</label>
                        <input type="date" value={rangeEndDate} min={bookingDate || today}
                          onChange={e => setRangeEndDate(e.target.value)} style={inp} />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer",
                          fontSize:"0.82rem", fontWeight:600, color:"#374151" }}>
                          <input type="checkbox" checked={includeWeekends}
                            onChange={e => setIncludeWeekends(e.target.checked)}
                            style={{ width:15, height:15, accentColor:"#7c3aed" }} />
                          Include weekends
                        </label>
                      </div>
                    </>
                  )}
                  <div>
                    <label style={lbl}>Start Time</label>
                    <TimePicker value={startTime} onChange={v => { setStartTime(v); setEndTime(""); }} label="Select start time"
                      minMinutes={bookingDate === today ? nowMinutes : null} />
                  </div>
                  <div>
                    <label style={lbl}>End Time</label>
                    <TimePicker value={endTime} onChange={setEndTime} label="Select end time"
                      minMinutes={startMinutes} disabled={!startTime} />
                  </div>
                  <div>
                    <label style={lbl}>Department <span style={opt}>(optional)</span></label>
                    <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Purpose <span style={{ color:"#ef4444" }}>*</span></label>
                    <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Weekly sync" style={inp} />
                  </div>
                  <div style={{ gridColumn:"1/-1" }} ref={memberRef}>
                    <label style={lbl}>Team Members <span style={opt}>(optional)</span></label>
                    <div style={{ position:"relative" }}>
                      <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Search by name or email…" style={inp} />
                      {memberSearching && (
                        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, marginTop:4,
                          background:"#fff", border:"1px solid #e5e7eb", borderRadius:"0.5rem",
                          boxShadow:"0 4px 16px rgba(0,0,0,0.1)", padding:"0.75rem", fontSize:"0.82rem", color:"#6b7280" }}>
                          Searching…
                        </div>
                      )}
                      {!memberSearching && memberResults.length > 0 && (
                        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, marginTop:4,
                          background:"#fff", border:"1px solid #e5e7eb", borderRadius:"0.5rem",
                          boxShadow:"0 4px 16px rgba(0,0,0,0.1)", maxHeight:200, overflowY:"auto" }}>
                          {memberResults.map(emp => (
                            <div key={emp.id} onClick={() => addMember(emp)}
                              style={{ padding:"0.5rem 0.875rem", cursor:"pointer", borderBottom:"1px solid #f3f4f6" }}
                              onMouseEnter={e => e.currentTarget.style.background="#f5f3ff"}
                              onMouseLeave={e => e.currentTarget.style.background="none"}>
                              <div style={{ fontWeight:600, fontSize:"0.875rem" }}>{emp.name}</div>
                              <div style={{ fontSize:"0.75rem", color:"#6b7280" }}>{emp.email}{emp.department ? ` · ${emp.department}` : ""}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {teamMembers.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem", marginTop:"0.5rem" }}>
                        {teamMembers.map(m => (
                          <span key={m.id} style={{ display:"flex", alignItems:"center", gap:"0.3rem",
                            background:"#ede9fe", color:"#7c3aed", borderRadius:99,
                            padding:"0.25rem 0.625rem", fontSize:"0.78rem", fontWeight:600 }}>
                            {m.name}
                            <button onClick={() => removeMember(m.id)} style={{ background:"none", border:"none",
                              cursor:"pointer", color:"#7c3aed", padding:0, lineHeight:1, fontSize:"0.9rem" }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop:"0.875rem", padding:"0.5rem 0.875rem", background:"#f5f3ff",
                  borderRadius:"0.5rem", fontSize:"0.78rem", color:"#6b21a8" }}>
                  Booking as: <strong>{onBehalfOf ? `${onBehalfOf.name} (${onBehalfOf.email})` : "Admin"}</strong>
                </div>

                <button
                  onClick={bookingMode === "single" ? handleBook : handleBookRange}
                  disabled={submitting || rangeSubmitting}
                  style={{ marginTop:"1.25rem", width:"100%", padding:"0.75rem",
                    background: (submitting || rangeSubmitting) ? "#a78bfa" : "#7c3aed", color:"#fff",
                    border:"none", borderRadius:"0.625rem", fontSize:"0.9rem",
                    fontWeight:700, cursor: (submitting || rangeSubmitting) ? "not-allowed" : "pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}>
                  {(submitting || rangeSubmitting) ? "Booking…" : (<><IconCheck /> {bookingMode === "single" ? "Confirm Booking" : "Book All Days"}</>)}
                </button>
              </div>

              {/* ── Date Range Bookings for this room ── */}
              {(rangeLoading || rangeBookings.length > 0) && (
                <div style={{ marginTop:"1.25rem", background:"#fff", borderRadius:"0.875rem",
                  border:"1px solid #e5e7eb", padding:"1rem" }}>
                  <div style={{ fontSize:"0.78rem", fontWeight:800, color:"#7c3aed",
                    textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"0.75rem" }}>
                    Date Range Bookings
                  </div>
                  {rangeLoading ? (
                    <div style={{ fontSize:"0.8rem", color:"#9ca3af", textAlign:"center", padding:"1rem" }}>Loading…</div>
                  ) : rangeBookings.map(group => {
                    const first = group.days[0];
                    const last = group.days[group.days.length - 1];
                    const rep = group.upcoming[0];
                    const booker = first.booked_by === "ADMIN" ? "Admin" : first.booked_by_name || first.booked_by;
                    return (
                      <div key={group.range_booking_id} style={{ marginBottom:"0.75rem", padding:"0.75rem",
                        background:"#f5f3ff", borderRadius:"0.625rem", border:"1px solid #ddd6fe" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"0.5rem" }}>
                          <div>
                            <div style={{ fontSize:"0.82rem", fontWeight:700, color:"#1f2937" }}>
                              {prettyTime(first.start_time)} – {prettyTime(first.end_time)}
                            </div>
                            <div style={{ fontSize:"0.72rem", color:"#6b7280", marginTop:"0.2rem" }}>
                              {first.booking_date} → {last.booking_date}
                            </div>
                            <div style={{ fontSize:"0.7rem", color:"#9ca3af", marginTop:"0.15rem" }}>
                              {booker} · {group.upcoming.length} day{group.upcoming.length !== 1 ? "s" : ""} remaining
                            </div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", gap:"0.35rem", flexShrink:0 }}>
                            <button onClick={() => openScopePicker({ ...rep, range_booking_id: group.range_booking_id, _forceRange: true }, "reschedule")}
                              style={{ fontSize:"0.68rem", fontWeight:700, padding:"0.3rem 0.5rem",
                                background:"#7c3aed", color:"#fff", border:"none", borderRadius:"0.4rem", cursor:"pointer" }}>
                              Reschedule
                            </button>
                            <button onClick={() => openScopePicker({ ...rep, range_booking_id: group.range_booking_id, _forceRange: true }, "cancel")}
                              style={{ fontSize:"0.68rem", fontWeight:700, padding:"0.3rem 0.5rem",
                                background:"#fef2f2", color:"#b91c1c", border:"1px solid #fecaca", borderRadius:"0.4rem", cursor:"pointer" }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                        {first.purpose && (
                          <div style={{ fontSize:"0.7rem", color:"#6b7280", marginTop:"0.35rem",
                            borderTop:"1px solid #ede9fe", paddingTop:"0.35rem" }}>
                            {first.purpose}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT: Room schedule for selected date ── */}
            <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb",
              overflow:"hidden", position:"sticky", top:80 }}>
              <div style={{ padding:"0.75rem 1rem", borderBottom:"1px solid #f3f4f6",
                background:"linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
                <div style={{ fontWeight:800, fontSize:"0.85rem", color:"#fff" }}>
                  {scheduleDate && scheduleDate !== today ? `Schedule · ${scheduleDate}` : "Today's Schedule"}
                </div>
                <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.8)", marginTop:2 }}>{selected.room_name}</div>
              </div>
              <div style={{ padding:"0.75rem", maxHeight:500, overflowY:"auto" }}>
                {scheduleLoading ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:"#9ca3af", fontSize:"0.82rem" }}>Loading…</div>
                ) : roomSchedule.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:"#9ca3af", fontSize:"0.82rem" }}>
                    No bookings for this date
                  </div>
                ) : (
                  [...roomSchedule].sort((a,b) => a.start_time.localeCompare(b.start_time)).map(b => {
                    const state = classifyBooking(b);
                    const isPast = state === "past" || state === "active";
                    const booker = b.booked_by === "ADMIN" ? "Admin" : b.booked_by;
                    return (
                      <div key={b.id} style={{ marginBottom:"0.6rem", borderRadius:"0.5rem",
                        border:`1px solid ${isPast ? "#e5e7eb" : "#7c3aed"}`,
                        background: isPast ? "#f9fafb" : "#fff",
                        opacity: isPast ? 0.6 : 1, padding:"0.6rem 0.75rem" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div style={{ fontSize:"0.78rem", fontWeight:700,
                            color: isPast ? "#9ca3af" : "#1f2937" }}>
                            {prettyTime(b.start_time)} – {prettyTime(b.end_time)}
                          </div>
                          {state === "active" && (
                            <span style={{ display:"flex", alignItems:"center", gap:"0.3rem",
                              fontSize:"0.62rem", background:"#dcfce7", color:"#15803d",
                              borderRadius:99, padding:"2px 7px", fontWeight:700 }}>
                              <span style={{ width:6, height:6, borderRadius:"50%", background:"#16a34a",
                                display:"inline-block", animation:"pulse 1.5s infinite" }} />
                              In Progress
                            </span>
                          )}
                          {state === "past" && (
                            <span style={{ fontSize:"0.62rem", background:"#f3f4f6", color:"#9ca3af",
                              borderRadius:99, padding:"1px 6px", fontWeight:700 }}>Ended</span>
                          )}
                        </div>
                        <div style={{ fontSize:"0.72rem", color:"#6b7280", marginTop:2 }}>
                          {b.department && <span>{b.department} · </span>}{booker}
                        </div>
                        {state === "active" && (
                          <div style={{ marginTop:"0.5rem" }}>
                            <div style={{ fontSize:"0.62rem", fontWeight:700, color:"#15803d", marginBottom:"0.3rem" }}>Extend meeting</div>
                            <div style={{ display:"flex", gap:"0.3rem" }}>
                              {[15, 30, 60].map(mins => (
                                <button key={mins} onClick={() => extendBooking(b, mins)}
                                  style={{ flex:1, padding:"0.3rem 0", background:"#16a34a", color:"#fff",
                                    border:"none", borderRadius:"0.35rem", fontSize:"0.7rem",
                                    fontWeight:700, cursor:"pointer", boxShadow:"0 1px 4px rgba(22,163,74,0.35)" }}>
                                  +{mins}m
                                </button>
                              ))}
                            </div>
                            {extendMsg && (
                              <div style={{ marginTop:"0.4rem", padding:"0.35rem 0.6rem",
                                background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"0.35rem",
                                fontSize:"0.68rem", fontWeight:700, color:"#166534",
                                display:"flex", alignItems:"center", gap:"0.3rem" }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                {extendMsg}
                              </div>
                            )}
                          </div>
                        )}
                        {state === "upcoming" && (
                          <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem" }}>
                            <button onClick={() => openScopePicker(b, "reschedule")}
                              style={{ flex:1, padding:"0.28rem 0", background:"#ede9fe", color:"#7c3aed",
                                border:"none", borderRadius:"0.35rem", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>
                              Reschedule
                            </button>
                            <button onClick={() => openScopePicker(b, "cancel")}
                              style={{ flex:1, padding:"0.28rem 0", background:"#fef2f2", color:"#b91c1c",
                                border:"none", borderRadius:"0.35rem", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>
                              Cancel
                            </button>
                          </div>
                        )}
                        {(state === "past" || state === "active") && b.range_booking_id && (
                          <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem" }}>
                            <button onClick={() => openScopePicker({ ...b, _forceRange: true }, "reschedule")}
                              style={{ flex:1, padding:"0.28rem 0", background:"#ede9fe", color:"#7c3aed",
                                border:"none", borderRadius:"0.35rem", fontSize:"0.65rem", fontWeight:700, cursor:"pointer" }}>
                              Reschedule remaining
                            </button>
                            <button onClick={() => openScopePicker({ ...b, _forceRange: true }, "cancel")}
                              style={{ flex:1, padding:"0.28rem 0", background:"#fef2f2", color:"#b91c1c",
                                border:"none", borderRadius:"0.35rem", fontSize:"0.65rem", fontWeight:700, cursor:"pointer" }}>
                              Cancel remaining
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Scope Picker Modal (range booking: this day vs entire range) ── */}
      {scopePicker && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setScopePicker(null)}>
          <div style={{ background:"#fff", borderRadius:"1rem", width:"100%", maxWidth:380,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid #e5e7eb",
              background: scopePicker.action === "cancel" ? "#fef2f2" : "linear-gradient(135deg,#7c3aed,#a78bfa)",
              borderRadius:"1rem 1rem 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:800, fontSize:"0.95rem",
                color: scopePicker.action === "cancel" ? "#b91c1c" : "#fff" }}>
                {scopePicker.action === "cancel" ? "Cancel Booking" : "Reschedule Booking"}
              </span>
              <button onClick={() => setScopePicker(null)}
                style={{ background:"rgba(0,0,0,0.1)", border:"none",
                  color: scopePicker.action === "cancel" ? "#b91c1c" : "#fff",
                  borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:"1rem" }}>×</button>
            </div>
            <div style={{ padding:"1.25rem" }}>
              <p style={{ fontSize:"0.82rem", color:"#6b7280", marginBottom:"1rem" }}>
                This booking is part of a multi-day range. What would you like to {scopePicker.action}?
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
                <button onClick={() => confirmScopeChoice("single")}
                  style={{ padding:"0.75rem 1rem", borderRadius:"0.6rem", textAlign:"left",
                    border:"1.5px solid #e5e7eb", background:"#fafafa", cursor:"pointer" }}>
                  <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#111827" }}>This day only</div>
                  <div style={{ fontSize:"0.75rem", color:"#6b7280", marginTop:2 }}>
                    {new Date((scopePicker.booking.booking_date?.split("T")[0] || "") + "T12:00:00")
                      .toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })}
                  </div>
                </button>
                <button onClick={() => confirmScopeChoice("range")}
                  style={{ padding:"0.75rem 1rem", borderRadius:"0.6rem", textAlign:"left",
                    border:"1.5px solid #7c3aed", background:"#f5f3ff", cursor:"pointer" }}>
                  <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#7c3aed" }}>Entire remaining range</div>
                  <div style={{ fontSize:"0.75rem", color:"#6b7280", marginTop:2 }}>
                    {scopeLoading ? "Loading…" : `${scopeRangeUpcoming} upcoming day${scopeRangeUpcoming !== 1 ? "s" : ""} will be affected`}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal ── */}
      {rescheduleTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setRescheduleTarget(null)}>
          <div style={{ background:"#fff", borderRadius:"1rem", width:"100%", maxWidth:440,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid #e5e7eb",
              background:"linear-gradient(135deg,#7c3aed,#a78bfa)", borderRadius:"1rem 1rem 0 0",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:800, color:"#fff", fontSize:"0.95rem" }}>Reschedule Booking</span>
              <button onClick={() => setRescheduleTarget(null)}
                style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff",
                  borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:"1rem" }}>×</button>
            </div>
            <div style={{ padding:"1.25rem" }}>
              <div style={{ fontSize:"0.8rem", color:"#6b7280", marginBottom:"1rem", background:"#f5f3ff",
                padding:"0.5rem 0.75rem", borderRadius:"0.5rem" }}>
                Current: <strong>{prettyTime(rescheduleTarget.start_time)} – {prettyTime(rescheduleTarget.end_time)}</strong>
                {" · "}{rescheduleTarget.booked_by === "ADMIN" ? "Admin" : rescheduleTarget.booked_by}
              </div>
              {rsScope === "range" && (
                <div style={{ background:"#ede9fe", color:"#7c3aed", borderRadius:"0.5rem",
                  padding:"0.5rem 0.75rem", fontSize:"0.78rem", fontWeight:600, marginBottom:"0.75rem" }}>
                  ℹ️ New time &amp; room will apply to all {scopeRangeUpcoming} upcoming days in this range
                </div>
              )}
              {rsError && <div style={{ background:"#fef2f2", color:"#b91c1c", borderRadius:"0.5rem",
                padding:"0.5rem 0.75rem", fontSize:"0.8rem", marginBottom:"0.75rem" }}>{rsError}</div>}
              <div style={{ display:"grid", gap:"0.75rem" }}>
                {rsScope === "single" && (
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" value={rsDate} min={today} onChange={e => setRsDate(e.target.value)} style={inp} />
                </div>
                )}
                <div>
                  <label style={lbl}>Room</label>
                  <select value={rsRoom} onChange={e => setRsRoom(e.target.value)} style={inp}>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.room_name}</option>)}
                  </select>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
                  <div>
                    <label style={lbl}>Start Time</label>
                    <TimePicker value={rsStart} onChange={v => { setRsStart(v); setRsEnd(""); }} label="Start"
                      minMinutes={rsDate === today ? nowMinutes : null} />
                  </div>
                  <div>
                    <label style={lbl}>End Time</label>
                    <TimePicker value={rsEnd} onChange={setRsEnd} label="End"
                      minMinutes={rsStart ? ampmToMinutes(rsStart) : null} disabled={!rsStart} />
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:"0.75rem", marginTop:"1.25rem" }}>
                <button onClick={confirmReschedule} disabled={rsSaving}
                  style={{ flex:1, padding:"0.65rem", background: rsSaving ? "#a78bfa" : "#7c3aed",
                    color:"#fff", border:"none", borderRadius:"0.5rem", fontWeight:700,
                    fontSize:"0.875rem", cursor: rsSaving ? "not-allowed" : "pointer" }}>
                  {rsSaving ? "Saving…" : "Confirm Reschedule"}
                </button>
                <button onClick={() => setRescheduleTarget(null)}
                  style={{ flex:1, padding:"0.65rem", background:"#f3f4f6", color:"#374151",
                    border:"none", borderRadius:"0.5rem", fontWeight:600, fontSize:"0.875rem", cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ── */}
      {cancelTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setCancelTarget(null)}>
          <div style={{ background:"#fff", borderRadius:"1rem", width:"100%", maxWidth:380,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid #e5e7eb", borderRadius:"1rem 1rem 0 0",
              background:"#fef2f2", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:800, color:"#b91c1c", fontSize:"0.95rem" }}>Cancel Booking</span>
              <button onClick={() => setCancelTarget(null)}
                style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#6b7280" }}>×</button>
            </div>
            <div style={{ padding:"1.25rem" }}>
              <p style={{ fontSize:"0.875rem", color:"#374151", marginBottom:"0.75rem" }}>
                {cancelScope === "range"
                  ? `Are you sure you want to cancel all ${scopeRangeUpcoming} upcoming day${scopeRangeUpcoming !== 1 ? "s" : ""} in this range?`
                  : "Are you sure you want to cancel this booking?"}
                {" "}A cancellation email will be sent to the booker and all team members.
              </p>
              <div style={{ background:"#f9fafb", borderRadius:"0.5rem", padding:"0.625rem 0.875rem",
                fontSize:"0.82rem", color:"#374151", marginBottom:"1.25rem" }}>
                <strong>{prettyTime(cancelTarget.start_time)} – {prettyTime(cancelTarget.end_time)}</strong>
                <br />{cancelTarget.department || cancelTarget.booked_by}
              </div>
              <div style={{ display:"flex", gap:"0.75rem" }}>
                <button onClick={confirmCancel} disabled={cancelSaving}
                  style={{ flex:1, padding:"0.65rem", background: cancelSaving ? "#fca5a5" : "#ef4444",
                    color:"#fff", border:"none", borderRadius:"0.5rem", fontWeight:700,
                    fontSize:"0.875rem", cursor: cancelSaving ? "not-allowed" : "pointer" }}>
                  {cancelSaving ? "Cancelling…" : "Yes, Cancel"}
                </button>
                <button onClick={() => setCancelTarget(null)}
                  style={{ flex:1, padding:"0.65rem", background:"#f3f4f6", color:"#374151",
                    border:"none", borderRadius:"0.5rem", fontWeight:600, fontSize:"0.875rem", cursor:"pointer" }}>
                  Keep Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
