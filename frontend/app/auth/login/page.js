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
  const [showPassword, setShowPassword] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================================
        LOGIN + STRICT SUBSCRIPTION RULE
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
        body: JSON.stringify({ email: normalizedEmail, password }),
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

      localStorage.setItem("token", token);
      document.cookie = `token=${token}; path=/; SameSite=Lax`;

      if (!company) {
        setError("Company not found. Redirecting to registration...");
        setTimeout(() => router.replace("/auth/register"), 1200);
        return;
      }

      localStorage.setItem("company", JSON.stringify(company));

      const status = company?.subscription_status?.toLowerCase() || "pending";
      console.log("SUBSCRIPTION STATUS →", status);

      /* ======================================================
            STRICT RULE
            Active / Trial  → /home
            Everything else → /auth/subscription
      ====================================================== */
      if (["active", "trial"].includes(status)) {
        router.replace("/home");
        return;
      }

      router.replace("/auth/subscription");
      return;

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
            src="/Brand Logo.png"
            alt="promeet"
            width={420}
            height={140}
            priority
            className={styles.brandLogo}
          />
        </div>

        {/* NAV BUTTONS */}
        <div className={styles.nav}>
          <button onClick={() => setActiveTab("about")}>ABOUT</button>
          <button onClick={() => setActiveTab("plans")}>PLANS</button>
          <button onClick={() => setActiveTab("contact")}>CONTACT</button>
        </div>
      </header>

      {/* ABOUT SECTION */}
      {activeTab === "about" && (
        <div className={styles.dropdownBox}>
          <h2>About Our Platform</h2>
          <p>
            Promeet is a secure Visitor & Conference Management Platform
            designed to digitalize visitor flow, improve security, and enhance
            organizational efficiency.
          </p>
          <p>
            Manage visitors, schedule meetings, track conference rooms, and
            maintain complete control — all in one place.
          </p>

          <button className={styles.closeBtn} onClick={() => setActiveTab(null)}>
            Close
          </button>
        </div>
      )}

      {/* PLANS SECTION */}
      {activeTab === "plans" && (
        <div className={styles.dropdownBox}>
          <h2>Subscription Plans</h2>

          <div className={styles.planContainer}>
            {/* FREE PLAN */}
            <div className={styles.planCard}>
              <h3>TRIAL</h3>
              <h2>₹49 / 15 DAYS</h2>
              <ul>
                <li>✔ Valid 15 Days</li>
                <li>✔ 100 Visitor Bookings</li>
                <li>✔ 100 Conference Bookings</li>
                <li>✔ 2 Conference Rooms</li>
              </ul>
              <Link href="/auth/register">
                <button className={styles.planBtn}>Enroll Now</button>
              </Link>
            </div>

            {/* BUSINESS PLAN */}
            <div className={styles.planCard}>
              <h3>BUSINESS</h3>
              <h2>₹500 / Month</h2>
              <ul>
                <li>✔ Unlimited Visitors</li>
                <li>✔ 1000 Conference bookings</li>
                <li>✔ 6 Conference Rooms</li>
                <li>✔ Dedicated Support</li>
              </ul>
              <Link href="/auth/register">
                <button className={styles.planBtn}>Enroll Now</button>
              </Link>
            </div>

            {/* ENTERPRISE */}
            <div className={styles.planCard}>
              <h3>ENTERPRISE</h3>
              <h2>Custom Pricing</h2>
              <ul>
                <li>✔ Unlimited Visitors</li>
                <li>✔ Unlimited Conference Bookings</li>
                <li>✔ Unlimited Conference Rooms</li>
                <li>✔ Dedicated Support</li>
              </ul>
              <Link href="/auth/contact-us">
                <button className={styles.planBtn}>Contact Us</button>
              </Link>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={() => setActiveTab(null)}>
            Close
          </button>
        </div>
      )}

      {/* CONTACT SECTION */}
      {activeTab === "contact" && (
        <div className={styles.dropdownBox}>
          <h2>Contact Us</h2>
          <p>Email: admin@wheelbrand.in</p>
          <p>Phone: 8647878785</p>
          <p>We are happy to support you.</p>

          <button className={styles.closeBtn} onClick={() => setActiveTab(null)}>
            Close
          </button>
        </div>
      )}

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
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: "45px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  fontSize: "18px",
                  opacity: loading ? 0.5 : 1,
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  // Eye slash icon (password visible)
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  // Eye icon (password hidden)
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
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
