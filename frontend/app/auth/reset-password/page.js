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
          body: JSON.stringify({ email })
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
            password: password.trim()
          })
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
    <div className={styles.page}>
      <div className={styles.brand}>PROMEET</div>

      <div className={styles.card}>
        <h2 className={styles.title}>Reset Password</h2>

        <p className={styles.subtitle}>
          Enter the code sent to <b>{email || "your email"}</b>
        </p>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {/* TIMER MESSAGE */}
        <p className={`${styles.info} ${seconds > 0 ? styles.waiting : ""}`}>
          {seconds > 0
            ? `Please wait ${seconds} seconds before requesting again`
            : "You can request a new reset code"}
        </p>

        <label className={styles.label}>Reset Code</label>
        <input
          className={styles.input}
          placeholder="Enter reset code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={loading}
        />

        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>New Password</label>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.col}>
            <label className={styles.label}>Confirm Password</label>
            <input
              type="password"
              className={styles.input}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <button
          className={styles.button}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {/* RESEND BUTTON */}
        <button
          className={styles.resendBtn}
          onClick={resendCode}
          disabled={seconds > 0}
        >
          Resend Reset Code
        </button>

        <div
          className={styles.back}
          onClick={() => router.replace("/auth/login")}
        >
          ← Back to Login
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ color: "white", padding: 40 }}>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
