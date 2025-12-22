"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../utils/api";
import styles from "./style.module.css";

import ConferenceDashboard from "./dashboard";
import ConferenceBookings from "./bookings";

export default function ConferenceAdmin() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("dashboard");

  /* ================= AUTH + LOAD ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    const c = JSON.parse(storedCompany);
    setCompany(c);

    apiFetch("/api/conference/dashboard")
      .then(setStats)
      .catch(() => {
        localStorage.clear();
        router.replace("/auth/login");
      });
  }, [router]);

  if (!company || !stats) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>
        <h2 className={styles.companyName}>{company.name}</h2>
        {company.logo_url && (
          <img
            src={company.logo_url}
            alt="Company Logo"
            className={styles.logo}
          />
        )}
      </header>

      {/* PUBLIC BOOKING URL */}
      <div className={styles.publicBox}>
        <span>Public Booking URL</span>
        <a href={publicURL} target="_blank">{publicURL}</a>
        <button onClick={() => navigator.clipboard.writeText(publicURL)}>
          Copy
        </button>
      </div>

      {/* TABS */}
      <div className={styles.tabs}>
        <button
          className={tab === "dashboard" ? styles.activeTab : ""}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={tab === "bookings" ? styles.activeTab : ""}
          onClick={() => setTab("bookings")}
        >
          Bookings
        </button>
      </div>

      {/* CONTENT */}
      {tab === "dashboard" && (
        <ConferenceDashboard stats={stats} />
      )}

      {tab === "bookings" && (
        <ConferenceBookings />
      )}
    </div>
  );
}
