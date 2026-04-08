"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./style.module.css";

export default function VisitorPrimaryDetails() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  /* ================= LOAD COMPANY & PREVIOUS DATA ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");
    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }
    try {
      setCompany(JSON.parse(storedCompany));
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
      return;
    }

    // Restore name/email when user navigates back from step 2.
    // Phone is intentionally never restored — it must always be entered fresh.
    const storedPrimary = localStorage.getItem("visitor_primary");
    if (storedPrimary) {
      try {
        const data = JSON.parse(storedPrimary);
        if (data.name)  setName(data.name);
        if (data.email) setEmail(data.email);
      } catch (err) {
        console.warn("[PRIMARY_DETAILS] Failed to load stored data:", err);
      }
    }

    setLoading(false);
  }, [router]);

  /* ================= NEXT ================= */
  const handleNext = () => {
    setError("");
    if (!name.trim()) {
      setError("Visitor name is required");
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g,"").length !== 10) {
      setError("Valid 10-digit WhatsApp number is required");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Valid email address is required");
      return;
    }
    localStorage.setItem(
      "visitor_primary",
      JSON.stringify({ name, phone: `91${phone}`, email })
    );
    router.push("/visitor/secondary_details");
  };

  if (loading || !company) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* ===== HEADER (matches dashboard) ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <img
            src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`}
            alt="Company Logo"
            className={styles.companyLogo}
            onError={e => { e.currentTarget.style.display = "none"; }}
          />
          <button className={styles.backBtn} onClick={() => router.push("/visitor/dashboard")}>
            ← Back
          </button>
        </div>
      </header>

      {/* ===== SCROLLABLE BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO (purple gradient, compact) ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            New <span>Visitor</span>
          </h1>
          <p className={styles.heroSub}>Enter primary details to register a visitor</p>

          {/* Step indicator */}
          <div className={styles.steps}>
            <div className={`${styles.step} ${styles.stepActive}`}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepLabel}>Primary Details</span>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepLabel}>Secondary Details</span>
            </div>
          </div>
        </section>

        {/* ===== FORM CARD (lite purple, matches dashboard cards) ===== */}
        <main className={styles.mainContent}>
          <div className={styles.formCard}>

            <div className={styles.cardHeader}>
              <span className={styles.cardDot} />
              <h3 className={styles.cardTitle}>Primary Information</h3>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.formGroup}>
              <label className={styles.label}>Full Name <span className={styles.req}>*</span></label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter visitor's full name"
                autoComplete="off"
              />
            </div>

            <div className={styles.row}>
              <div className={styles.col}>
                <label className={styles.label}>WhatsApp Number <span className={styles.req}>*</span></label>
                <div style={{ display:"flex", gap:"0.5rem", alignItems:"stretch" }}>
                  <div style={{ padding:"0.75rem 1rem", background:"#f3f4f6", border:"1px solid #d1d5db", borderRadius:"0.5rem", fontWeight:"600", color:"#374151", fontSize:"0.95rem", display:"flex", alignItems:"center" }}>
                    +91
                  </div>
                  <input
                    className={styles.input}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
                    placeholder="Enter 10-digit number"
                    autoComplete="new-password"
                    inputMode="numeric"
                    maxLength={10}
                    style={{ flex:1, margin:0 }}
                  />
                </div>
                <p style={{ fontSize:"0.75rem", color:"#6b7280", marginTop:"0.25rem", marginBottom:0 }}>
                  Enter 10-digit mobile number
                </p>
              </div>
              <div className={styles.col}>
                <label className={styles.label}>Email <span className={styles.req}>*</span></label>
                <input
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="off"
                  inputMode="email"
                />
              </div>
            </div>

            <button className={styles.nextBtn} onClick={handleNext}>
              Next →
            </button>

          </div>
        </main>

      </div>
    </div>
  );
}
