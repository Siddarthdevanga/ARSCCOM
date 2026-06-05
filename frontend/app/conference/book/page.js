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
        <div style={{ display:"flex", alignItems:"center", gap:"0.3rem", color:"#6b7280", fontSize:"0.8rem", marginBottom:"0.625rem" }}>
          <IconUsers />{room.capacity ? `${room.capacity} people` : "Capacity N/A"}
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
  const [confirmPreview, setConfirmPreview] = useState(null);

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

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // booking
  const [rsDate,  setRsDate]  = useState("");
  const [rsRoom,  setRsRoom]  = useState("");
  const [rsStart, setRsStart] = useState("");
  const [rsEnd,   setRsEnd]   = useState("");
  const [rsError, setRsError] = useState("");
  const [rsSaving,setRsSaving]= useState(false);

  // Cancel modal
  const [cancelTarget,  setCancelTarget]  = useState(null);
  const [cancelSaving,  setCancelSaving]  = useState(false);

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
  const loadRoomSchedule = (roomId) => {
    if (!roomId) return;
    setScheduleLoading(true);
    apiFetch(`/api/conference/bookings?roomId=${roomId}&date=${today}`)
      .then(data => setRoomSchedule(Array.isArray(data) ? data.filter(b => b.status === "BOOKED") : []))
      .catch(() => setRoomSchedule([]))
      .finally(() => setScheduleLoading(false));
  };

  useEffect(() => {
    if (selected) loadRoomSchedule(selected.id);
    else setRoomSchedule([]);
  }, [selected]);

  // Classify a booking relative to now
  const classifyBooking = (b) => {
    const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
    const s = toMin(b.start_time), e = toMin(b.end_time);
    if (e <= nowMinutes) return "past";
    if (s <= nowMinutes && e > nowMinutes) return "active"; // in-progress
    return "upcoming";
  };

  // Open reschedule modal
  const openReschedule = (b) => {
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
      await apiFetch(`/api/conference/bookings/${rescheduleTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ start_time: rsStart, end_time: rsEnd, booking_date: rsDate, room_id: Number(rsRoom) }),
      });
      setRescheduleTarget(null);
      loadRoomSchedule(selected.id);
    } catch (err) { setRsError(err?.message || "Reschedule failed"); }
    finally { setRsSaving(false); }
  };

  const confirmCancel = async () => {
    setCancelSaving(true);
    try {
      await apiFetch(`/api/conference/bookings/${cancelTarget.id}/cancel`, { method: "PATCH" });
      setCancelTarget(null);
      loadRoomSchedule(selected.id);
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
      loadRoomSchedule(selected.id);
      setTimeout(() => setBookingSuccess(""), 6000);
    } catch (err) {
      setFormError(err?.message || "Booking failed. Please try again.");
    } finally { setSubmitting(false); }
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

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <EmployeeSearch
                      label={<>Book on behalf of <span style={opt}>(optional)</span></>}
                      selected={onBehalfOf} onSelect={setOnBehalfOf} onClear={() => setOnBehalfOf(null)}
                    />
                  </div>
                  <div style={{ gridColumn:"1/-1" }}>
                    <label style={lbl}>Date</label>
                    <input type="date" value={bookingDate} min={today}
                      onChange={e => { setBookingDate(e.target.value); setStartTime(""); setEndTime(""); }} style={inp} />
                  </div>
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

                <button onClick={handleBook} disabled={submitting}
                  style={{ marginTop:"1.25rem", width:"100%", padding:"0.75rem",
                    background: submitting ? "#a78bfa" : "#7c3aed", color:"#fff",
                    border:"none", borderRadius:"0.625rem", fontSize:"0.9rem",
                    fontWeight:700, cursor: submitting ? "not-allowed" : "pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}>
                  {submitting ? "Booking…" : (<><IconCheck /> Confirm Booking</>)}
                </button>
              </div>
            </div>

            {/* ── RIGHT: Today's room schedule ── */}
            <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb",
              overflow:"hidden", position:"sticky", top:80 }}>
              <div style={{ padding:"0.75rem 1rem", borderBottom:"1px solid #f3f4f6",
                background:"linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
                <div style={{ fontWeight:800, fontSize:"0.85rem", color:"#fff" }}>Today&apos;s Schedule</div>
                <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.8)", marginTop:2 }}>{selected.room_name}</div>
              </div>
              <div style={{ padding:"0.75rem", maxHeight:500, overflowY:"auto" }}>
                {scheduleLoading ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:"#9ca3af", fontSize:"0.82rem" }}>Loading…</div>
                ) : roomSchedule.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:"#9ca3af", fontSize:"0.82rem" }}>
                    No bookings today for this room
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
                            <span style={{ fontSize:"0.62rem", background:"#fef3c7", color:"#92400e",
                              borderRadius:99, padding:"1px 6px", fontWeight:700 }}>In Progress</span>
                          )}
                          {state === "past" && (
                            <span style={{ fontSize:"0.62rem", background:"#f3f4f6", color:"#9ca3af",
                              borderRadius:99, padding:"1px 6px", fontWeight:700 }}>Ended</span>
                          )}
                        </div>
                        <div style={{ fontSize:"0.72rem", color:"#6b7280", marginTop:2 }}>
                          {b.department && <span>{b.department} · </span>}{booker}
                        </div>
                        {!isPast && (
                          <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem" }}>
                            <button onClick={() => openReschedule(b)}
                              style={{ flex:1, padding:"0.28rem 0", background:"#ede9fe", color:"#7c3aed",
                                border:"none", borderRadius:"0.35rem", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>
                              Reschedule
                            </button>
                            <button onClick={() => setCancelTarget(b)}
                              style={{ flex:1, padding:"0.28rem 0", background:"#fef2f2", color:"#b91c1c",
                                border:"none", borderRadius:"0.35rem", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>
                              Cancel
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
              {rsError && <div style={{ background:"#fef2f2", color:"#b91c1c", borderRadius:"0.5rem",
                padding:"0.5rem 0.75rem", fontSize:"0.8rem", marginBottom:"0.75rem" }}>{rsError}</div>}
              <div style={{ display:"grid", gap:"0.75rem" }}>
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" value={rsDate} min={today} onChange={e => setRsDate(e.target.value)} style={inp} />
                </div>
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
                Are you sure you want to cancel this booking?
                A cancellation email will be sent to the booker and all team members.
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
