"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import styles from "../primary_details/style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/* ── SVG icons ── */
const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
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
const IconUser = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

/* ── Employee autocomplete (admin, auth required) ── */
const EmployeeAutocomplete = ({ value, employeeId, onChange, onSelect, disabled }) => {
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setFetching(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/employees?search=${encodeURIComponent(q)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data
        : Array.isArray(data?.employees) ? data.employees
        : Array.isArray(data?.data) ? data.data : [];
      setResults(list);
      setOpen(true);
    } catch { setResults([]); setOpen(true); }
    finally { setFetching(false); }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (employeeId) onSelect({ name: val, id: null });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const initials = (name) => {
    if (!name) return "?";
    const p = name.trim().split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase();
  };

  return (
    <div ref={wrapperRef} style={{ position:"relative" }}>
      <div style={{ position:"relative" }}>
        <input
          className={styles.input}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => { if (value.trim() && results.length > 0) setOpen(true); }}
          placeholder="Search by name or department..."
          disabled={disabled}
          autoComplete="off"
          style={{ paddingRight: employeeId ? "2rem" : undefined }}
        />
        {fetching && (
          <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
            width:14, height:14, border:"2px solid #7c3aed", borderTopColor:"transparent",
            borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }} />
        )}
        {employeeId && !fetching && (
          <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#16a34a", fontWeight:700, fontSize:14 }}>✓</span>
        )}
      </div>
      {open && (results.length > 0 || (!fetching && value.trim())) && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff",
          border:"1px solid #e5e7eb", borderRadius:"0.5rem", boxShadow:"0 4px 12px rgba(0,0,0,0.08)",
          zIndex:50, maxHeight:200, overflowY:"auto", marginTop:4 }}>
          {results.length > 0 ? results.map(emp => (
            <button key={emp.id} type="button"
              style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.6rem",
                padding:"0.5rem 0.75rem", background:"none", border:"none", cursor:"pointer",
                textAlign:"left", fontSize:"0.875rem" }}
              onMouseDown={(e) => { e.preventDefault(); onSelect({ name: emp.name, id: emp.id }); setOpen(false); setResults([]); }}>
              <span style={{ width:28, height:28, borderRadius:"50%", background:"#ede9fe",
                color:"#7c3aed", fontSize:"0.7rem", fontWeight:700, display:"flex",
                alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {initials(emp.name)}
              </span>
              <span>
                <span style={{ display:"block", fontWeight:600, color:"#1f2937" }}>{emp.name}</span>
                {emp.department && <span style={{ fontSize:"0.75rem", color:"#6b7280" }}>{emp.department}</span>}
              </span>
            </button>
          )) : (
            <div style={{ padding:"0.75rem", fontSize:"0.82rem", color:"#9ca3af", textAlign:"center" }}>
              No employees found — entry will still be saved
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Full profile preview with all fields (nulls greyed) ── */
function ProfilePreview({ profile, phone }) {
  const r = profile;
  const sections = [
    { label: "Primary", fields: [
      { k: "Name",        v: r.name },
      { k: "Email",       v: r.email },
      { k: "Phone",       v: phone ? `+91 ${phone}` : null },
    ]},
    { label: "Organisation", fields: [
      { k: "Company",     v: r.fromCompany },
      { k: "Department",  v: r.department },
      { k: "Designation", v: r.designation },
      { k: "Address",     v: r.address },
      { k: "City",        v: r.city },
      { k: "State",       v: r.state },
      { k: "Postal Code", v: r.postalCode },
      { k: "Country",     v: r.country },
    ]},
    { label: "Identity", fields: [
      { k: "ID Type",     v: r.idType },
      { k: "ID Number",   v: r.idNumber },
    ]},
  ];

  return (
    <div>
      {/* Photo */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:"1.25rem" }}>
        {r.photoUrl
          ? <img src={r.photoUrl} alt="Visitor photo"
              style={{ width:80, height:80, borderRadius:"50%", objectFit:"cover",
                border:"3px solid #7c3aed", boxShadow:"0 2px 8px rgba(124,58,237,0.15)" }} />
          : <div style={{ width:80, height:80, borderRadius:"50%", background:"#f3f4f6",
              border:"3px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <IconUser />
            </div>
        }
      </div>

      {sections.map(sec => (
        <div key={sec.label} style={{ marginBottom:"0.875rem" }}>
          <div style={{ fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.8px", color:"#7c3aed", marginBottom:"0.4rem" }}>{sec.label}</div>
          <div style={{ border:"1px solid #e5e7eb", borderRadius:"0.6rem", overflow:"hidden" }}>
            {sec.fields.map(({ k, v }, i) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"0.45rem 0.75rem", fontSize:"0.82rem",
                borderTop: i > 0 ? "1px solid #f3f4f6" : "none",
                background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <span style={{ color:"#6b7280", fontWeight:500, minWidth:90 }}>{k}</span>
                <span style={{ color: v ? "#1f2937" : "#d1d5db", fontStyle: v ? "normal" : "italic",
                  textAlign:"right", maxWidth:"58%", wordBreak:"break-word" }}>
                  {v || "Not provided"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════ */
export default function NewVisitorPage() {
  const router = useRouter();

  const [company,   setCompany]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [phone,     setPhone]     = useState("");
  const [looking,   setLooking]   = useState(false);
  const [profile,   setProfile]   = useState(null);   // returning visitor data
  const [error,     setError]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Mini form */
  const [personToMeet,       setPersonToMeet]       = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [purpose,            setPurpose]            = useState("");
  const [belongings,         setBelongings]         = useState([]);
  const [miniError,          setMiniError]          = useState("");

  useEffect(() => {
    const token   = localStorage.getItem("token");
    const stored  = localStorage.getItem("company");
    if (!token || !stored) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/auth/login"); return; }

    // Clear all stale registration data from any previous abandoned session
    localStorage.removeItem("visitor_primary");
    localStorage.removeItem("visitor_secondary");
    localStorage.removeItem("visitor_returning");
    localStorage.removeItem("visitor_new_phone");

    setLoading(false);
  }, [router]);

  // Trigger lookup via effect so clicking a button immediately after typing
  // doesn't cause the blur-before-click race (onBlur fires before onClick,
  // hiding the button mid-click and swallowing the first tap).
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return;
    if (!/^[6-9]/.test(digits)) return;
    let cancelled = false;
    setLooking(true);
    setProfile(null);
    setError("");
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/api/visitors/returning?phone=${digits}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.found && data.profile) {
          setProfile(data.profile);
          localStorage.setItem("visitor_returning", JSON.stringify(data.profile));
        } else {
          localStorage.removeItem("visitor_returning");
        }
      } catch { if (!cancelled) localStorage.removeItem("visitor_returning"); }
      finally { if (!cancelled) setLooking(false); }
    })();
    return () => { cancelled = true; };
  }, [phone]);

  const toggleBelonging = (item) => setBelongings(prev =>
    prev.includes(item) ? prev.filter(b => b !== item) : [...prev, item]
  );

  const handleProceedNew = () => {
    // New visitor — carry phone to primary_details via localStorage
    localStorage.setItem("visitor_new_phone", phone.replace(/\D/g, ""));
    router.push("/visitor/primary_details");
  };

  const handleEditDetails = () => {
    // Pre-fill name/email for primary_details
    if (profile) {
      localStorage.setItem("visitor_primary", JSON.stringify({
        name: profile.name, phone: `91${phone.replace(/\D/g, "")}`, email: profile.email,
      }));
    }
    router.push("/visitor/primary_details");
  };

  const handleIssuePass = async () => {
    if (!personToMeet.trim()) { setMiniError("Person to Meet is required"); return; }
    setMiniError("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("name",        profile.name        || "");
      fd.append("phone",       `91${phone.replace(/\D/g, "")}`);
      fd.append("email",       profile.email       || "");
      fd.append("fromCompany", profile.fromCompany || "");
      fd.append("department",  profile.department  || "");
      fd.append("designation", profile.designation || "");
      fd.append("address",     profile.address     || "");
      fd.append("city",        profile.city        || "");
      fd.append("state",       profile.state       || "");
      fd.append("postalCode",  profile.postalCode  || "");
      fd.append("country",     profile.country     || "");
      fd.append("idType",      profile.idType      || "");
      fd.append("idNumber",    profile.idNumber    || "");
      fd.append("personToMeet", personToMeet.trim());
      if (purpose.trim()) fd.append("purpose", purpose.trim());
      if (belongings.length) fd.append("belongings", belongings.join(", "));
      if (selectedEmployeeId) fd.append("employeeId", String(selectedEmployeeId));
      if (profile.photoKey)  fd.append("existingPhotoKey", profile.photoKey);

      const res = await fetch(`${API}/api/visitors`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to issue pass");

      localStorage.removeItem("visitor_returning");
      localStorage.removeItem("visitor_primary");
      localStorage.removeItem("visitor_secondary");
      router.push(`/visitor/pass?visitorCode=${data.visitor.visitorCode}`);
    } catch (err) {
      setMiniError(err.message || "Failed to issue pass");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !company) return (
    <div className={styles.container}><div className={styles.loading}>Loading…</div></div>
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <img src={`${API}/api/logo/${company.id}`} alt="Logo" className={styles.companyLogo}
            onError={e => { e.currentTarget.style.display = "none"; }} />
          <button className={styles.backBtn} onClick={() => router.push("/visitor/dashboard")}>
            ← Back
          </button>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Register a <span>Visitor</span></h1>
          <p className={styles.heroSub}>
            Enter the visitor&apos;s WhatsApp number. Returning visitors are detected automatically — their details pre-fill instantly and the pass is issued in seconds.
          </p>
        </section>

        <main className={styles.mainContent}>
          <div className={styles.formCard}>

            {/* Phone entry */}
            <div className={styles.cardHeader}>
              <span className={styles.cardDot} />
              <h3 className={styles.cardTitle}>Visitor Phone Number</h3>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.formGroup}>
              <label className={styles.label}>
                WhatsApp Number <span className={styles.req}>*</span>
              </label>
              <div style={{ display:"flex", gap:"0.5rem", alignItems:"stretch" }}>
                <div style={{ padding:"0.75rem 1rem", background:"#f3f4f6", border:"1px solid #d1d5db",
                  borderRadius:"0.5rem", fontWeight:"600", color:"#374151", fontSize:"0.95rem",
                  display:"flex", alignItems:"center" }}>+91</div>
                <input
                  className={styles.input}
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g,"").slice(0,10)); setProfile(null); localStorage.removeItem("visitor_returning"); }}
                  placeholder="Enter 10-digit number"
                  inputMode="numeric"
                  maxLength={10}
                  style={{ flex:1, margin:0 }}
                />
              </div>
              {looking && (
                <p style={{ fontSize:"0.78rem", color:"#7c3aed", marginTop:"0.3rem", display:"flex", alignItems:"center", gap:"0.3rem" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  Looking up visitor…
                </p>
              )}
            </div>

            {/* ── Phone 6-9 rule error ── */}
            {phone.replace(/\D/g,"").length === 10 && !/^[6-9]/.test(phone) && (
              <p style={{ color:"#dc2626", fontSize:"0.75rem", fontWeight:700, marginTop:"0.3rem" }}>
                Number must start with 6, 7, 8 or 9
              </p>
            )}

            {/* ── New visitor ── */}
            {!profile && phone.replace(/\D/g,"").length === 10 && /^[6-9]/.test(phone) && (
              <button className={styles.nextBtn} onClick={handleProceedNew}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}>
                Continue as New Visitor
                <IconArrow />
              </button>
            )}

            {/* ── Returning visitor preview ── */}
            {profile && (
              <>
                <div style={{ margin:"1rem 0 0.5rem", borderTop:"1px solid #e5e7eb", paddingTop:"1rem" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                    fontSize:"0.78rem", fontWeight:700, color:"#7c3aed", marginBottom:"0.875rem",
                    textTransform:"uppercase", letterSpacing:"0.5px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    Returning Visitor Found
                  </div>

                  <div style={{ border:"1px solid #e5e7eb", borderRadius:"0.75rem", padding:"1rem", background:"#fafafa" }}>
                    <ProfilePreview profile={profile} phone={phone.replace(/\D/g,"")} />
                  </div>
                </div>

                {/* Mini form — visit-specific */}
                <div style={{ marginTop:"1.25rem" }}>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase",
                    letterSpacing:"0.8px", color:"#374151", marginBottom:"0.75rem" }}>Visit Details</div>

                  {miniError && (
                    <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"0.5rem",
                      padding:"0.5rem 0.75rem", fontSize:"0.82rem", color:"#b91c1c", marginBottom:"0.75rem" }}>
                      {miniError}
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Person to Meet <span className={styles.req}>*</span>
                    </label>
                    <EmployeeAutocomplete
                      value={personToMeet}
                      employeeId={selectedEmployeeId}
                      onChange={(val) => { setPersonToMeet(val); setMiniError(""); }}
                      onSelect={({ name, id }) => { setPersonToMeet(name); setSelectedEmployeeId(id); setMiniError(""); }}
                      disabled={submitting}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Purpose of Visit</label>
                    <input className={styles.input} value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="Meeting / Interview / Delivery…" disabled={submitting} />
                  </div>

                  <div style={{ marginBottom:"1rem" }}>
                    <label className={styles.label} style={{ display:"block", marginBottom:"0.4rem" }}>Belongings</label>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.5rem" }}>
                      {["Laptop","Bag","Documents","Mobile","Camera","Other"].map(item => (
                        <button key={item} type="button"
                          onClick={() => toggleBelonging(item)}
                          style={{ padding:"0.35rem 0.75rem", borderRadius:"1rem", fontSize:"0.8rem",
                            border: belongings.includes(item) ? "1.5px solid #7c3aed" : "1.5px solid #e5e7eb",
                            background: belongings.includes(item) ? "#ede9fe" : "#fff",
                            color: belongings.includes(item) ? "#7c3aed" : "#6b7280",
                            cursor:"pointer", fontWeight: belongings.includes(item) ? 600 : 400 }}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:"flex", gap:"0.75rem" }}>
                    <button className={styles.prevBtn} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}
                      onClick={handleEditDetails} disabled={submitting}>
                      <IconEdit />
                      Edit Details
                    </button>
                    <button className={styles.nextBtn} style={{ flex:2, display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}
                      onClick={handleIssuePass} disabled={submitting}>
                      {submitting ? "Issuing…" : (
                        <>
                          <IconCheck />
                          Issue Pass
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
