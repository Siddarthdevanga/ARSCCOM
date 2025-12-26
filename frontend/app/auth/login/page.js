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
  // "about" | "plans" | "contact"

  /* ================= LOGIN ================= */
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
          body: JSON.stringify({
            email: normalizedEmail,
            password
          })
        }
      );

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned invalid response");
      }

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
          <div className={styles.logoText}>
            VISITOR MANAGEMENT PLATFORM
          </div>

          <Image
            src="/logo.png"
            alt="ARSCCOM Logo"
            width={420}
            height={140}
            priority
            className={styles.brandLogo}
            style={{ objectFit: "contain" }}
          />
        </div>

        <nav className={styles.nav}>
          <button onClick={() => setActiveSection("about")}>ABOUT</button>
          <button onClick={() => setActiveSection("plans")}>PLANS</button>
          <button onClick={() => setActiveSection("contact")}>CONTACT</button>
        </nav>
      </header>

      {/* ================= MAIN ================= */}
      <main className={styles.mainRow}>
        <div className={styles.leftSpacer} />

        <div className={styles.loginWrapper}>
          <div className={styles.loginCard}>
            <h4 className={styles.title}>LOGIN TO YOUR ACCOUNT</h4>

            <div className={styles.inputGroup}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

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
      </main>

      {/* ================= INFO PANEL ================= */}
      {activeSection && (
        <div
          style={{
            margin: "0 auto",
            width: "92%",
            marginTop: "20px",
            marginBottom: "28px",
            padding: "28px",
            borderRadius: "22px",
            background: "rgba(255,255,255,0.14)",
            backdropFilter: "blur(14px)",
            color: "white",
            boxShadow: "0 18px 36px rgba(0,0,0,0.35)"
          }}
        >
          {/* ABOUT */}
          {activeSection === "about" && (
            <>
              <h2>About Visitor Management Platform</h2>
              <p>
                A powerful end-to-end solution to manage visitors, security,
                employee experience, conference room bookings and seamless
                check-ins with pass generation.
              </p>
              <ul>
                <li>✔ Secure Access Management</li>
                <li>✔ Digital Visitor Pass System</li>
                <li>✔ Real-time Monitoring</li>
                <li>✔ Conference Room Management</li>
              </ul>
            </>
          )}

          {/* PLANS */}
          {activeSection === "plans" && (
            <>
              <h2>Subscription Plans</h2>

              <div
                style={{
                  display: "flex",
                  gap: "18px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  marginTop: "12px"
                }}
              >
                {/* FREE */}
                <div style={planCard}>
                  <h2 style={{ color: "#6d28d9" }}>FREE</h2>
                  <h1>Free Trial</h1>
                  <p>Valid for 15 Days</p>
                  <ul style={{ textAlign: "left" }}>
                    <li>✔ 100 Visitor Bookings</li>
                    <li>✔ 100 Conference Room Bookings</li>
                  </ul>
                  <button style={planBtn}>Get Started</button>
                </div>

                {/* BUSINESS */}
                <div style={planCard}>
                  <h2 style={{ color: "#6d28d9" }}>BUSINESS</h2>
                  <h1>₹500 <span style={{ fontSize: "14px" }}>/ month</span></h1>
                  <p>Best for growing businesses</p>
                  <ul style={{ textAlign: "left" }}>
                    <li>✔ Unlimited Visitors</li>
                    <li>✔ 1000 Room Bookings</li>
                  </ul>
                  <button style={planBtn}>Get Started</button>
                </div>

                {/* ENTERPRISE */}
                <div style={planCard}>
                  <h2 style={{ color: "#6d28d9" }}>ENTERPRISE</h2>
                  <h1>Custom Pricing</h1>
                  <p>For large organizations</p>
                  <ul style={{ textAlign: "left" }}>
                    <li>✔ Tailored Solutions</li>
                    <li>✔ Advanced Security</li>
                    <li>✔ Dedicated Support</li>
                  </ul>
                  <button style={planBtn}>Contact Sales</button>
                </div>
              </div>
            </>
          )}

          {/* CONTACT */}
          {activeSection === "contact" && (
            <>
              <h2>Contact Us</h2>
              <p>Email: <b>admin@wheelbrand.in</b></p>
              <p>Phone: +91 98765 43210</p>
              <p>We respond within 24 hours.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= INLINE STYLES ================= */

const planCard = {
  background: "rgba(255,255,255,0.92)",
  borderRadius: "20px",
  padding: "28px",
  width: "340px",
  color: "#333",
  textAlign: "center",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)"
};

const planBtn = {
  marginTop: "18px",
  width: "100%",
  background: "linear-gradient(135deg,#7a00ff,#5a00c2)",
  color: "#fff",
  padding: "12px",
  borderRadius: "12px",
  border: "none",
  fontWeight: "700",
  cursor: "pointer"
};
