"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  /* ================= AUTH CHECK ================= */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    try {
      setCompany(JSON.parse(storedCompany));
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/auth/login");
  };

  if (!company) return null;

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        {/* LEFT */}
        <div className={styles.logoText}>
          {company.name}
        </div>

        {/* RIGHT */}
        <div className={styles.rightSection}>
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt="Company Logo"
              className={styles.companyLogo}
            />
          )}

          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Logout"
          >
            ⏻
          </button>
        </div>
      </header>

      {/* MODULE CARDS */}
      <div className={styles.cardWrapper}>
        <div
          className={styles.card}
          onClick={() => router.push("/visitor/dashboard")}
        >
          <h2>Visitor Management</h2>
          <p>Manage visitor entries, ID verification & passes.</p>
        </div>

        <div
          className={styles.card}
          onClick={() => router.push("/conference/dashboard")}
        >
          <h2>Conference Booking</h2>
          <p>Manage conference rooms & meetings.</p>
        </div>
      </div>
    </div>
  );
}
