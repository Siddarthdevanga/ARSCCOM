"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./style.module.css";

/* ===============================================
   EMPLOYEE AUTOCOMPLETE
   Drops in as a replacement for the bare
   <input> in the "Person to Meet" field.
   Falls back gracefully to freetext if no slug
   or no matches found.
=============================================== */
const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const EmployeeAutocomplete = ({ slug, value, employeeId, onChange, onSelect }) => {
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef             = useRef(null);
  const containerRef            = useRef(null);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setFetching(true);
    try {
      const res = await fetch(
        `${API}/api/public/visitor/${slug}/employees?q=${encodeURIComponent(q)}`,
        { credentials: "omit" }
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setFetching(false);
    }
  }, [slug]);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    /* Unlink employee when user edits freely */
    if (employeeId) onSelect({ name: val, id: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  };

  const handleSelect = (emp) => {
    onSelect({ name: emp.name, id: emp.id });
    setOpen(false);
    setResults([]);
  };

  const initials = (name) => {
    if (!name) return "?";
    const p = name.trim().split(" ");
    return (p.length >= 2 ? p[0][0] + p[1][0] : p[0][0]).toUpperCase();
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          className={styles.input}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => value.trim() && results.length > 0 && setOpen(true)}
          placeholder="Host name"
          autoComplete="off"
        />
        {/* Spinner while fetching */}
        {fetching && (
          <span style={{
            position: "absolute", right: 14, top: "50%",
            transform: "translateY(-50%)",
            width: 13, height: 13,
            border: "2px solid #ddd2f0", borderTopColor: "#6200d6",
            borderRadius: "50%", display: "inline-block",
            animation: "acSpin 0.7s linear infinite",
            pointerEvents: "none",
          }} />
        )}
        {/* Green tick when an employee is linked */}
        {employeeId && !fetching && (
          <span style={{
            position: "absolute", right: 14, top: "50%",
            transform: "translateY(-50%)",
            fontSize: 13, color: "#00b894", pointerEvents: "none",
          }}>✓</span>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0,
          background: "#fff", borderRadius: 14,
          border: "1.5px solid #ddd2f0",
          boxShadow: "0 8px 32px rgba(98,0,214,0.14)",
          zIndex: 200, overflow: "hidden",
          maxHeight: 220, overflowY: "auto",
        }}>
          {results.map((emp) => (
            <div
              key={emp.id}
              onMouseDown={() => handleSelect(emp)}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "10px 14px", cursor: "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8f5ff"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #7a00ff, #c060ff)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 900,
              }}>
                {initials(emp.name)}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#1a0038" }}>{emp.name}</div>
                {emp.department && (
                  <div style={{ fontSize: 11, color: "#9980c8", fontWeight: 600 }}>{emp.department}</div>
                )}
              </div>
              {employeeId === emp.id && (
                <span style={{ marginLeft: "auto", color: "#00b894", fontWeight: 800, fontSize: 12 }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No-match hint — visitor can still proceed with freetext */}
      {open && results.length === 0 && !fetching && value.trim() && (
        <div style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0,
          background: "#fff", borderRadius: 14,
          border: "1.5px solid #ddd2f0",
          padding: "13px 16px", textAlign: "center",
          fontSize: 12, color: "#b8a8d8", fontWeight: 600,
          zIndex: 200, boxShadow: "0 8px 32px rgba(98,0,214,0.1)",
        }}>
          No employees matched — your entry will still be saved
        </div>
      )}

      <style>{`@keyframes acSpin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  );
};

/* ===============================================
   PAGE COMPONENT
=============================================== */
export default function SecondaryDetails() {
  const router = useRouter();

  const [company,    setCompany]    = useState(null);
  const [isLoading,  setIsLoading]  = useState(true);

  /* Slug needed for the autocomplete API call */
  const [companySlug, setCompanySlug] = useState(null);

  /* Employee linked via autocomplete selection */
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  /* ================= FORM STATE ================= */
  const [form, setForm] = useState({
    fromCompany: "",
    department: "",
    designation: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    personToMeet: "",
    purpose: "",
    belongings: [],
  });

  /* ================= LOAD COMPANY + RESTORE FORM ================= */
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedCompany = localStorage.getItem("company");

      if (!token || !storedCompany) {
        router.replace("/auth/login");
        return;
      }

      const parsed = JSON.parse(storedCompany);
      setCompany(parsed);
      /* slug may live at parsed.slug or parsed.visitor_slug */
      setCompanySlug(parsed.slug || parsed.visitor_slug || null);

      const saved = localStorage.getItem("visitor_secondary");
      if (saved) {
        const parsedSaved = JSON.parse(saved);
        setForm(parsedSaved);
        /* Restore previously linked employee id */
        if (parsedSaved._employeeId) {
          setSelectedEmployeeId(parsedSaved._employeeId);
        }
      }
    } catch (error) {
      console.error("Company context error:", error);
      localStorage.clear();
      router.replace("/auth/login");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading || !company) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  /* ================= HANDLERS ================= */
  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* Autocomplete: user typing freely */
  const handlePersonToMeetChange = (val) => {
    setForm((prev) => ({ ...prev, personToMeet: val }));
  };

  /* Autocomplete: employee selected from dropdown */
  const handleEmployeeSelect = ({ name, id }) => {
    setForm((prev) => ({ ...prev, personToMeet: name }));
    setSelectedEmployeeId(id);
  };

  const toggleBelonging = (item) => {
    setForm((prev) => ({
      ...prev,
      belongings: prev.belongings.includes(item)
        ? prev.belongings.filter((b) => b !== item)
        : [...prev.belongings, item],
    }));
  };

  const goBack = () => router.push("/visitor/primary_details");

  const goNext = () => {
    /*
      Persist form data + the linked employee id under the private _employeeId key.
      The identity/submit page should read _employeeId and include it in the API payload.
    */
    localStorage.setItem(
      "visitor_secondary",
      JSON.stringify({ ...form, _employeeId: selectedEmployeeId })
    );
    router.push("/visitor/identity");
  };

  return (
    <div className={styles.container}>

      {/* ===== HEADER (matches dashboard) ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <img
            src={company.logo_url || "/logo.png"}
            alt="Company Logo"
            className={styles.companyLogo}
          />
          <button className={styles.backBtn} onClick={goBack}>
            ← Back
          </button>
        </div>
      </header>

      {/* ===== SCROLLABLE BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO (purple gradient, step 2 active) ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Secondary <span>Details</span>
          </h1>
          <p className={styles.heroSub}>Additional visitor & visit information</p>

          {/* Step indicator */}
          <div className={styles.steps}>
            <div className={`${styles.step} ${styles.stepDone}`}>
              <span className={styles.stepNum}>✓</span>
              <span className={styles.stepLabel}>Primary</span>
            </div>
            <div className={styles.stepLine} />
            <div className={`${styles.step} ${styles.stepActive}`}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepLabel}>Secondary Details</span>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepLabel}>Identity</span>
            </div>
          </div>
        </section>

        {/* ===== FORM CARD (lite purple) ===== */}
        <main className={styles.mainContent}>
          <div className={styles.formCard}>

            {/* ── Organization Section ── */}
            <div className={styles.sectionHeader}>
              <span className={styles.cardDot} />
              <h3 className={styles.cardTitle}>Organization Info</h3>
            </div>

            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>From Company</label>
                <input
                  className={styles.input}
                  value={form.fromCompany}
                  onChange={(e) => updateField("fromCompany", e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Department</label>
                <input
                  className={styles.input}
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  placeholder="Department"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Designation</label>
                <input
                  className={styles.input}
                  value={form.designation}
                  onChange={(e) => updateField("designation", e.target.value)}
                  placeholder="Designation / Title"
                />
              </div>
            </div>

            {/* ── Address Section ── */}
            <div className={styles.sectionHeader}>
              <span className={`${styles.cardDot} ${styles.cardDotBlue}`} />
              <h3 className={styles.cardTitle}>Address</h3>
            </div>

            <div className={styles.fullRow}>
              <label className={styles.label}>Organization Address</label>
              <input
                className={styles.input}
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Full address"
              />
            </div>

            <div className={styles.row4}>
              <div className={styles.field}>
                <label className={styles.label}>City</label>
                <input
                  className={styles.input}
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>State</label>
                <input
                  className={styles.input}
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Postal Code</label>
                <input
                  className={styles.input}
                  value={form.postalCode}
                  onChange={(e) => updateField("postalCode", e.target.value)}
                  placeholder="PIN / ZIP"
                  inputMode="numeric"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Country</label>
                <input
                  className={styles.input}
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>

            {/* ── Visit Details Section ── */}
            <div className={styles.sectionHeader}>
              <span className={`${styles.cardDot} ${styles.cardDotGreen}`} />
              <h3 className={styles.cardTitle}>Visit Details</h3>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Person to Meet</label>
                {/*
                  Autocomplete when slug is available.
                  Falls back to plain input if slug cannot be resolved
                  (e.g. admin-created visits without a public slug).
                */}
                {companySlug ? (
                  <EmployeeAutocomplete
                    slug={companySlug}
                    value={form.personToMeet}
                    employeeId={selectedEmployeeId}
                    onChange={handlePersonToMeetChange}
                    onSelect={handleEmployeeSelect}
                  />
                ) : (
                  <input
                    className={styles.input}
                    value={form.personToMeet}
                    onChange={(e) => updateField("personToMeet", e.target.value)}
                    placeholder="Host name"
                  />
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Purpose of Visit</label>
                <input
                  className={styles.input}
                  value={form.purpose}
                  onChange={(e) => updateField("purpose", e.target.value)}
                  placeholder="Meeting / Delivery / Interview…"
                />
              </div>
            </div>

            {/* ── Belongings ── */}
            <div className={styles.sectionHeader}>
              <span className={`${styles.cardDot} ${styles.cardDotGold}`} />
              <h3 className={styles.cardTitle}>Belongings</h3>
            </div>

            <div className={styles.checkboxGroup}>
              {["Laptop", "Bag", "Documents", "Mobile", "Camera", "Other"].map(
                (item) => (
                  <label key={item} className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={form.belongings.includes(item)}
                      onChange={() => toggleBelonging(item)}
                    />
                    <span className={styles.checkBox}>
                      {form.belongings.includes(item) && (
                        <span className={styles.checkMark}>✓</span>
                      )}
                    </span>
                    <span className={styles.checkText}>{item}</span>
                  </label>
                )
              )}
            </div>

            {/* ── Buttons ── */}
            <div className={styles.buttonRow}>
              <button className={styles.prevBtn} onClick={goBack}>
                ← Previous
              </button>
              <button className={styles.nextBtn} onClick={goNext}>
                Next →
              </button>
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}
