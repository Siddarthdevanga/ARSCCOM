"use client";

import styles from "./style.module.css";

export default function SubscriptionPage() {
  const choosePlan = async (plan) => {
    try {
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
        alert(data.message || "Something went wrong");
        return;
      }

      // Redirect to Zoho Hosted Page
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Payment link not received");
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert("Unable to connect to server");
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

      {/* PLAN GRID */}
      <div className={styles.planGrid}>

        {/* FREE PLAN */}
        <div className={styles.card}>
          <h3 className={styles.planName}>FREE</h3>
          <p className={styles.price}>Free Trial</p>
          <p className={styles.subText}>Valid for 15 days</p>

          <ul className={styles.features}>
            <li>✔ 100 Visitor Bookings</li>
            <li>✔ 100 Conference Room Bookings</li>
            <li>✔ Dedicated Support</li>
          </ul>

          <button
            className={styles.btn}
            onClick={() => choosePlan("trial")}
          >
            Get Started
          </button>
        </div>

        {/* BUSINESS PLAN */}
        <div className={`${styles.card} ${styles.cardHighlight}`}>
          <h3 className={styles.planName}>BUSINESS</h3>
          <p className={styles.price}>₹500 <span>/ month</span></p>
          <p className={styles.subText}>Best for growing businesses</p>

          <ul className={styles.features}>
            <li>✔ Unlimited Visitors</li>
            <li>✔ 1000 Conference Room Bookings</li>
            <li>✔ Dedicated Support</li>
          </ul>

          <button
            className={styles.btn}
            onClick={() => choosePlan("business")}
          >
            Get Started
          </button>
        </div>

        {/* ENTERPRISE PLAN */}
        <div className={styles.card}>
          <h3 className={styles.planName}>ENTERPRISE</h3>
          <p className={styles.price}>Custom Pricing</p>
          <p className={styles.subText}>
            Fully customizable to meet your business requirements.
          </p>

          <ul className={styles.features}>
            <li>✔ Tailored Solutions</li>
            <li>✔ Advanced Capabilities</li>
            <li>✔ Dedicated Support</li>
          </ul>

          <button
            className={styles.btn}
            onClick={() => choosePlan("enterprise")}
          >
            Contact Us
          </button>
        </div>

      </div>
    </div>
  );
}
