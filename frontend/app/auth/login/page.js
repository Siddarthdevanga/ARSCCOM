"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

const COOLDOWN_SECS = 30;
const MAX_ATTEMPTS  = 5;

function emailError(v) {
  const s = v.trim().toLowerCase();
  if (!s) return "Email is required";
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s)) return "Enter a valid email address";
  return "";
}

function passwordError(v) {
  if (!v) return "Password is required";
  return "";
}

function InlineErr({ msg, show }) {
  if (!show || !msg) return null;
  return (
    <p style={{ color: "#dc2626", fontSize: "0.72rem", fontWeight: 700, marginTop: 4, marginBottom: 0, lineHeight: 1.3 }}>
      {msg}
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [activeTab, setActiveTab]       = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [touched, setTouched]           = useState({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil]   = useState(null);
  const [cooldownLeft, setCooldownLeft]     = useState(0);
  const [capsLock, setCapsLock]             = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.promeet.zodopt.in";

  /* ── Auto-fill email after registration ── */
  useEffect(() => {
    const saved = localStorage.getItem("regEmail");
    if (saved) setEmail(saved);
  }, []);

  /* ── Cooldown countdown ── */
  useEffect(() => {
    if (!cooldownUntil) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left === 0) setCooldownUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const inCooldown = cooldownLeft > 0;

  /* ── Per-field errors ── */
  const fe = {
    email:    emailError(email),
    password: passwordError(password),
  };

  const borderFor = (field) =>
    touched[field] && fe[field] ? "1px solid #dc2626" : undefined;

  const handleBlur = (field) => setTouched((p) => ({ ...p, [field]: true }));

  const recordFailure = () => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      setCooldownUntil(Date.now() + COOLDOWN_SECS * 1000);
      setFailedAttempts(0);
    }
  };

  const handleLogin = async () => {
    if (loading || isRedirecting || inCooldown) return;

    /* Touch all fields to reveal inline errors */
    setTouched({ email: true, password: true });

    const firstErr = Object.values(fe).find(Boolean);
    if (firstErr) { setError(firstErr); return; }

    setError("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      /* ── 1. Try SuperAdmin login first ── */
      const saRes = await fetch(`${API_BASE}/api/superadmin/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: normalizedEmail, password }),
      });

      if (saRes.ok) {
        const saData = await saRes.json();
        if (saData?.user?.role === "superadmin") {
          localStorage.setItem("sa_token", saData.token);
          localStorage.setItem("sa_admin", JSON.stringify(saData.user));
          localStorage.removeItem("regEmail");
          setError("SuperAdmin login successful! Redirecting…");
          setIsRedirecting(true);
          setTimeout(() => router.replace("/superadmin/dashboard"), 800);
          return;
        }
      }

      /* ── 2. Regular company login ── */
      const res  = await fetch(`${API_BASE}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        recordFailure();
        setError(data?.message || "Invalid email or password");
        return;
      }

      const { token, company } = data;

      if (!token) {
        setError("Authentication failed. Please try again.");
        return;
      }

      /* Success — reset attempt counter and clear stored email */
      setFailedAttempts(0);
      localStorage.removeItem("regEmail");

      if (!company) {
        setError("Company not found. Redirecting to registration...");
        setIsRedirecting(true);
        setTimeout(() => router.replace("/auth/register"), 1500);
        return;
      }

      localStorage.setItem("company", JSON.stringify(company));

      const status = company?.subscription_status?.toLowerCase() || "pending";

      if (["active", "trial", "grace_period"].includes(status)) {
        let successMessage = "Login successful! Welcome back.";
        if (status === "trial") {
          successMessage = "Login successful! Welcome to your trial period.";
        } else if (status === "grace_period") {
          const daysLeft = company?.grace_period_days_remaining || 0;
          successMessage = `⚠️ Grace Period: ${daysLeft} days remaining. Please renew your subscription.`;
        }
        setError(successMessage);
        setIsRedirecting(true);
        setTimeout(() => router.replace("/home"), 800);
        return;
      }

      if (status === "expired") {
        setError("Your subscription has expired. Redirecting to renew...");
        setIsRedirecting(true);
        setTimeout(() => router.replace("/auth/subscription"), 1500);
        return;
      }

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

  const handleKeyDown = (e) => {
    setCapsLock(e.getModifierState("CapsLock"));
    if (e.key === "Enter" && !loading && !isRedirecting && !inCooldown) handleLogin();
  };

  const isSuccessMessage = (msg) =>
    msg.includes("successful") || msg.includes("Welcome") || msg.includes("SuperAdmin");

  const isDisabled = loading || isRedirecting || inCooldown;

  return (
    <div className={styles.container}>

      {/* LEFT BRANDING SECTION */}
      <div className={styles.leftSection}>
        <nav className={styles.topNav}>
          <button className={activeTab === "about" ? styles.activeNavBtn : ""} onClick={() => setActiveTab(activeTab === "about" ? null : "about")}>ABOUT</button>
          <button className={activeTab === "plans" ? styles.activeNavBtn : ""} onClick={() => setActiveTab(activeTab === "plans" ? null : "plans")}>PLANS</button>
          <button className={activeTab === "contact" ? styles.activeNavBtn : ""} onClick={() => setActiveTab(activeTab === "contact" ? null : "contact")}>CONTACT</button>
        </nav>

        <div className={styles.brandingContent}>
          <div className={styles.logoContainer}>
            <Image src="/Brand Logo.png" alt="Promeet Logo" width={280} height={90} priority className={styles.brandLogo} />
          </div>
          <h1 className={styles.platformTitle}>VISITOR MANAGEMENT PLATFORM</h1>
          <p className={styles.platformTagline}>Streamline check-ins • Enhance security • Optimize space utilization</p>
        </div>

        {activeTab && (
          <div className={styles.dropdownOverlay} onClick={() => setActiveTab(null)}>
            <div className={styles.dropdownContent} onClick={(e) => e.stopPropagation()}>
              {activeTab === "about" && (
                <div className={styles.dropdownSection}>
                  <h2>About Promeet</h2>
                  <p>Promeet is a secure Visitor & Conference Management Platform designed to digitalize visitor flow, improve security, and enhance organizational efficiency.</p>
                  <p>Transform your workplace with seamless visitor management, automated meeting coordination, and intelligent space utilization — all in one powerful platform.</p>
                </div>
              )}
              {activeTab === "plans" && (
                <div className={styles.dropdownSection}>
                  <h2>Subscription Plans</h2>
                  <div className={styles.plansGrid}>
                    <div className={styles.planCard}>
                      <div className={styles.planHeader}><h3>TRIAL</h3><div className={styles.planPrice}>₹49<span>/15 days</span></div></div>
                      <ul className={styles.planFeatures}><li>100 Visitor Bookings</li><li>100 Conference Bookings</li><li>2 Conference Rooms</li><li>Email Support</li></ul>
                      <Link href="/auth/register"><button className={styles.planBtn}>Start Trial</button></Link>
                    </div>
                    <div className={`${styles.planCard} ${styles.popularPlan}`}>
                      <div className={styles.popularBadge}>MOST POPULAR</div>
                      <div className={styles.planHeader}><h3>BUSINESS</h3><div className={styles.planPrice}>₹500<span>/month</span></div></div>
                      <ul className={styles.planFeatures}><li>Unlimited Visitors</li><li>1000 Conference Bookings</li><li>6 Conference Rooms</li><li>Priority Support</li></ul>
                      <Link href="/auth/register"><button className={styles.planBtn}>Get Started</button></Link>
                    </div>
                    <div className={styles.planCard}>
                      <div className={styles.planHeader}><h3>ENTERPRISE</h3><div className={styles.planPrice}>Custom</div></div>
                      <ul className={styles.planFeatures}><li>Unlimited Everything</li><li>Custom Integrations</li><li>Dedicated Manager</li><li>24/7 Support</li></ul>
                      <Link href="/auth/contact-us"><button className={styles.planBtn}>Contact Sales</button></Link>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "contact" && (
                <div className={styles.dropdownSection}>
                  <h2>Get in Touch</h2>
                  <div className={styles.contactGrid}>
                    <div className={styles.contactItem}><div className={styles.contactIcon}>📧</div><div><strong>Email</strong><p>admin@promeet.zodopt.com</p></div></div>
                    <div className={styles.contactItem}><div className={styles.contactIcon}>📞</div><div><strong>Phone</strong><p>+91 8647878785</p></div></div>
                    <div className={styles.contactItem}><div className={styles.contactIcon}>⏰</div><div><strong>Support Hours</strong><p>Mon-Fri, 9AM-6PM IST</p></div></div>
                  </div>
                  <p className={styles.contactFooter}>Our dedicated team is ready to help you streamline your visitor management.</p>
                </div>
              )}
              <button className={styles.closeDropdown} onClick={() => setActiveTab(null)}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT LOGIN SECTION */}
      <div className={styles.rightSection}>
        <div className={styles.loginCard}>
          <h2 className={styles.loginTitle}>LOGIN TO YOUR ACCOUNT</h2>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} noValidate>

          {/* Email */}
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              disabled={isDisabled}
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
              onBlur={() => handleBlur("email")}
              onKeyDown={handleKeyDown}
              autoComplete="email"
              placeholder="Enter your email"
              style={{ borderColor: borderFor("email") }}
            />
            <InlineErr msg={fe.email} show={touched.email} />
          </div>

          {/* Password */}
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                disabled={isDisabled}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                onBlur={() => handleBlur("password")}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                placeholder="Enter your password"
                style={{ borderColor: borderFor("password") }}
              />
              {password && (
                <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)} disabled={isDisabled} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <InlineErr msg={fe.password} show={touched.password} />
            {/* Caps Lock warning */}
            {capsLock && password && (
              <p style={{ color: "#f97316", fontSize: "0.72rem", fontWeight: 700, marginTop: 4, marginBottom: 0 }}>
                ⚠ Caps Lock is on
              </p>
            )}
          </div>

          {/* Cooldown banner */}
          {inCooldown && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: "0.78rem", fontWeight: 700, color: "#dc2626",
              marginBottom: 8, textAlign: "center",
            }}>
              Too many failed attempts. Please wait {cooldownLeft}s before trying again.
            </div>
          )}

          {/* Failed attempts warning (before cooldown) */}
          {!inCooldown && failedAttempts >= 3 && failedAttempts < MAX_ATTEMPTS && (
            <div style={{
              background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8,
              padding: "8px 14px", fontSize: "0.75rem", fontWeight: 700, color: "#c2410c",
              marginBottom: 8, textAlign: "center",
            }}>
              {MAX_ATTEMPTS - failedAttempts} attempt{MAX_ATTEMPTS - failedAttempts !== 1 ? "s" : ""} remaining before temporary lockout
            </div>
          )}

          {/* Error / success message */}
          {error && (
            <div className={isSuccessMessage(error) ? styles.successMessage : styles.errorMessage}>
              {isRedirecting && (
                <span className={styles.messageIcon}>{isSuccessMessage(error) ? "✓" : "⏳"}</span>
              )}
              {error}
            </div>
          )}

          <button type="submit" className={styles.loginBtn} disabled={isDisabled}>
            {inCooldown ? `WAIT ${cooldownLeft}s` : loading ? "LOGGING IN..." : isRedirecting ? "REDIRECTING..." : "LOGIN"}
          </button>

          </form>

          <div className={styles.loginLinks}>
            <Link href="/auth/register" className={styles.link}>New Registration?</Link>
            <span className={styles.linkDivider}>|</span>
            <Link href="/auth/forgot-password" className={styles.link}>Forgot Password?</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
