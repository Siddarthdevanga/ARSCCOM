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
    setCompany(JSON.parse(storedCompany));
    setLoading(false);
  }, [router]);

  if (loading || !company) return null;

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

  return (
    <div className={styles.page}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.companyName}>{company.name}</div>
        <img
          src={company.logo_url || "/logo.png"}
          alt="Company Logo"
          className={styles.logo}
        />
      </header>

      {/* ================= CENTER ================= */}
      <main className={styles.center}>
        <div className={styles.card}>
          <h2 className={styles.title}>Visitor Primary Details</h2>
          <p className={styles.subtitle}>
            Please enter basic visitor information
          </p>

          {error && <div className={styles.error}>{error}</div>}

          <label className={styles.label}>Name *</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Visitor name"
            autoComplete="off"
          />

          {/* PHONE + EMAIL SAME LINE */}
          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>Phone *</label>
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
              <label className={styles.label}>Email *</label>
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
  );
}
