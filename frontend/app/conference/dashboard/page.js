"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api"; // ✅ FIXED (NO alias)
import styles from "./style.module.css";

export default function ConferenceDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");

  /* ================= AUTH + LOAD ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    setCompany(JSON.parse(storedCompany));

    apiFetch("/api/conference/dashboard")
      .then(setStats)
      .catch(() => {
        setError("Session expired");
        router.replace("/auth/login");
      });
  }, [router]);

  if (!company || !stats) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <h2>{company.name}</h2>

        {company.logo_url && (
          <img
            src={company.logo_url}
            alt="Company Logo"
            className={styles.logo}
          />
        )}
      </header>

      {/* PUBLIC LINK */}
      <div className={styles.publicBox}>
        <p>Public Booking URL</p>

        <a
          href={publicURL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {publicURL}
        </a>

        <button
          onClick={() => navigator.clipboard.writeText(publicURL)}
        >
          Copy
        </button>
      </div>

      {/* ERROR */}
      {error && <p className={styles.error}>{error}</p>}

      {/* STATS */}
      <div className={styles.statsGrid}>
        <div>
          Rooms
          <b>{stats.rooms}</b>
        </div>

        <div>
          Today
          <b>{stats.todayBookings}</b>
        </div>

        <div>
          Total
          <b>{stats.totalBookings}</b>
        </div>

        <div>
          Cancelled
          <b>{stats.cancelled}</b>
        </div>
      </div>

      {/* CTA */}
      <button
        className={styles.primaryBtn}
        onClick={() => router.push("/conference/bookings")}
      >
        Manage Bookings
      </button>
    </div>
  );
}
