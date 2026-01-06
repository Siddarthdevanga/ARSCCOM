"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   READ MYSQL TIME AS-IS (IT IS ALREADY IST)
====================================================== */
const formatISTTime = (value) => {
  if (!value) return "-";

  try {
    const str = String(value).trim();

    // MySQL: "YYYY-MM-DD HH:MM:SS"
    if (str.includes(" ")) {
      const time = str.split(" ")[1];     // HH:MM:SS
      if (!time) return "-";

      let [h, m] = time.split(":");
      h = parseInt(h, 10);

      if (isNaN(h)) return "-";

      const suffix = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;

      return `${h}:${m} ${suffix}`;
    }

    // ISO string → DO NOT CONVERT — just read local time part
    if (str.includes("T")) {
      const t = str.split("T")[1]; // HH:MM:SS.xxx
      if (!t) return "-";

      const [h, m] = t.split(":");
      let hr = parseInt(h, 10);

      const suffix = hr >= 12 ? "PM" : "AM";
      hr = hr % 12 || 12;

      return `${hr}:${m} ${suffix}`;
    }

    return "-";
  } catch {
    return "-";
  }
};


export default function VisitorDashboard() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState({ today: 0, inside: 0, out: 0 });
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [checkedOutVisitors, setCheckedOutVisitors] = useState([]);
  const [checkingOut, setCheckingOut] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD COMPANY + DASHBOARD ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    try {
      setCompany(JSON.parse(storedCompany));
      loadDashboard(token);
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router]);

  /* ================= FETCH DASHBOARD ================= */
  const loadDashboard = async (token) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        console.error("Dashboard API failed");
        return;
      }

      const data = await res.json();

      setStats(data.stats || { today: 0, inside: 0, out: 0 });
      setActiveVisitors(data.activeVisitors || []);
      setCheckedOutVisitors(data.checkedOutVisitors || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= CHECKOUT ================= */
  const handleCheckout = async (visitorCode) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setCheckingOut(visitorCode);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/${visitorCode}/checkout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        console.error("Checkout failed");
        return;
      }

      await loadDashboard(token);
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setCheckingOut(null);
    }
  };

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    localStorage.clear();
    router.push("/auth/login");
  };

  if (loading || !company) return null;

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.logoText}>{company?.name}</div>

        <div className={styles.rightHeader}>
          <img
            src={company?.logo_url || "/logo.png"}
            alt="Company Logo"
            className={styles.companyLogo}
          />

          <button className={styles.logoutBtn} onClick={handleLogout}>
            ⏻
          </button>
        </div>
      </header>

      {/* ================= TITLE ================= */}
      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>Visitor Dashboard</h1>

        <button
          className={styles.newBtn}
          onClick={() => router.push("/visitor/primary_details")}
        >
          + New Visitor
        </button>
      </div>

      {/* ================= KPI STATS ================= */}
      <section className={styles.topStats}>
        <div className={styles.bigCard}>
          <h4>Visitors Today</h4>
          <p>{stats.today}</p>
        </div>

        <div className={styles.bigCard}>
          <h4>Currently Inside</h4>
          <p>{stats.inside}</p>
        </div>

        <div className={styles.bigCard}>
          <h4>Visitors Out</h4>
          <p>{stats.out}</p>
        </div>
      </section>

      {/* ================= TABLES ================= */}
      <section className={styles.tablesRow}>
        
        {/* ACTIVE VISITORS */}
        <div className={styles.tableCard}>
          <h3>Active Visitors</h3>

          {activeVisitors.length === 0 ? (
            <p>No active visitors</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Check-in</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeVisitors.map(v => (
                  <tr key={v.visitor_code}>
                    <td>{v.visitor_code}</td>
                    <td>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{formatISTTime(v.check_in || v.checkIn)}</td>
                    <td>
                      <button
                        className={styles.checkoutBtn}
                        disabled={checkingOut === v.visitor_code}
                        onClick={() => handleCheckout(v.visitor_code)}
                      >
                        {checkingOut === v.visitor_code
                          ? "Checking out..."
                          : "Checkout"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* CHECKED OUT VISITORS */}
        <div className={styles.tableCard}>
          <h3>Checked-Out Visitors</h3>

          {checkedOutVisitors.length === 0 ? (
            <p>No visitors checked out today</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Check-out</th>
                </tr>
              </thead>
              <tbody>
                {checkedOutVisitors.map(v => (
                  <tr key={v.visitor_code}>
                    <td>{v.visitor_code}</td>
                    <td>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{formatISTTime(v.check_out || v.checkOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </section>
    </div>
  );
}
