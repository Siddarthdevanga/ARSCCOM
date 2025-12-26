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
          body: JSON.stringify({ email: normalizedEmail, password })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Invalid credentials");
        return;
      }

      localStorage.setItem("token", data.token);
      document.cookie = `token=${data.token}; path=/`;

      if (data.company) {
        localStorage.setItem("company", JSON.stringify(data.company));
      }

      router.replace("/home");
    } catch {
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
            src="/logo.png"
            alt="ARSCCOM Logo"
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

      {/* ABOUT DROPDOWN */}
      {activeTab === "about" && (
        <div className={styles.dropdownBox}>
          <h2>About Our Platform</h2>
          <p>
            A secure, scalable Visitor & Conference Management platform
            designed to digitalize visitor flow and organization operations.
          </p>

          <button className={styles.closeBtn} onClick={() => setActiveTab(null)}>
            Close
          </button>
        </div>
      )}

      {/* PLANS DROPDOWN */}
      {activeTab === "plans" && (
        <div className={styles.dropdownBox}>
          <h2>Subscription Plans</h2>

          <div className={styles.planContainer}>

            {/* FREE PLAN */}
            <div className={styles.planCard}>
              <h3>FREE</h3>
              <h2>Free Trial</h2>
              <ul>
                <li>✔ Valid 15 Days</li>
                <li>✔ 100 Visitor Bookings</li>
                <li>✔ 100 Conference Rooms</li>
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
                <li>✔ 1000 Room Bookings</li>
                <li>✔ Dedicated Support</li>
              </ul>

              <Link href="/auth/register">
                <button className={styles.planBtn}>Enroll Now</button>
              </Link>
            </div>

            {/* ENTERPRISE PLAN */}
            <div className={styles.planCard}>
              <h3>ENTERPRISE</h3>
              <h2>Custom Pricing</h2>
              <ul>
                <li>✔ Tailored Solutions</li>
                <li>✔ Advanced Security</li>
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

      {/* CONTACT DROPDOWN */}
      {activeTab === "contact" && (
        <div className={styles.dropdownBox}>
          <h2>Contact Us</h2>
          <p>Email: admin@wheelbrand.in</p>
          <p>Phone : 8647878785</p>
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
            <input
              type="password"
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p style={{ color: "red" }}>{error}</p>}

          <button className={styles.loginBtn} onClick={handleLogin} disabled={loading}>
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
