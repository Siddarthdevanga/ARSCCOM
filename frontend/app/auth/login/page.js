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

  const [activeSection, setActiveSection] = useState(""); 
  // about | plans | contact | ""

  const handleLogin = async () => {
    if (loading) return;

    if (!email.trim() || !password.trim()) {
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
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Invalid credentials");

      localStorage.setItem("token", data.token);
      document.cookie = `token=${data.token}; path=/`;

      if (data.company) {
        localStorage.setItem("company", JSON.stringify(data.company));
      }

      router.replace("/home");
    } catch (err) {
      setError(err.message || "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.brandSection}>
          <div className={styles.logoText}>VISITOR MANAGEMENT PLATFORM</div>

          <Image
            src="/logo.png"
            alt="ARSCCOM LOGO"
            width={420}
            height={160}
            className={styles.brandLogo}
          />
        </div>

        {/* ❤️ NAV MUST BE INSIDE HEADER */}
        <nav className={styles.nav}>
          <button onClick={() => setActiveSection("about")}>ABOUT</button>
          <button onClick={() => setActiveSection("plans")}>PLANS</button>
          <button onClick={() => setActiveSection("contact")}>CONTACT</button>

          {/* DROPDOWN */}
          {activeSection && (
            <div className={styles.dropdownBox}>
              {activeSection === "about" && (
                <>
                  <h2>About Our Platform</h2>
                  <p>
                    A secure, smart and scalable Visitor & Conference
                    Management Platform designed to digitalize visitor flow
                    and organization operations.
                  </p>
                </>
              )}

              {activeSection === "plans" && (
                <>
                  <h2>Subscription Plans</h2>

                  <div className={styles.planContainer}>
                    <div className={styles.planCard}>
                      <h3>FREE</h3>
                      <h2>Free Trial</h2>
                      <ul>
                        <li>✔ 100 Visitor Bookings</li>
                        <li>✔ 100 Room Bookings</li>
                      </ul>
                    </div>

                    <div className={styles.planCard}>
                      <h3>BUSINESS</h3>
                      <h2>₹500 / month</h2>
                      <ul>
                        <li>✔ Unlimited Visitors</li>
                        <li>✔ 1000 Room Bookings</li>
                      </ul>
                    </div>

                    <div className={styles.planCard}>
                      <h3>ENTERPRISE</h3>
                      <h2>Custom Pricing</h2>
                      <ul>
                        <li>✔ Tailored Solutions</li>
                        <li>✔ Dedicated Support</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {activeSection === "contact" && (
                <>
                  <h2>Contact Us</h2>
                  <p>Email: <b>admin@wheelbrand.in</b></p>
                  <p>Phone: +91 98765 43210</p>
                  <p>We respond within 24 hours.</p>
                </>
              )}

              <button
                className={styles.closeBtn}
                onClick={() => setActiveSection("")}
              >
                Close
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* ================= LOGIN ================= */}
      <div className={styles.loginWrapper}>
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
      </div>
    </div>
  );
}
