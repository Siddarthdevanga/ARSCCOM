"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   INNER COMPONENT (uses useSearchParams)
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
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

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

      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      router.replace("/login");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.brand}>ARSCCOM</div>

      <div className={styles.card}>
        <h2 className={styles.title}>Reset Password</h2>

        <p className={styles.subtitle}>
          Enter the code sent to <b>{email || "your email"}</b>
        </p>

        {error && <div className={styles.error}>{error}</div>}

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

        <div
          className={styles.back}
          onClick={() => router.replace("auth/login")}
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
