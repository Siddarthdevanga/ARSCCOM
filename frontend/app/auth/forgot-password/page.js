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

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Registered email is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Unable to process request");
      }

      // Security-safe success
      setSuccess("If the email exists, a reset code has been sent.");

      setTimeout(() => {
        router.push(`/auth/reset-password?email=${email.trim()}`);
      }, 1500);

    } catch (err) {
      setError(err.message || "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>

      {/* BRAND */}
      <div className={styles.header}>
        <div className={styles.brand}>ARSCCOM</div>
      </div>

      {/* CENTER */}
      <div className={styles.center}>
        <div className={styles.card}>

          <h2 className={styles.title}>Forgot Password</h2>
          <p className={styles.subtitle}>
            Enter your registered email to receive a reset code
          </p>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <label className={styles.label}>Email Address</label>
          <input
            className={styles.input}
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <button
            className={styles.button}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Code"}
          </button>

          <div
            className={styles.back}
            onClick={() => router.push("/auth/login")}
          >
            ← Back to Login
          </div>

        </div>
      </div>

    </div>
  );
}
