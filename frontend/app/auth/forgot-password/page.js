"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Registered email is required");
      return;
    }

    setLoading(true);
    try {
      /* ── 1. Try superadmin endpoint first ── */
      const saRes = await fetch(`${API_BASE}/api/superadmin/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const saData = await saRes.json();

      if (saRes.ok && saData.success) {
        setSuccess("If the email exists, a reset code has been sent.");
        setTimeout(() => {
          router.push(`/auth/reset-password?email=${encodeURIComponent(normalizedEmail)}&type=superadmin`);
        }, 1500);
        return;
      }

      /* ── 2. Fall through to regular user ── */
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const contentType = res.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || "Server returned an invalid response");
      }

      if (!res.ok) throw new Error(data.message || "Unable to process request");

      setSuccess("If the email exists, a reset code has been sent.");
      setTimeout(() => {
        router.push(`/auth/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
      }, 1500);

    } catch (err) {
      setError(err.message || "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>PROMEET</div>
        </div>
        <div className={styles.rightHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/auth/login")}>← Back</button>
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Forgot <span>Password</span></h1>
          <p className={styles.heroSub}>Enter your registered email to receive a reset code</p>
        </section>

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>
          <div className={styles.formCard}>

            <div className={styles.sectionHeader}>
              <span className={styles.cardDot} />
              <h3 className={styles.cardTitle}>Reset Your Password</h3>
            </div>

            <div className={styles.lockIcon}>🔐</div>

            {error && <div className={styles.errorBox}>{error}</div>}
            {success && <div className={styles.successBox}>✓ {success}</div>}

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email Address *</label>
              <input
                className={styles.input}
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <><span className={styles.btnSpinner} /> Sending…</>
              ) : (
                "Send Reset Code"
              )}
            </button>

            <div className={styles.backLink} onClick={() => router.push("/auth/login")}>
              ← Back to Login
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
