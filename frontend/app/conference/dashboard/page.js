"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api"; // ✅ relative import
import styles from "./style.module.css";

export default function ConferenceDashboard() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  /* ================= AUTH + LOAD ================= */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    try {
      const parsedCompany = JSON.parse(storedCompany);
      setCompany(parsedCompany);

      apiFetch("/api/conference/dashboard")
        .then((data) => {
          setStats(data);
          setLoading(false);
        })
        .catch(() => {
          setError("Session expired. Please login again.");
          localStorage.clear();
          router.replace("/auth/login");
        });
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router]);

  if (loading) return null;
  if (!company || !stats) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <h2 className={styles.companyName}>{company.name}</h2>

        {company.logo_url && (
          <img
            src={company.logo_url}
            alt={`${company.name} Logo`}
            className={styles.logo}
          />
        )}
      </header>

      {/* ================= PUBLIC LINK ================= */}
      <div className={styles.publicBox}>
        <p className={styles.publicTitle}>Public Booking URL</p>

        <a
          href={publicURL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.publicLink}
        >
          {publicURL}
        </a>

        <button
          className={styles.copyBtn}
          onClick={() => navigator.clipboard.writeText(publicURL)}
        >
          Copy
        </button>
      </div>

      {/* ================= ERROR ================= */}
      {error && <p className={styles.error}>{error}</p>}

      {/* ================= STATS ================= */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Rooms</span>
          <b>{stats.rooms}</b>
        </div>

        <div className={styles.statCard}>
          <span>Today</span>
          <b>{stats.todayBookings}</b>
        </div>

        <div className={styles.statCard}>
          <span>Total</span>
          <b>{stats.totalBookings}</b>
        </div>

        <div className={styles.statCard}>
          <span>Cancelled</span>
          <b>{stats.cancelled}</b>
        </div>
      </div>

      {/* ================= CTA ================= */}
      <button
        className={styles.primaryBtn}
        onClick={() => router.push("/conference/bookings")}
      >
        Manage Bookings
      </button>
    </div>
  );
}

