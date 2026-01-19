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
  const [isRedirecting, setIsRedirecting] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================================
        LOGIN + STRICT SUBSCRIPTION RULE
  ====================================================== */
  const handleLogin = async () => {
    if (loading || isRedirecting) return;

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

      const { token, company } = data;

      if (!token) {
        setError("Authentication failed. Please try again.");
        return;
      }

      // Store authentication
      localStorage.setItem("token", token);
      document.cookie = `token=${token}; path=/; SameSite=Lax`;

      if (!company) {
        setError("Company not found. Redirecting to registration...");
        setIsRedirecting(true);
        setTimeout(() => router.replace("/auth/register"), 1500);
        return;
      }

      localStorage.setItem("company", JSON.stringify(company));

      const status = company?.subscription_status?.toLowerCase() || "pending";
      console.log("SUBSCRIPTION STATUS →", status);

      /* ======================================================
            SUBSCRIPTION-BASED ROUTING
      ====================================================== */
      // Active or trial subscription - proceed to home
      if (["active", "trial"].includes(status)) {
        const successMessage = status === "trial" 
          ? "Login successful! Welcome to your trial period." 
          : "Login successful! Welcome back.";
        
        setError(successMessage);
        setIsRedirecting(true);
        setTimeout(() => router.replace("/home"), 800);
        return;
      }

      // Expired subscription - redirect to subscription page
      if (status === "expired") {
        setError("Your subscription has expired. Redirecting to renew...");
        setIsRedirecting(true);
        setTimeout(() => router.replace("/auth/subscription"), 1500);
        return;
      }

      // Pending or other status - redirect to subscription page
      setError("Account setup required. Redirecting to subscription page...");
      setIsRedirecting(true);
      setTimeout(() => router.replace("/auth/subscription"), 1500);

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading && !isRedirecting) {
      handleLogin();
    }
  };

  // Helper to check if message is success
  const isSuccessMessage = (msg) => {
    return msg.includes("successful") || msg.includes("Welcome");
  };

  // Prevent interactions during loading/redirecting
  const isDisabled = loading || isRedirecting;

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
            {/* TRIAL PLAN */}
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
          <p>Email: admin@promeet.zodopt.com</p>
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
              disabled={isDisabled}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              autoComplete="email"
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Password</label>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showPassword ? "text" : "password"}
                disabled={isDisabled}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                autoComplete="current-password"
                style={{ 
                  paddingRight: "45px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              />
              {password && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isDisabled}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: isDisabled ? "default" : "pointer",
                    padding: "5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                    fontSize: "18px",
                    opacity: isDisabled ? 0.5 : 1,
                    transition: "opacity 0.2s, color 0.2s",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled) e.currentTarget.style.color = "#333";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#666";
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
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
              )}
            </div>
          </div>

          {error && (
            <div
              style={{
                color: isSuccessMessage(error) ? "#00c853" : "#ff3333",
                background: isSuccessMessage(error)
                  ? "rgba(0, 200, 83, 0.15)" 
                  : "rgba(255, 0, 0, 0.15)",
                padding: "10px 12px",
                borderRadius: "8px",
                textAlign: "center",
                marginTop: "8px",
                fontSize: "14px",
                fontWeight: "500",
                border: isSuccessMessage(error)
                  ? "1px solid rgba(0, 200, 83, 0.3)"
                  : "1px solid rgba(255, 51, 51, 0.3)",
              }}
            >
              {isRedirecting && (
                <span style={{ marginRight: "8px" }}>
                  {isSuccessMessage(error) ? "✅" : "⏳"}
                </span>
              )}
              {error}
            </div>
          )}

          <button
            className={styles.loginBtn}
            onClick={handleLogin}
            disabled={isDisabled}
            style={{
              opacity: isDisabled ? 0.7 : 1,
              cursor: isDisabled ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {loading 
              ? "Logging in..." 
              : isRedirecting 
              ? "Redirecting..." 
              : "LOGIN"}
          </button>

          <div 
            className={styles.extraLinks} 
            style={{ 
              opacity: isDisabled ? 0.5 : 1,
              pointerEvents: isDisabled ? "none" : "auto"
            }}
          >
            <Link href="/auth/forgot-password">Forgot Password?</Link>
            <span> | </span>
            <Link href="/auth/register">New Registration</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
