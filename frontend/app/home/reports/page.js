"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./style.module.css";

/* ─────────────────────────────────────────
   DONUT CHART — SVG, pure CSS animated
───────────────────────────────────────── */
function DonutChart({ data, colors }) {
  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  if (!total) return <div className={styles.emptyState}><span className={styles.emptyIcon}>📊</span>No data</div>;

  const r = 40, cx = 55, cy = 55, circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map((d, i) => {
    const pct = d.count / total;
    const dash = pct * circumference;
    const slice = { ...d, dash, offset, pct, color: colors[i % colors.length] };
    offset += dash;
    return slice;
  });

  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 110 110" className={styles.donutSvg}>
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={s.color} strokeWidth="18"
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset + circumference * 0.25}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#1a0038">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#9980c8">TOTAL</text>
      </svg>
      <div className={styles.donutLegend}>
        {slices.map((s, i) => (
          <div key={i} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            <span>{s.status || s.name || "-"}</span>
            <span className={styles.legendCount}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   BAR CHART — daily trend
───────────────────────────────────────── */
function BarChart({ data, color = "#7a00ff" }) {
  if (!data?.length) return <div className={styles.emptyState}><span className={styles.emptyIcon}>📈</span>No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className={styles.barChartWrap}>
      <div className={styles.barChart}>
        {data.map((d, i) => {
          const h = Math.max((d.count / max) * 110, 3);
          const label = d.date ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-";
          return (
            <div key={i} className={styles.barGroup}>
              <div className={styles.bar} data-val={d.count}
                style={{ height: `${h}px`, background: `linear-gradient(180deg, ${color}, ${color}aa)` }} />
              {i % 5 === 0 && <span className={styles.barLabel}>{label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   H-BAR LIST
───────────────────────────────────────── */
function HBarList({ data, blue = false }) {
  if (!data?.length) return <div className={styles.emptyState}><span className={styles.emptyIcon}>📋</span>No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className={styles.hBarList}>
      {data.map((d, i) => (
        <div key={i} className={styles.hBarRow}>
          <div className={styles.hBarTop}>
            <span>{d.name || "-"}</span>
            <span className={styles.hBarCount}>{d.count}</span>
          </div>
          <div className={styles.hBarTrack}>
            <div className={blue ? styles.hBarFillBlue : styles.hBarFill}
              style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function ReportsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const stored = localStorage.getItem("company");
    if (!token) { router.replace("/"); return; }
    if (stored) {
      try { setCompany(JSON.parse(stored)); } catch {}
    }
    fetch("/api/exports/analytics", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setAnalytics(data); setLoading(false); })
      .catch(() => { showToast("Failed to load analytics", "error"); setLoading(false); });
  }, []);

  const handleExport = async (type) => {
    const token = localStorage.getItem("token");
    const endpoints = {
      visitors: "/api/exports/visitors",
      bookings: "/api/exports/conference-bookings",
      all: "/api/exports/all",
    };
    try {
      setExporting(type);
      const res = await fetch(endpoints[type], { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${type}-report.xlsx`; a.click();
      URL.revokeObjectURL(url);
      showToast("Export downloaded!", "success");
    } catch {
      showToast("Export failed. Please try again.", "error");
    } finally {
      setExporting(null);
    }
  };

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
    </div>
  );

  const v = analytics?.visitors || {};
  const b = analytics?.bookings || {};

  const visitStatusColors = { pending: "#f0a500", accepted: "#00b894", declined: "#cc1100", checked_out: "#6200d6", checked_in: "#3b82f6" };
  const visitStatusData = (v.visitStatusBreakdown || []).map(d => ({
    ...d, color: visitStatusColors[d.status] || "#9980c8"
  }));

  const bookingStatusColors = { BOOKED: "#6200d6", CANCELLED: "#cc1100", COMPLETED: "#00b894" };
  const bookingStatusData = (b.statusBreakdown || []).map(d => ({
    ...d, name: d.status, color: bookingStatusColors[d.status] || "#9980c8"
  }));

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {company?.logo && (
            <Image src={company.logo} alt="Logo" width={38} height={38}
              className={styles.companyLogo} unoptimized />
          )}
          <span className={styles.logoText}>{company?.name || "Dashboard"}</span>
        </div>
        <button className={styles.backBtn} onClick={() => router.push("/home")}>
          ← Back
        </button>
      </header>

      {/* HERO */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Analytics &amp; <span>Reports</span>
        </h1>
        <p className={styles.heroSub}>Insights across visitor activity and conference usage</p>
      </div>

      <div className={styles.scrollBody}>
        <div className={styles.mainContent}>

          {/* ── VISITOR ANALYTICS ── */}
          <div>
            <p className={styles.sectionTitle}>
              <span className={`${styles.sectionDot} ${styles.sectionDotPurple}`} />
              Visitor Analytics
            </p>

            {/* KPI row */}
            <div className={styles.statRow}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Visitors</div>
                <div className={styles.statValue}>{v.total ?? 0}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Currently In</div>
                <div className={`${styles.statValue} ${styles.statValueAmber}`}>{v.active ?? 0}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Today&apos;s Visitors</div>
                <div className={`${styles.statValue} ${styles.statValueGreen}`}>{v.today ?? 0}</div>
              </div>
            </div>

            {/* Daily trend + visit status */}
            <div className={`${styles.chartsRow} ${styles.chartCard}`} style={{ marginTop: 14 }}>
              <div>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDot} />
                  <h3 className={styles.chartTitle}>Daily Visitor Trend — Last 30 Days</h3>
                </div>
                <BarChart data={v.dailyTrend || []} color="#7a00ff" />
              </div>
              <div>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDot} />
                  <h3 className={styles.chartTitle}>Visit Status Breakdown</h3>
                </div>
                <DonutChart
                  data={visitStatusData}
                  colors={["#f0a500", "#00b894", "#cc1100", "#6200d6", "#3b82f6"]}
                />
              </div>
            </div>

            {/* Top employees + purposes */}
            <div className={styles.twoCol} style={{ marginTop: 14 }}>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDot} />
                  <h3 className={styles.chartTitle}>Top Employees Being Visited</h3>
                </div>
                <HBarList data={v.topEmployees || []} />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDot} />
                  <h3 className={styles.chartTitle}>Most Common Visit Purposes</h3>
                </div>
                <HBarList data={v.topPurposes || []} />
              </div>
            </div>
          </div>

          {/* ── CONFERENCE ANALYTICS ── */}
          <div>
            <p className={styles.sectionTitle}>
              <span className={`${styles.sectionDot} ${styles.sectionDotBlue}`} />
              Conference Analytics
            </p>

            {/* KPI row */}
            <div className={styles.statRow}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Bookings</div>
                <div className={styles.statValue}>{b.total ?? 0}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Upcoming</div>
                <div className={`${styles.statValue} ${styles.statValueAmber}`}>{b.upcoming ?? 0}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Cancelled</div>
                <div className={`${styles.statValue}`} style={{ color: "#cc1100" }}>{b.cancelled ?? 0}</div>
              </div>
            </div>

            {/* Daily trend + status */}
            <div className={`${styles.chartsRow} ${styles.chartCard}`} style={{ marginTop: 14 }}>
              <div>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDotBlue} style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 0 3px rgba(59,130,246,0.15)", flexShrink: 0 }} />
                  <h3 className={styles.chartTitle}>Daily Booking Trend — Last 30 Days</h3>
                </div>
                <BarChart data={b.dailyTrend || []} color="#3b82f6" />
              </div>
              <div>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDotBlue} style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 0 3px rgba(59,130,246,0.15)", flexShrink: 0 }} />
                  <h3 className={styles.chartTitle}>Booking Status Breakdown</h3>
                </div>
                <DonutChart
                  data={bookingStatusData}
                  colors={["#6200d6", "#cc1100", "#00b894"]}
                />
              </div>
            </div>

            {/* Top rooms + by dept */}
            <div className={styles.twoCol} style={{ marginTop: 14 }}>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDotBlue} style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 0 3px rgba(59,130,246,0.15)", flexShrink: 0 }} />
                  <h3 className={styles.chartTitle}>Most Booked Rooms</h3>
                </div>
                <HBarList data={b.topRooms || []} blue />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartDotBlue} style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 0 3px rgba(59,130,246,0.15)", flexShrink: 0 }} />
                  <h3 className={styles.chartTitle}>Bookings by Department</h3>
                </div>
                <HBarList data={b.byDepartment || []} blue />
              </div>
            </div>
          </div>

          {/* ── EXPORT ── */}
          <div className={styles.exportSection}>
            <div className={styles.exportLeft}>
              <p className={styles.exportTitle}>Download Reports</p>
              <p className={styles.exportSub}>Export full data as Excel workbooks</p>
            </div>
            <div className={styles.exportBtns}>
              <button className={`${styles.exportBtn} ${styles.exportBtnPrimary}`}
                onClick={() => handleExport("all")} disabled={!!exporting}>
                {exporting === "all" ? "⏳ Exporting…" : "⬇ Full Report"}
              </button>
              <button className={`${styles.exportBtn} ${styles.exportBtnOutline}`}
                onClick={() => handleExport("visitors")} disabled={!!exporting}>
                {exporting === "visitors" ? "⏳…" : "👥 Visitors"}
              </button>
              <button className={`${styles.exportBtn} ${styles.exportBtnOutline}`}
                onClick={() => handleExport("bookings")} disabled={!!exporting}>
                {exporting === "bookings" ? "⏳…" : "📅 Bookings"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
