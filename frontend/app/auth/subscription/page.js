"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================================
      CHECK LOGIN + SUBSCRIPTION STATUS
  ====================================================== */
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.replace("/auth/login");
        return;
      }

      const company = JSON.parse(localStorage.getItem("company") || "{}");
      const status = company?.subscription_status?.toLowerCase() || "pending";

      console.log("SUB PAGE STATUS:", status);

      // Already subscribed → redirect to dashboard
      if (["active", "trial"].includes(status)) {
        router.replace("/home");
      }
    } catch {
      router.replace("/auth/login");
    }
  }, []);

  /* ======================================================
      HANDLE PLAN SELECTION
  ====================================================== */
  const choosePlan = async (plan) => {
    if (loadingPlan) return;

    setError("");
    setLoadingPlan(plan);

    // ENTERPRISE
    if (plan === "enterprise") {
      router.push("/contact-us");
      setLoadingPlan("");
      return;
    }

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        router.replace("/auth/login");
        return;
      }

      const res = await fetch(`${API_BASE}/api/payment/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }

      if (!res.ok) {
        setError(data?.message || "Subscription failed. Please try again.");
        return;
      }

      // Redirect to Zoho Payment
      if (data?.url) {
        window.location.href = data.url;
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
      VIEW
  ====================================================== */
  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>PROMEET</div>
      </header>

      <h2 className={styles.title}>Choose Your Subscription Plan</h2>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.planGrid}>
        {/* ================= FREE ================= */}
        <div className={styles.card}>
          <h3 className={styles.planName}>FREE TRIAL</h3>
          <p className={styles.price}>₹49</p>
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
            {loadingPlan === "free" ? "Processing..." : "Start Free Trial"}
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
    </div>
  );
}
