"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const storedCompany = localStorage.getItem("company");
    const token = localStorage.getItem("token");

    if (!token || !storedCompany) {
      router.push("/auth/login");
      return;
    }

    setCompany(JSON.parse(storedCompany));
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/auth/login");
  };

  if (!company) return null; // or loader

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>

        {/* LEFT: COMPANY NAME */}
        <div className={styles.logoText}>
          {company.name}
        </div>

        {/* RIGHT: LOGO + LOGOUT */}
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

      {/* MAIN CARDS */}
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
