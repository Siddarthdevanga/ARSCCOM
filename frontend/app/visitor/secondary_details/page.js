"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/* ─────────────────────────────────────────────────────────────────
   EMPLOYEE AUTOCOMPLETE — ADMIN FLOW

   KEY FIX: Always render inside a plain formGroup div, NEVER
   directly inside a gridRow. CSS Grid items use the grid container
   as the offsetParent, causing position:absolute children to
   measure from the wrong origin on mobile Safari.
───────────────────────────────────────────────────────────────── */
const EmployeeAutocomplete = ({ value, employeeId, onChange, onSelect }) => {
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [fetching, setFetching] = useState(false);

  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setFetching(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API}/api/employees?search=${encodeURIComponent(q)}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) { setResults([]); setOpen(true); return; }
      const data = await res.json();
      const raw = Array.isArray(data) ? data
        : Array.isArray(data?.employees) ? data.employees
        : Array.isArray(data?.data)      ? data.data
        : Array.isArray(data?.items)     ? data.items
        : [];
      setResults(raw.filter((e) => e.is_active !== false));
      setOpen(true);
    } catch {
      setResults([]); setOpen(true);
    } finally {
      setFetching(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (employeeId) onSelect({ name: val, id: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  };

  const handleSelect = (emp) => {
    onSelect({ name: emp.name, id: emp.id });
    setOpen(false); setResults([]);
  };

  const initials = (name) => {
    if (!name) return "?";
    const p = name.trim().split(" ");
    return (p.length >= 2 ? p[0][0] + p[1][0] : p[0][0]).toUpperCase();
  };

  const showDropdown = open && (results.length > 0 || (!fetching && value.trim()));

  return (
    <div ref={containerRef} className={styles.acWrapper}>
      <input
        className={`${styles.input} ${employeeId ? styles.acInputLinked : ""}`}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => { if (value.trim() && results.length > 0) setOpen(true); }}
        placeholder="Host name"
        autoComplete="off"
      />

      {fetching && <span className={styles.acSpinner} aria-hidden="true" />}
      {employeeId && !fetching && <span className={styles.acLinkedTick} aria-label="Linked">✓</span>}

      {showDropdown && (
        <div className={styles.acDropdown} role="listbox">
          {results.length > 0 ? results.map((emp) => (
            <div key={emp.id} className={styles.acItem}
              onMouseDown={() => handleSelect(emp)}
              role="option" aria-selected={employeeId === emp.id} tabIndex={-1}>
              <div className={styles.acAvatar} aria-hidden="true">{initials(emp.name)}</div>
              <div className={styles.acInfo}>
                <div className={styles.acName}>{emp.name}</div>
                {emp.department && <div className={styles.acDeptBadge}>{emp.department}</div>}
              </div>
              {employeeId === emp.id && <span className={styles.acTick}>✓</span>}
            </div>
          )) : (
            <div className={styles.acEmpty} role="status">
              No employees matched — your entry will still be saved
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════ */
export default function SecondaryDetails() {
  const router = useRouter();

  const [company,   setCompany]   = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const [form, setForm] = useState({
    fromCompany:"", department:"", designation:"",
    address:"", city:"", state:"", postalCode:"", country:"",
    personToMeet:"", purpose:"", belongings:[],
  });

  useEffect(() => {
    try {
      const token         = localStorage.getItem("token");
      const storedCompany = localStorage.getItem("company");
      if (!token || !storedCompany) { router.replace("/auth/login"); return; }
      setCompany(JSON.parse(storedCompany));
      const saved = localStorage.getItem("visitor_secondary");
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm(parsed);
        if (parsed._employeeId) setSelectedEmployeeId(parsed._employeeId);
      }
    } catch {
      localStorage.clear(); router.replace("/auth/login");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading || !company) return (
    <div className={styles.container}>
      <div className={styles.loading}>Loading…</div>
    </div>
  );

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleBelonging = (item) => setForm((prev) => ({
    ...prev,
    belongings: prev.belongings.includes(item)
      ? prev.belongings.filter((b) => b !== item)
      : [...prev.belongings, item],
  }));

  const goBack = () => router.push("/visitor/primary_details");

  const goNext = () => {
    localStorage.setItem("visitor_secondary", JSON.stringify({ ...form, _employeeId: selectedEmployeeId }));
    router.push("/visitor/identity");
  };

  return (
    <div className={styles.container}>

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <img src={company.logo_url || "/logo.png"} alt="Logo" className={styles.companyLogo} />
          <button className={styles.backBtn} onClick={goBack}>← Back</button>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Secondary <span>Details</span></h1>
          <p className={styles.heroSub}>Additional visitor &amp; visit information</p>
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

        <main className={styles.mainContent}>
          <div className={styles.formCard}>

            {/* Organisation */}
            <div className={styles.sectionHeader}>
              <span className={styles.cardDot} />
              <h3 className={styles.cardTitle}>Organization Info</h3>
            </div>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>From Company</label>
                <input className={styles.input} value={form.fromCompany}
                  onChange={(e) => updateField("fromCompany", e.target.value)} placeholder="Company name" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Department</label>
                <input className={styles.input} value={form.department}
                  onChange={(e) => updateField("department", e.target.value)} placeholder="Department" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Designation</label>
                <input className={styles.input} value={form.designation}
                  onChange={(e) => updateField("designation", e.target.value)} placeholder="Designation" />
              </div>
            </div>

            {/* Address */}
            <div className={styles.sectionHeader}>
              <span className={`${styles.cardDot} ${styles.cardDotBlue}`} />
              <h3 className={styles.cardTitle}>Address</h3>
            </div>
            <div className={styles.fullRow}>
              <label className={styles.label}>Organization Address</label>
              <input className={styles.input} value={form.address}
                onChange={(e) => updateField("address", e.target.value)} placeholder="Full address" />
            </div>
            <div className={styles.row4}>
              <div className={styles.field}>
                <label className={styles.label}>City</label>
                <input className={styles.input} value={form.city}
                  onChange={(e) => updateField("city", e.target.value)} placeholder="City" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>State</label>
                <input className={styles.input} value={form.state}
                  onChange={(e) => updateField("state", e.target.value)} placeholder="State" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Postal Code</label>
                <input className={styles.input} value={form.postalCode}
                  onChange={(e) => updateField("postalCode", e.target.value)} placeholder="PIN / ZIP" inputMode="numeric" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Country</label>
                <input className={styles.input} value={form.country}
                  onChange={(e) => updateField("country", e.target.value)} placeholder="Country" />
              </div>
            </div>

            {/* Visit Details */}
            <div className={styles.sectionHeader}>
              <span className={`${styles.cardDot} ${styles.cardDotGreen}`} />
              <h3 className={styles.cardTitle}>Visit Details</h3>
            </div>

            {/*
              CRITICAL: EmployeeAutocomplete is in its OWN field div,
              NOT inside row2/row3/row4 grid containers.
              The position:absolute dropdown only works correctly relative
              to a plain block element — grid items misplace it on mobile.
            */}
            <div className={styles.fullRow}>
              <label className={styles.label}>Person to Meet</label>
              <EmployeeAutocomplete
                value={form.personToMeet}
                employeeId={selectedEmployeeId}
                onChange={(val) => updateField("personToMeet", val)}
                onSelect={({ name, id }) => {
                  updateField("personToMeet", name);
                  setSelectedEmployeeId(id);
                }}
              />
            </div>

            <div className={styles.fullRow} style={{ marginTop:"0.75rem" }}>
              <label className={styles.label}>Purpose of Visit</label>
              <input className={styles.input} value={form.purpose}
                onChange={(e) => updateField("purpose", e.target.value)}
                placeholder="Meeting / Delivery / Interview…" />
            </div>

            {/* Belongings */}
            <div className={styles.sectionHeader} style={{ marginTop:"1rem" }}>
              <span className={`${styles.cardDot} ${styles.cardDotGold}`} />
              <h3 className={styles.cardTitle}>Belongings</h3>
            </div>
            <div className={styles.checkboxGroup}>
              {["Laptop", "Bag", "Documents", "Mobile", "Camera", "Other"].map((item) => (
                <label key={item} className={styles.checkLabel}>
                  <input type="checkbox" className={styles.checkbox}
                    checked={form.belongings.includes(item)} onChange={() => toggleBelonging(item)} />
                  <span className={styles.checkBox}>
                    {form.belongings.includes(item) && <span className={styles.checkMark}>✓</span>}
                  </span>
                  <span className={styles.checkText}>{item}</span>
                </label>
              ))}
            </div>

            <div className={styles.buttonRow}>
              <button className={styles.prevBtn} onClick={goBack}>← Previous</button>
              <button className={styles.nextBtn} onClick={goNext}>Next →</button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
