"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();
  const params = useSearchParams();

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
      LOAD LOCAL STORAGE
  ====================================================== */
  useEffect(() => {
    try {
      setEmail(localStorage.getItem("regEmail") || "");
      setCompanyId(localStorage.getItem("companyId") || "");
      setCompanyName(localStorage.getItem("regCompanyName") || "");
    } catch {}

    // If user returned after payment success
    if (params.get("status") === "active") {
      setActivatedPlan("business");
    }

    // If webhook already activated earlier
    if (params.get("trial") === "true") {
      setActivatedPlan("free");
    }
  }, [params]);

  /* ======================================================
      PLAN HANDLER
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
          plan,
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (!res.ok) {
        setError(data?.message || "Subscription failed. Please try again.");
        return;
      }

      // ================= FREE TRIAL =================
      if (plan === "free") {
        setActivatedPlan("free");
        return;
      }

      // ================= BUSINESS PAYMENT =================
      if (data?.url || data?.redirectUrl) {
        window.location.href = data.url || data.redirectUrl;
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
      SUCCESS SCREEN
  ====================================================== */
  const renderSuccessScreen = () => {
    const isTrial = activatedPlan === "free";

    return (
      <div className={styles.successContainer}>
        <div className={styles.successCard}>
          <h2 className={styles.successHeading}>
            {isTrial
              ? "Trial Subscription Activated"
              : "Subscription Activated"}
          </h2>

          <p className={styles.successMessage}>
            Your company <b>{companyName}</b> has successfully subscribed to
            PROMEET.
          </p>

          <div className={styles.planDetails}>
            <h3 className={styles.planTitle}>
              {isTrial ? "Free Trial Plan" : "Business Plan"}
            </h3>

            {isTrial ? (
              <>
                <p>• Valid for 15 days</p>
                <p>• 100 Visitor Bookings</p>
                <p>• 100 Conference Room Bookings</p>
                <p>• Email Support</p>
              </>
            ) : (
              <>
                <p>• Unlimited Visitors</p>
                <p>• 1000 Conference Room Bookings</p>
                <p>• Priority Support</p>
                <p>• Full Feature Access</p>
              </>
            )}
          </div>

          <p className={styles.emailInfo}>
            A confirmation email has been sent to <b>{email}</b>.
          </p>

          <button
            className={styles.loginButton}
            onClick={() => router.push("/auth/login")}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  };

  /* ======================================================
      VIEW RENDER
  ====================================================== */
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>PROMEET</div>
      </header>

      {activatedPlan ? (
        renderSuccessScreen()
      ) : (
        <>
          <h2 className={styles.title}>Choose Your Subscription Plan</h2>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.planGrid}>
            {/* ================= FREE TRIAL ================= */}
            <div className={styles.card}>
              <h3 className={styles.planName}>FREE TRIAL</h3>
              <p className={styles.price}>Free</p>
              <p className={styles.subText}>Valid for 15 days</p>

              <ul className={styles.features}>
                <li>• 100 Visitor Bookings</li>
                <li>• 100 Conference Bookings</li>
                <li>• Email Support</li>
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

            {/* ================= BUSINESS ================= */}
            <div className={`${styles.card} ${styles.cardHighlight}`}>
              <h3 className={styles.planName}>BUSINESS</h3>
              <p className={styles.price}>
                ₹500 <span>/ month</span>
              </p>
              <p className={styles.subText}>Best for growing teams</p>

              <ul className={styles.features}>
                <li>• Unlimited Visitors</li>
                <li>• 1000 Conference Bookings</li>
                <li>• Priority Support</li>
              </ul>

              <button
                className={styles.btn}
                disabled={loadingPlan === "business"}
                onClick={() => choosePlan("business")}
              >
                {loadingPlan === "business"
                  ? "Processing..."
                  : "Proceed to Payment"}
              </button>
            </div>

            {/* ================= ENTERPRISE ================= */}
            <div className={styles.card}>
              <h3 className={styles.planName}>ENTERPRISE</h3>
              <p className={styles.price}>Custom Pricing</p>
              <p className={styles.subText}>
                Tailored for large organizations
              </p>

              <ul className={styles.features}>
                <li>• Custom Solutions</li>
                <li>• Dedicated Support</li>
                <li>• Advanced Controls</li>
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
