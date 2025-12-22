"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/utils/api";
import styles from "./style.module.css";

export default function ConferenceDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [company, setCompany] = useState(null);

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
      .catch(() => router.replace("/auth/login"));
  }, [router]);

  if (!stats || !company) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>{company.name}</h2>
        <img src={company.logo_url} className={styles.logo} />
      </header>

      <div className={styles.publicBox}>
        <p>Public Booking URL</p>
        <a href={publicURL} target="_blank">{publicURL}</a>
        <button onClick={() => navigator.clipboard.writeText(publicURL)}>
          Copy
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div>Rooms <b>{stats.rooms}</b></div>
        <div>Today <b>{stats.todayBookings}</b></div>
        <div>Total <b>{stats.totalBookings}</b></div>
        <div>Cancelled <b>{stats.cancelled}</b></div>
      </div>

      <button
        className={styles.primaryBtn}
        onClick={() => router.push("/conference/bookings")}
      >
        Manage Bookings
      </button>
    </div>
  );
}
