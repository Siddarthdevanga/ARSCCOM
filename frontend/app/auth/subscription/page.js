"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const choosePlan = async (plan) => {
    setError("");

    // Enterprise → Contact Page
    if (plan === "enterprise") {
      router.push("/contact-us");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/payment/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
        setLoading(false);
        return;
      }

      // Zoho Hosted Payment / Subscription URL
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError("No redirect URL returned from server");
    } catch (err) {
      console.error(err);
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>PROMEET</div>
      </header>

      {/* TITLE */}
      <h2 className={styles.title}>Choose Your Subscription Plan</h2>

      {error && <div className={styles.error}>{error}</div>}

      {/* PLAN GRID */}
      <div className={styles.planGrid}>

        {/* TRIAL */}
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
            disabled={loading}
            onClick={() => choosePlan("free")}
          >
            {loading ? "Redirecting..." : "Start Free Trial"}
          </button>
        </div>

        {/* BUSINESS */}
        <div className={`${styles.card} ${styles.cardHighlight}`}>
          <h3 className={styles.planName}>BUSINESS</h3>
          <p className={styles.price}>₹500 <span>/ month</span></p>
          <p className={styles.subText}>Best for growing businesses</p>

          <ul className={styles.features}>
            <li>✔ Unlimited Visitors</li>
            <li>✔ 1000 Conference Bookings</li>
            <li>✔ Priority Support</li>
          </ul>

          <button
            className={styles.btn}
            disabled={loading}
            onClick={() => choosePlan("business")}
          >
            {loading ? "Redirecting..." : "Get Started"}
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
            disabled={loading}
            onClick={() => choosePlan("enterprise")}
          >
            Contact Us
          </button>
        </div>

      </div>
    </div>
  );
}
