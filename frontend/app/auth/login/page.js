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

  /* ======================================================
      LOGIN HANDLER WITH SUBSCRIPTION VALIDATION
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Invalid credentials");
        return;
      }

      // Store token
      localStorage.setItem("token", data.token);
      document.cookie = `token=${data.token}; path=/`;

      const company = data.company || null;

      /* ============================
          NO COMPANY REGISTRATION
      ============================ */
      if (!company) {
        setError(
          "Your organization is not registered yet. Please register first."
        );

        setTimeout(() => {
          router.replace("/auth/register");
        }, 1500);

        return;
      }

      localStorage.setItem("company", JSON.stringify(company));

      const status =
        company.subscription_status?.toLowerCase() || "none";

      console.log("SUBSCRIPTION STATUS:", status);

      /* ============================
          SUBSCRIPTION STATUS LOGIC
      ============================ */

      // never subscribed / payment pending
      if (status === "none" || status === "pending") {
        setError(
          "Your subscription is not active. Please subscribe to continue."
        );

        setTimeout(() => {
          router.replace("/auth/subscription");
        }, 1500);

        return;
      }

      // expired / cancelled
      if (["expired", "cancelled", "canceled"].includes(status)) {
        setError("Your subscription has expired. Please renew to continue.");

        setTimeout(() => {
          router.replace("/auth/subscription");
        }, 1500);

        return;
      }

      // active or trial -> allow login
      if (["active", "trial"].includes(status)) {
        router.replace("/home");
        return;
      }

      // fallback → subscription page
      setError("Please activate your subscription to continue.");

      setTimeout(() => {
        router.replace("/auth/subscription");
      }, 1500);
    } catch (err) {
      console.error(err);
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.brandSection}>
          <div className={styles.logoText}>VISITOR MANAGEMENT PLATFORM</div>

          <Image
            src="/Promeet Logo.png"
            alt="Promeet Logo"
            width={420}
            height={140}
            priority
            className={styles.brandLogo}
          />
        </div>

        {/* TOP RIGHT NAV */}
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
