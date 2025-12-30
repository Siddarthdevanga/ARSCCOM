"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================================
        LOGIN HANDLER + SUBSCRIPTION LOGIC
  ====================================================== */
  const handleLogin = async () => {
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Email and password are required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Invalid email or password");
        return;
      }

      const token = data?.token;
      const company = data?.company;

      if (!token) {
        setError("Authentication failed. Please try again.");
        return;
      }

      /* ============================
          SAVE SESSION
      ============================ */
      localStorage.setItem("token", token);
      document.cookie = `token=${token}; path=/; SameSite=Lax`;

      if (!company) {
        setError("Company not found. Redirecting to registration...");
        setTimeout(() => router.replace("/auth/register"), 1200);
        return;
      }

      localStorage.setItem("company", JSON.stringify(company));

      const status = company?.subscription_status?.toLowerCase() || "pending";
      console.log("SUBSCRIPTION STATUS:", status);

      /* ==================================================
            SUBSCRIPTION REDIRECT RULES
      =================================================== */

      // 1️⃣ Not subscribed / payment not done yet
      if (["none", "pending"].includes(status)) {
        router.replace("/auth/subscription");
        return;
      }

      // 2️⃣ Expired / cancelled → push back to subscription
      if (["expired", "cancelled", "canceled"].includes(status)) {
        setError("Your subscription is inactive. Please renew.");
        setTimeout(() => router.replace("/auth/subscription"), 1000);
        return;
      }

      // 3️⃣ Active or Trial → Welcome 🎉
      if (["active", "trial"].includes(status)) {
        router.replace("/home");
        return;
      }

      // Fallback
      router.replace("/auth/subscription");

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.brandSection}>
          <div className={styles.logoText}>
            VISITOR MANAGEMENT PLATFORM
          </div>

          <Image
            src="/Promeet Logo.png"
            alt="Promeet Logo"
            width={420}
            height={140}
            priority
            className={styles.brandLogo}
          />
        </div>

        <div className={styles.nav}>
          <button onClick={() => setActiveTab("about")}>ABOUT</button>
          <button onClick={() => setActiveTab("plans")}>PLANS</button>
          <button onClick={() => setActiveTab("contact")}>CONTACT</button>
        </div>
      </header>

      {/* LOGIN CARD */}
      <main className={styles.loginWrapper}>
        <div className={styles.loginCard}>
          <h4>LOGIN TO YOUR ACCOUNT</h4>

          <div className={styles.inputGroup}>
            <label>Email</label>
            <input
              type="email"
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Password</label>
            <input
              type="password"
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p
              style={{
                color: "#ff3333",
                background: "rgba(255,0,0,.15)",
                padding: "8px",
                borderRadius: "6px",
                textAlign: "center",
                marginTop: "6px",
                fontSize: "13px",
              }}
            >
              {error}
            </p>
          )}

          <button
            className={styles.loginBtn}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Logging in..." : "LOGIN"}
          </button>

          <div className={styles.extraLinks}>
            <Link href="/auth/forgot-password">Forgot Password?</Link>
            <span> | </span>
            <Link href="/auth/register">New Registration</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
