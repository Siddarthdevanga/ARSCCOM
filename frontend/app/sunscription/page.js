"use client";

import styles from "./style.module.css";

export default function SubscriptionPage() {
  const choosePlan = (plan) => {
    // Redirect to next step
    window.location.href = `/payment?plan=${plan}`;
  };

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>ARSCCOM</div>
      </header>

      {/* TITLE */}
      <h2 className={styles.title}>Choose Your Subscription Plan</h2>

      {/* PLAN GRID */}
      <div className={styles.planGrid}>

        {/* BRONZE PLAN */}
        <div className={styles.card}>
          <h3 className={styles.planName}>Bronze</h3>
          <p className={styles.price}>Free</p>
          <p className={styles.subText}>Best for testing & small trial use.</p>

          <ul className={styles.features}>
            <li>✔ 100 Visitors / month</li>
            <li>✔ 100 Conference Bookings</li>
            <li>✔ Max 2 Conference Rooms</li>
          </ul>

          <button 
            className={styles.btn}
            onClick={() => choosePlan("bronze")}
          >
            Get Started
          </button>
        </div>

        {/* SILVER PLAN */}
        <div className={`${styles.card} ${styles.cardHighlight}`}>
          <h3 className={styles.planName}>Silver</h3>
          <p className={styles.price}>₹1000 <span>/ month</span></p>
          <p className={styles.subText}>Perfect for medium-sized offices.</p>

          <ul className={styles.features}>
            <li>✔ 1000 Visitors / month</li>
            <li>✔ 1000 Conference Bookings</li>
            <li>✔ Max 4 Conference Rooms</li>
          </ul>

          <button 
            className={styles.btn}
            onClick={() => choosePlan("silver")}
          >
            Get Started
          </button>
        </div>

        {/* GOLD PLAN */}
        <div className={styles.card}>
          <h3 className={styles.planName}>Gold</h3>
          <p className={styles.price}>₹2000 <span>/ month</span></p>
          <p className={styles.subText}>For high-volume visitor traffic.</p>

          <ul className={styles.features}>
            <li>✔ 5000 Visitors / month</li>
            <li>✔ 10,000 Conference Bookings</li>
            <li>✔ Max 6 Conference Rooms</li>
          </ul>

          <button 
            className={styles.btn}
            onClick={() => choosePlan("gold")}
          >
            Get Started
          </button>
        </div>

      </div>
    </div>
  );
}
