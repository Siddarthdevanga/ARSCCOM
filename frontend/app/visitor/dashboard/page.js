"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   READ MYSQL / ISO TIME AS-IS (No timezone conversion)
====================================================== */
const formatISTTime = (value) => {
  if (!value) return "-";
  try {
    const str = String(value).trim();
    let h, m;

    if (str.includes(" ")) [, h] = str.split(" ");
    if (str.includes("T")) [, h] = str.split("T");

    [h, m] = h.split(":");
    h = parseInt(h, 10);
    if (isNaN(h)) return "-";

    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;

    return `${h}:${m} ${suffix}`;
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
        { headers: { Authorization: `Bearer ${token}` } }
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

  /* ================= AUTH ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    setCompany(JSON.parse(storedCompany));
    loadDashboard(token);
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

      if (res.ok) await loadDashboard(token);
    } finally {
      setCheckingOut(null);
    }
  };

  /* ================= PLAN HELPERS ================= */
  const isTrial = plan?.plan === "TRIAL";
  const limitReached = isTrial && plan?.remaining === 0;

  const planPercentage = useMemo(() => {
    if (!plan?.limit || plan.limit === 0) return 0;
    return Math.min(100, Math.round((plan.used / plan.limit) * 100));
  }, [plan]);

  const planBarColor =
    planPercentage >= 90 ? "#ff1744" :
    planPercentage >= 70 ? "#ff9800" :
    "#00c853";

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
        <div className={styles.logoText}>{company.name}</div>
      </header>

      {/* ================= TITLE ================= */}
      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>Visitor Dashboard</h1>

        <button
          className={styles.newBtn}
          disabled={limitReached}
          style={{
            opacity: limitReached ? 0.5 : 1,
            cursor: limitReached ? "not-allowed" : "pointer"
          }}
          onClick={() => router.push("/visitor/primary_details")}
        >
          + New Visitor
        </button>
      </div>

      {/* ================= UPGRADE MESSAGE ================= */}
      {limitReached && (
        <div className={styles.upgradeMsg}>
          Trial limit reached. Please upgrade your plan to register more visitors.
        </div>
      )}

      {/* ================= PLAN BAR ================= */}
      {isTrial && (
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
              style={{
                width: `${planPercentage}%`,
                background: planBarColor
              }}
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
        <div className={styles.tableCard}>
          <h3>Active Visitors</h3>
          {activeVisitors.length === 0 ? (
            <p>No active visitors</p>
          ) : (
            <table className={styles.table}>
              <tbody>
                {activeVisitors.map((v) => (
                  <tr key={v.visitor_code}>
                    <td>{v.visitor_code}</td>
                    <td>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{formatISTTime(v.check_in)}</td>
                    <td>
                      <button
                        className={styles.checkoutBtn}
                        disabled={checkingOut === v.visitor_code}
                        onClick={() => handleCheckout(v.visitor_code)}
                      >
                        Checkout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.tableCard}>
          <h3>Checked-Out Visitors</h3>
          {checkedOutVisitors.length === 0 ? (
            <p>No visitors checked out today</p>
          ) : (
            <table className={styles.table}>
              <tbody>
                {checkedOutVisitors.map((v) => (
                  <tr key={v.visitor_code}>
                    <td>{v.visitor_code}</td>
                    <td>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{formatISTTime(v.check_out)}</td>
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
