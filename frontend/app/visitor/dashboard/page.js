"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   READ MYSQL / ISO TIME AS-IS (No timezone conversion)
====================================================== */
const formatISTTime = (value) => {
  if (!value) return "-";

  try {
    const str = String(value).trim();
    let hours = null;
    let minutes = null;

    if (str.includes(" ")) {
      const t = str.split(" ")[1];
      [hours, minutes] = t.split(":");
    } else if (str.includes("T")) {
      const t = str.split("T")[1];
      [hours, minutes] = t.split(":");
    }

    if (!hours || !minutes) return "-";

    hours = parseInt(hours, 10);
    if (isNaN(hours)) return "-";

    const suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${suffix}`;
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
  const [plan, setPlan] = useState(null);

  /* ================= FETCH DASHBOARD ================= */
  const loadDashboard = useCallback(async (token) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      setStats(data?.stats || { today: 0, inside: 0, out: 0 });
      setActiveVisitors(data?.activeVisitors || []);
      setCheckedOutVisitors(data?.checkedOutVisitors || []);
      setPlan(data?.plan || null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ================= AUTH + LOAD ================= */
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
  }, [router, loadDashboard]);

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

      if (!res.ok) return;

      await loadDashboard(token);
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setCheckingOut(null);
    }
  };

  /* ================= BACK ================= */
  const handleBack = () => {
    router.push("/home");
  };

  if (loading || !company) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard…</div>
      </div>
    );
  }

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

          <button className={styles.backBtn} onClick={handleBack}>
            ← Back
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

      {/* ================= PLAN BAR ================= */}
      {plan?.plan === "TRIAL" && (
        <section className={styles.planBarWrapper}>
          <div className={styles.planHeader}>
            <span className={styles.planName}>Trial Plan</span>
            <span className={styles.planRemaining}>
              {plan.remaining} Visitors Remaining
            </span>
          </div>

          <div className={styles.planBarBg}>
            <div
              className={styles.planBarFill}
              style={{ width: `${(plan.used / plan.limit) * 100}%` }}
            />
          </div>

          <div className={styles.planFooter}>
            <span>{plan.used} / {plan.limit} Used</span>
            {plan.trialEndsAt && (
              <span>
                Expires: {new Date(plan.trialEndsAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ================= KPI ================= */}
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
        {/* ACTIVE */}
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
                {activeVisitors.map((v) => (
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

        {/* CHECKED OUT */}
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
                {checkedOutVisitors.map((v) => (
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
