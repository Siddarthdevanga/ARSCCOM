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

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Registered email is required");
      return;
    }

    if (loading) return; // prevent double submit
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email: normalizedEmail })
        }
      );

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned an invalid response");
      }

      if (!res.ok) {
        throw new Error(data?.message || "Unable to process request");
      }

      // Security-safe success message
      setSuccess("If the email exists, a reset code has been sent.");

      setTimeout(() => {
        router.push(`/reset_password?email=${encodeURIComponent(normalizedEmail)}`);
      }, 1500);

    } catch (err) {
      setError(err.message || "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* HEADER */}
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
            type="email"
            className={styles.input}
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
            onClick={() => router.push("/login")}
          >
            ← Back to Login
          </div>
        </div>
      </div>
    </div>
  );
}
