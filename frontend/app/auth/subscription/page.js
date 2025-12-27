"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [activatedPlan, setActivatedPlan] = useState(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================================
      LOAD DATA FROM LOCAL STORAGE
  ====================================================== */
  useEffect(() => {
    try {
      setEmail(localStorage.getItem("regEmail") || "");
      setCompanyId(localStorage.getItem("companyId") || "");
      setCompanyName(localStorage.getItem("regCompanyName") || "");
    } catch {}
  }, []);

  /* ======================================================
      HANDLE PLAN SELECTION
  ====================================================== */
  const choosePlan = async (plan) => {
    if (loadingPlan) return;

    setError("");
    setLoadingPlan(plan);

    if (plan === "enterprise") {
      router.push("/contact-us");
      setLoadingPlan("");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/payment/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          companyId,
          companyName,
          plan
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch {}

      // Session expired
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      // Already active
      if (res.status === 403) {
        setActivatedPlan("business");
        return;
      }

      if (!res.ok) {
        setError(data?.message || "Subscription failed. Try again.");
        return;
      }

      // ⛔ Paid plan → redirect to Zoho
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      // 🎉 Trial activated instantly
      if (data?.redirect || plan === "free") {
        setActivatedPlan("free");
        return;
      }

      setError("Unexpected server response");
    } catch (err) {
      console.error(err);
      setError("Unable to connect to server");
    } finally {
      setLoadingPlan("");
    }
  };

  /* ======================================================
      SUCCESS UI
  ====================================================== */
  const renderSuccessScreen = () => {
    const isTrial = activatedPlan === "free";

    return (
      <div className={styles.successWrapper}>
        {/* LEFT PANEL */}
        <div className={styles.successLeft}>
          <h2 className={styles.successTitle}>
            {isTrial ? "🎉 Trial Activated" : "✅ Subscription Activated"}
          </h2>

          <p className={styles.successText}>
            Your company <b>{companyName}</b> is now successfully subscribed
            to PROMEET.
          </p>

          <div className={styles.planBox}>
            <h3>{isTrial ? "FREE TRIAL PLAN" : "BUSINESS PLAN"}</h3>

            {isTrial ? (
              <>
                <p>✔ Valid for 15 days</p>
                <p>✔ 100 Visitor Bookings</p>
                <p>✔ 100 Conference Bookings</p>
                <p>✔ Email Support</p>
              </>
            ) : (
              <>
                <p>✔ Unlimited Visitors</p>
                <p>✔ 1000 Conference Bookings</p>
                <p>✔ Priority Support</p>
                <p>✔ Full Feature Access</p>
              </>
            )}
          </div>

          <p className={styles.note}>
            A confirmation email has been sent to <b>{email}</b>.
          </p>
        </div>

        {/* RIGHT PANEL */}
        <div className={styles.successRight}>
          <h3>Next Step</h3>
          <p>You can now login and start using PROMEET.</p>

          <button
            className={styles.loginBtn}
            onClick={() => router.push("/auth/login")}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>PROMEET</div>
      </header>

      {/* SUCCESS VIEW */}
      {activatedPlan ? (
        renderSuccessScreen()
      ) : (
        <>
          <h2 className={styles.title}>Choose Your Subscription Plan</h2>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.planGrid}>
            {/* FREE */}
            <div className={styles.card}>
              <h3 className={styles.planName}>FREE TRIAL</h3>
              <p className={styles.price}>Free</p>
              <p className={styles.subText}>Valid for 15 days</p>

              <ul className={styles.features}>
                <li>✔ 100 Visitor Bookings</li>
                <li>✔ 100 Conference Bookings</li>
                <li>✔ Email Support</li>
              </ul>

              <button
                className={styles.btn}
                disabled={loadingPlan === "free"}
                onClick={() => choosePlan("free")}
              >
                {loadingPlan === "free"
                  ? "Activating..."
                  : "Start Free Trial"}
              </button>
            </div>

            {/* BUSINESS */}
            <div className={`${styles.card} ${styles.cardHighlight}`}>
              <h3 className={styles.planName}>BUSINESS</h3>
              <p className={styles.price}>
                ₹500 <span>/ month</span>
              </p>
              <p className={styles.subText}>Best for growing teams</p>

              <ul className={styles.features}>
                <li>✔ Unlimited Visitors</li>
                <li>✔ 1000 Conference Bookings</li>
                <li>✔ Priority Support</li>
              </ul>

              <button
                className={styles.btn}
                disabled={loadingPlan === "business"}
                onClick={() => choosePlan("business")}
              >
                {loadingPlan === "business"
                  ? "Redirecting..."
                  : "Get Started"}
              </button>
            </div>

            {/* ENTERPRISE */}
            <div className={styles.card}>
              <h3 className={styles.planName}>ENTERPRISE</h3>
              <p className={styles.price}>Custom Pricing</p>
              <p className={styles.subText}>
                Tailored for large organizations
              </p>

              <ul className={styles.features}>
                <li>✔ Custom Solutions</li>
                <li>✔ Dedicated Support</li>
                <li>✔ Advanced Controls</li>
              </ul>

              <button
                className={styles.btn}
                disabled={loadingPlan === "enterprise"}
                onClick={() => choosePlan("enterprise")}
              >
                Contact Us
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
