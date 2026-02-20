"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./style.module.css";

export default function SecondaryDetails() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

      setCompany(JSON.parse(storedCompany));

      const saved = localStorage.getItem("visitor_secondary");
      if (saved) {
        setForm(JSON.parse(saved));
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
    localStorage.setItem("visitor_secondary", JSON.stringify(form));
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
                <input
                  className={styles.input}
                  value={form.personToMeet}
                  onChange={(e) => updateField("personToMeet", e.target.value)}
                  placeholder="Host name"
                />
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
