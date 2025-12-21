"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/login");
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

  const startVisitorFlow = () => {
    // Reset any previous visitor flow data
    localStorage.removeItem("visitor_primary");
    localStorage.removeItem("visitor_secondary");
    localStorage.removeItem("visitor_identity");
    localStorage.removeItem("visitor_code");

    router.push("/visitor/dashboard");
  };

  if (!company) return null; // optional loader

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        {/* COMPANY NAME */}
        <div className={styles.logoText}>
          {company.name}
        </div>

        {/* LOGO + LOGOUT */}
        <div className={styles.rightSection}>
          {company.logo && (
            <img
              src={company.logo}
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

      {/* MAIN ACTIONS */}
      <div className={styles.cardWrapper}>
        <div
          className={styles.card}
          onClick={startVisitorFlow}
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
