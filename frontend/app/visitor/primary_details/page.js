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

  /* ================= LOAD COMPANY ================= */
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
    setLoading(false);
  }, [router]);

  /* ================= NEXT ================= */
  const handleNext = () => {
    setError("");
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError("All fields are mandatory");
      return;
    }
    localStorage.setItem(
      "visitor_primary",
      JSON.stringify({ name, phone, email })
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
            src={company.logo_url || "/logo.png"}
            alt="Company Logo"
            className={styles.companyLogo}
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
                <label className={styles.label}>Phone <span className={styles.req}>*</span></label>
                <input
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  autoComplete="off"
                  inputMode="tel"
                />
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
