"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./style.module.css";

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Email comes from forgot-password redirect
  const email = (searchParams.get("email") || "").trim();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    /* ================= VALIDATION ================= */
    if (!email) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    if (!code.trim() || !password.trim() || !confirm.trim()) {
      setError("All fields are required");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    /* ================= API ================= */
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/reset-password`,
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

      router.push("/auth/login");

    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* BRAND */}
      <div className={styles.brand}>ARSCCOM</div>

      {/* CARD */}
      <div className={styles.card}>
        <h2 className={styles.title}>Reset Password</h2>
        <p className={styles.subtitle}>
          Enter the code sent to <b>{email || "your email"}</b>
        </p>

        {error && <div className={styles.error}>{error}</div>}

        {/* RESET CODE */}
        <label className={styles.label}>Reset Code</label>
        <input
          className={styles.input}
          placeholder="Enter reset code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={loading}
        />

        {/* PASSWORD ROW */}
        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>New Password</label>
            <input
              type="password"
              className={styles.input}
              placeholder="New password"
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
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* SUBMIT */}
        <button
          className={styles.button}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {/* BACK */}
        <div
          className={styles.back}
          onClick={() => router.push("/auth/login")}
        >
          ← Back to Login
        </div>
      </div>
    </div>
  );
}
