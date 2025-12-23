"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

export default function ConferenceDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedCompany = localStorage.getItem("company");

      if (!token || !storedCompany) {
        router.replace("/auth/login");
        return;
      }

      setCompany(JSON.parse(storedCompany));

      apiFetch("/api/conference/dashboard")
        .then((data) => {
          setStats(data);
          setLoading(false);
        })
        .catch(() => {
          router.replace("/auth/login");
        });
    } catch {
      router.replace("/auth/login");
    }
  }, [router]);

  if (loading) return null;
  if (!stats || !company) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.companyInfo}>
          <h2 className={styles.companyName}>{company.name}</h2>
          <span className={styles.subText}>Conference Dashboard</span>
        </div>

        <img
          src={company.logo_url || "/logo.png"}
          alt="Company Logo"
          className={styles.logo}
        />
      </header>

      {/* ================= PUBLIC BOOKING LINK ================= */}
      <section className={styles.publicBox}>
        <p className={styles.publicLabel}>Public Booking Link</p>
        <a
          href={publicURL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.publicLink}
        >
          {publicURL}
        </a>
        <span className={styles.publicHint}>
          Share this link with employees to book rooms
        </span>
      </section>

      {/* ================= STATS ================= */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Rooms</span>
          <b>{stats.rooms}</b>
        </div>

        <div className={styles.statCard}>
          <span>Today’s Bookings</span>
          <b>{stats.todayBookings}</b>
        </div>

        <div className={styles.statCard}>
          <span>Total Bookings</span>
          <b>{stats.totalBookings}</b>
        </div>
      </section>

      {/* ================= ACTION ================= */}
      <button
        className={styles.primaryBtn}
        onClick={() => router.push("/conference/bookings")}
      >
        Manage Bookings
      </button>
    </div>
  );
}
