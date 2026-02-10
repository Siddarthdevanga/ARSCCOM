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
    "https://www.promeet.zodopt.in";

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

      if (["active", "trial"].includes(status)) {
        const successMessage = status === "trial" 
          ? "Login successful! Welcome to your trial period." 
          : "Login successful! Welcome back.";
        
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

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading && !isRedirecting) {
      handleLogin();
    }
  };

  const isSuccessMessage = (msg) => {
    return msg.includes("successful") || msg.includes("Welcome");
  };

  const isDisabled = loading || isRedirecting;

  return (
    <div className={styles.container}>
      {/* LEFT BRANDING SECTION */}
      <div className={styles.leftSection}>
        <nav className={styles.topNav}>
          <button 
            className={activeTab === "about" ? styles.activeNavBtn : ""} 
            onClick={() => setActiveTab(activeTab === "about" ? null : "about")}
          >
            ABOUT
          </button>
          <button 
            className={activeTab === "plans" ? styles.activeNavBtn : ""} 
            onClick={() => setActiveTab(activeTab === "plans" ? null : "plans")}
          >
            PLANS
          </button>
          <button 
            className={activeTab === "contact" ? styles.activeNavBtn : ""} 
            onClick={() => setActiveTab(activeTab === "contact" ? null : "contact")}
          >
            CONTACT
          </button>
        </nav>

        <div className={styles.brandingContent}>
          <div className={styles.logoContainer}>
            <Image
              src="/Brand Logo.png"
              alt="Promeet Logo"
              width={300}
              height={100}
              priority
              className={styles.brandLogo}
            />
          </div>

          <h1 className={styles.platformTitle}>VISITOR MANAGEMENT PLATFORM</h1>

          <div className={styles.platformDescription}>
            <p className={styles.descriptionText}>
              Streamline visitor check-ins, enhance security, and manage conference rooms 
              with our comprehensive digital platform.
            </p>
            
            <div className={styles.featureGrid}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>✓</div>
                <div className={styles.featureText}>
                  <strong>Digital Check-in</strong>
                  <span>Contactless visitor registration</span>
                </div>
              </div>
              
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>✓</div>
                <div className={styles.featureText}>
                  <strong>Smart Scheduling</strong>
                  <span>Automated meeting coordination</span>
                </div>
              </div>
              
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>✓</div>
                <div className={styles.featureText}>
                  <strong>Room Management</strong>
                  <span>Efficient space utilization</span>
                </div>
              </div>
              
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>✓</div>
                <div className={styles.featureText}>
                  <strong>Real-time Tracking</strong>
                  <span>Monitor visitor activity</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeTab && (
          <div className={styles.dropdownOverlay} onClick={() => setActiveTab(null)}>
            <div className={styles.dropdownContent} onClick={(e) => e.stopPropagation()}>
              {activeTab === "about" && (
                <div className={styles.dropdownSection}>
                  <h2>About Promeet</h2>
                  <p>
                    Promeet is a secure Visitor & Conference Management Platform designed to 
                    digitalize visitor flow, improve security, and enhance organizational efficiency.
                  </p>
                  <p>
                    Manage visitors, schedule meetings, track conference rooms, and maintain 
                    complete control — all in one unified platform.
                  </p>
                  <ul className={styles.aboutList}>
                    <li>✓ Enterprise-grade security</li>
                    <li>✓ Cloud-based accessibility</li>
                    <li>✓ Customizable workflows</li>
                    <li>✓ Analytics & reporting</li>
                  </ul>
                </div>
              )}

              {activeTab === "plans" && (
                <div className={styles.dropdownSection}>
                  <h2>Subscription Plans</h2>
                  <div className={styles.plansGrid}>
                    <div className={styles.planCard}>
                      <div className={styles.planHeader}>
                        <h3>TRIAL</h3>
                        <div className={styles.planPrice}>₹49<span>/15 days</span></div>
                      </div>
                      <ul className={styles.planFeatures}>
                        <li>✓ 100 Visitor Bookings</li>
                        <li>✓ 100 Conference Bookings</li>
                        <li>✓ 2 Conference Rooms</li>
                        <li>✓ Email Support</li>
                      </ul>
                      <Link href="/auth/register">
                        <button className={styles.planBtn}>Start Trial</button>
                      </Link>
                    </div>

                    <div className={`${styles.planCard} ${styles.popularPlan}`}>
                      <div className={styles.popularBadge}>POPULAR</div>
                      <div className={styles.planHeader}>
                        <h3>BUSINESS</h3>
                        <div className={styles.planPrice}>₹500<span>/month</span></div>
                      </div>
                      <ul className={styles.planFeatures}>
                        <li>✓ Unlimited Visitors</li>
                        <li>✓ 1000 Conference Bookings</li>
                        <li>✓ 6 Conference Rooms</li>
                        <li>✓ Priority Support</li>
                      </ul>
                      <Link href="/auth/register">
                        <button className={styles.planBtn}>Get Started</button>
                      </Link>
                    </div>

                    <div className={styles.planCard}>
                      <div className={styles.planHeader}>
                        <h3>ENTERPRISE</h3>
                        <div className={styles.planPrice}>Custom</div>
                      </div>
                      <ul className={styles.planFeatures}>
                        <li>✓ Unlimited Everything</li>
                        <li>✓ Custom Integrations</li>
                        <li>✓ Dedicated Account Manager</li>
                        <li>✓ 24/7 Support</li>
                      </ul>
                      <Link href="/auth/contact-us">
                        <button className={styles.planBtn}>Contact Sales</button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "contact" && (
                <div className={styles.dropdownSection}>
                  <h2>Get in Touch</h2>
                  <div className={styles.contactGrid}>
                    <div className={styles.contactItem}>
                      <div className={styles.contactIcon}>📧</div>
                      <div>
                        <strong>Email</strong>
                        <p>admin@promeet.zodopt.com</p>
                      </div>
                    </div>
                    <div className={styles.contactItem}>
                      <div className={styles.contactIcon}>📞</div>
                      <div>
                        <strong>Phone</strong>
                        <p>+91 8647878785</p>
                      </div>
                    </div>
                    <div className={styles.contactItem}>
                      <div className={styles.contactIcon}>⏰</div>
                      <div>
                        <strong>Support Hours</strong>
                        <p>Mon-Fri, 9AM-6PM IST</p>
                      </div>
                    </div>
                  </div>
                  <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
                    We're here to help you streamline your visitor management.
                  </p>
                </div>
              )}

              <button className={styles.closeDropdown} onClick={() => setActiveTab(null)}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT LOGIN SECTION */}
      <div className={styles.rightSection}>
        <div className={styles.loginCard}>
          <h2 className={styles.loginTitle}>LOGIN TO YOUR ACCOUNT</h2>

          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              disabled={isDisabled}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              autoComplete="email"
              placeholder="Enter your email"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                disabled={isDisabled}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              {password && (
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isDisabled}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
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
          </div>

          {error && (
            <div className={isSuccessMessage(error) ? styles.successMessage : styles.errorMessage}>
              {isRedirecting && (
                <span className={styles.messageIcon}>
                  {isSuccessMessage(error) ? "✓" : "⏳"}
                </span>
              )}
              {error}
            </div>
          )}

          <button
            className={styles.loginBtn}
            onClick={handleLogin}
            disabled={isDisabled}
          >
            {loading ? "LOGGING IN..." : isRedirecting ? "REDIRECTING..." : "LOGIN"}
          </button>

          <div className={styles.loginLinks}>
            <Link href="/auth/register" className={styles.link}>
              Create account?
            </Link>
            <span className={styles.linkDivider}>|</span>
            <Link href="/auth/forgot-password" className={styles.link}>
              New Password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
