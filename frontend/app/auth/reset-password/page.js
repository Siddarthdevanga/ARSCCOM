"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./style.module.css";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = useMemo(
    () => (searchParams.get("email") || "").trim(),
    [searchParams]
  );

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ================= TIMER ================= */
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  /* ================= RESEND CODE ================= */
  const resendCode = async () => {
    if (!email) return;

    setError("");
    setSuccess("");
    setSeconds(30);

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      setSuccess("A new reset code has been sent to your email.");
    } catch {
      setError("Failed to resend reset code. Try again later.");
    }
  };

  /* ================= RESET PASSWORD ================= */
  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!email) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }

    if (!code || !password || !confirm) {
      setError("All fields are required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            code: code.trim(),
            password: password.trim(),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to reset password");

      setSuccess("Password reset successful! Redirecting to login...");
      setTimeout(() => router.replace("/auth/login"), 3000);
    } catch (err) {
      setError(err.message || "Something went wrong");
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
          <button className={styles.backBtn} onClick={() => router.replace("/auth/login")}>
            ← Back
          </button>
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Reset <span>Password</span></h1>
          <p className={styles.heroSub}>
            Enter the code sent to <strong>{email || "your email"}</strong>
          </p>
        </section>

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>
          <div className={styles.formCard}>

            {/* Section header */}
            <div className={styles.sectionHeader}>
              <span className={styles.cardDot} />
              <h3 className={styles.cardTitle}>Enter Reset Code</h3>
            </div>

            {/* Messages */}
            {error && <div className={styles.errorBox}>{error}</div>}
            {success && <div className={styles.successBox}>{success}</div>}

            {/* Timer */}
            <div className={`${styles.timerBar} ${seconds > 0 ? styles.timerWaiting : styles.timerReady}`}>
              <span className={styles.timerDot} />
              {seconds > 0
                ? `Please wait ${seconds}s before requesting again`
                : "You can request a new reset code"}
            </div>

            {/* Reset Code */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reset Code *</label>
              <input
                className={styles.input}
                placeholder="Enter reset code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Password Row */}
            <div className={styles.passwordRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>New Password *</label>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Confirm Password *</label>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <><span className={styles.btnSpinner} /> Updating...</>
              ) : (
                "Update Password"
              )}
            </button>

            {/* Resend */}
            <button
              className={styles.resendBtn}
              onClick={resendCode}
              disabled={seconds > 0}
            >
              Resend Reset Code
            </button>

            {/* Back link */}
            <div className={styles.backLink} onClick={() => router.replace("/auth/login")}>
              ← Back to Login
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.loadingState}>Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
