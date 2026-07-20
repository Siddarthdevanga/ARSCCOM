"use client";

import styles from "./PublicUnavailable.module.css";

/**
 * Shown on public visitor/booking pages when the host company's
 * subscription is inactive. Renders instead of the OTP/form flow so
 * an anonymous visitor never invests time (or hands over a camera
 * photo) before hitting a dead end at the final submit step.
 */
export default function PublicUnavailable({ title, subtitle }) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconCircle}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </div>
  );
}
