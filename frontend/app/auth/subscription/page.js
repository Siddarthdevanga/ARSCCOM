"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://www.wheelbrand.in"; // fallback safe

  const choosePlan = async (plan) => {
    setError("");

    if (loadingPlan) return; // stop spam clicking
    setLoadingPlan(plan);

    // Enterprise → go to contact page
    if (plan === "enterprise") {
      router.push("/contact-us");
      setLoadingPlan("");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/payment/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      // ------------- AUTH ERROR ----------------
      if (res.status === 401) {
        setError("Please login to continue");
        router.push("/login");
        return;
      }

      // ------------- ALREADY ACTIVE ------------
      if (res.status === 403) {
        setError("Subscription already active");
        setTimeout(() => router.push("/dashboard"), 1200);
        return;
      }

      if (!res.ok) {
        setError(data.message || "Something went wrong");
        return;
      }

      // ------------- REDIRECT TO ZOHO ----------
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError("No redirect URL returned from server");
    } catch (err) {
      console.error(err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoadingPlan("");
    }
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>PROMEET</div>
      </header>

      <h2 className={styles.title}>Choose Your Subscription Plan</h2>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.planGrid}>
        {/* FREE TRIAL */}
        <div className={styles.card}>
          <h3 className={styles.planName}>FREE TRIAL</h3>
          <p className={styles.price}>Free</p>
          <p className={styles.subText}>Valid for 15 days</p>

          <ul className={styles.features}>
            <li>✔ 100 Visitor Bookings</li>
            <li>✔ 100 Conference Room Bookings</li>
            <li>✔ Dedicated Support</li>
          </ul>

          <button
            className={styles.btn}
            disabled={loadingPlan === "free"}
            onClick={() => choosePlan("free")}
          >
            {loadingPlan === "free" ? "Redirecting..." : "Start Free Trial"}
          </button>
        </div>

        {/* BUSINESS */}
        <div className={`${styles.card} ${styles.cardHighlight}`}>
          <h3 className={styles.planName}>BUSINESS</h3>
          <p className={styles.price}>
            ₹500 <span>/ month</span>
          </p>
          <p className={styles.subText}>Best for growing businesses</p>

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
            {loadingPlan === "business" ? "Redirecting..." : "Get Started"}
          </button>
        </div>

        {/* ENTERPRISE */}
        <div className={styles.card}>
          <h3 className={styles.planName}>ENTERPRISE</h3>
          <p className={styles.price}>Custom Pricing</p>
          <p className={styles.subText}>
            Fully customizable for large organizations
          </p>

          <ul className={styles.features}>
            <li>✔ Tailored Solutions</li>
            <li>✔ Advanced Features</li>
            <li>✔ Dedicated Support Manager</li>
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
