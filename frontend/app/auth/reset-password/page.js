"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   INNER COMPONENT
====================================================== */
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
  const [resendLoading, setResendLoading] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [waitSeconds, setWaitSeconds] = useState(0);

  /* ================= TIMER ================= */
  useEffect(() => {
    if (!waitSeconds) return;

    const timer = setInterval(() => {
      setWaitSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [waitSeconds]);

  /* ================= RESET PASSWORD ================= */
  const handleSubmit = async () => {
    setError("");
    setInfo("");

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

      setInfo("Password reset successful! Redirecting to login...");

      setTimeout(() => {
        router.replace("/login");
      }, 3000);

    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RESEND RESET CODE ================= */
  const handleResend = async () => {
    if (!email) return;

    setError("");
    setInfo("");
    setResendLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      const data = await res.json();

      if (data.waitSeconds) {
        setWaitSeconds(data.waitSeconds);
      }

      if (data.sent) {
        setInfo("Reset code sent successfully");
      } else {
        setInfo("Please wait before requesting again");
      }

    } catch {
      setError("Failed to resend code");
    } finally {
      setResendLoading(false);
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
        {info && <div className={styles.success}>{info}</div>}

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

        {/* ================= RESEND SECTION ================= */}
        <div style={{ marginTop: 18 }}>
          {waitSeconds > 0 ? (
            <div className={styles.info}>
              Resend available in <b>{waitSeconds}</b> seconds
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className={styles.linkButton}
            >
              {resendLoading ? "Sending..." : "Resend Reset Code"}
            </button>
          )}
        </div>

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

/* ======================================================
   PAGE EXPORT (Suspense wrapper)
====================================================== */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ color: "white", padding: 40 }}>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
