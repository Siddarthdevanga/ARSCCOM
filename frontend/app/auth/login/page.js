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
    "https://www.promeet.zodopt.com";

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

      if (["active", "trial"].includes(status)) {
        router.replace("/home");
        return;
      }

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
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.brandSection}>
          <div className={styles.tagline}>
            VISITOR MANAGEMENT PLATFORM
          </div>

          <Image
            src="/Brand Logo.png"
            alt="Promeet Logo"
            width={420}
            height={140}
            priority
            className={styles.brandLogo}
          />
        </div>

        {/* NAV */}
        <nav className={styles.nav}>
          <button onClick={() => setActiveTab("about")}>ABOUT</button>
          <button onClick={() => setActiveTab("plans")}>PLANS</button>
          <button onClick={() => setActiveTab("contact")}>CONTACT</button>
        </nav>
      </header>

      {/* ================= DROPDOWN CONTENT ================= */}
      {activeTab && (
        <div className={styles.dropdownBox}>
          {activeTab === "about" && (
            <>
              <h2>About Our Platform</h2>
              <p>
                Promeet is a secure Visitor & Conference Management Platform
                designed to digitalize visitor flow, improve security, and
                enhance organizational efficiency.
              </p>
              <p>
                Manage visitors, schedule meetings, track conference rooms, and
                maintain complete control — all in one place.
              </p>
            </>
          )}

          {activeTab === "plans" && (
            <>
              <h2>Subscription Plans</h2>

              <div className={styles.planContainer}>
                <div className={styles.planCard}>
                  <h3>TRIAL</h3>
                  <h2>₹49 / 15 DAYS</h2>
                  <ul>
                    <li>✔ Valid 15 Days</li>
                    <li>✔ 100 Visitor Bookings</li>
                    <li>✔ 2 Conference Rooms</li>
                    <li>✔ 100 Conference Bookings</li>
                  </ul>
                  <Link href="/auth/register">
                    <button className={styles.planBtn}>Enroll Now</button>
                  </Link>
                </div>

                <div className={styles.planCard}>
                  <h3>BUSINESS</h3>
                  <h2>₹500 / Month</h2>
                  <ul>
                    <li>✔ Unlimited Visitors</li>
                    <li>✔ 6 Conference Rooms</li>
                    <li>✔ Priority Support</li>
                  </ul>
                  <Link href="/auth/register">
                    <button className={styles.planBtn}>Enroll Now</button>
                  </Link>
                </div>

                <div className={styles.planCard}>
                  <h3>ENTERPRISE</h3>
                  <h2>Custom Pricing</h2>
                  <ul>
                    <li>✔ Tailored Solutions</li>
                    <li>✔ Advanced Security</li>
                    <li>✔ Premium Support</li>
                  </ul>
                  <Link href="/auth/contact-us">
                    <button className={styles.planBtn}>Contact Us</button>
                  </Link>
                </div>
              </div>
            </>
          )}

          {activeTab === "contact" && (
            <>
              <h2>Contact Us</h2>
              <p>Email: admin@wheelbrand.in</p>
              <p>Phone: 8647878785</p>
              <p>We are happy to support you.</p>
            </>
          )}

          <button
            className={styles.closeBtn}
            onClick={() => setActiveTab(null)}
          >
            Close
          </button>
        </div>
      )}

      {/* ================= LOGIN CARD ================= */}
      <main className={styles.loginWrapper}>
        <div className={styles.loginCard}>
          <h4>LOGIN INTO YOUR ACCOUNT</h4>

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
            <div className={styles.errorBox}>{error}</div>
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
            <span>|</span>
            <Link href="/auth/register">New Registration</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
