"use client";

import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function ConferenceDashboard() {
  const router = useRouter();

  // TEMPORARY DEMO DATA
  const companyName = "Demo Company Pvt Ltd";
  const companyLogo = "/logo_placeholder.png";

  // STATIC PUBLIC URL (SHARABLE)
  const publicBookingURL = "https://wheelbrand.com/demo-company";

  return (
    <div className={styles.container}>
      
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>WHEELBRAND</div>

        <div className={styles.rightHeader}>
          <span className={styles.welcomeText}>Welcome, {companyName}</span>
          <img src={companyLogo} className={styles.companyLogo} alt="Logo" />

          {/* LOGOUT ICON */}
          <button
            className={styles.logoutBtn}
            onClick={() => router.push("/auth/login")}
            title="Logout"
          >
            ⏻
          </button>
        </div>
      </header>

      {/* PAGE TITLE */}
      <h1 className={styles.pageTitle}>Conference Dashboard</h1>

      {/* PUBLIC LINK SECTION */}
      <div className={styles.publicCard}>
        <h3>Public Booking Link</h3>

        <a
          href={publicBookingURL}
          target="_blank"
          className={styles.publicURL}
        >
          {publicBookingURL}
        </a>

        <button
          className={styles.copyBtn}
          onClick={() => navigator.clipboard.writeText(publicBookingURL)}
        >
          Copy Link
        </button>
      </div>

      {/* STATS GRID */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>Rooms Available</h3>
          <p>3</p>
        </div>

        <div className={styles.statCard}>
          <h3>Today's Bookings</h3>
          <p>6</p>
        </div>

        <div className={styles.statCard}>
          <h3>Total Bookings</h3>
          <p>248</p>
        </div>

        <div className={styles.statCard}>
          <h3>Cancelled</h3>
          <p>2</p>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className={styles.actionRow}>
        <button
          className={styles.primaryBtn}
          onClick={() => router.push("/conference/bookings")}
        >
          + New Booking
        </button>

        <button className={styles.secondaryBtn}>View All Bookings</button>
      </div>

    </div>
  );
}
