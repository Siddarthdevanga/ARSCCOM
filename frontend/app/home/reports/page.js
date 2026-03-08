"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Download, Users, CalendarDays, TrendingUp,
  CheckCircle, XCircle, Clock, AlertCircle, Activity,
  BarChart2, FileDown, RefreshCw, UserCheck, Layers, Calendar,
} from "lucide-react";
import styles from "./style.module.css";

/* ═══════════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════════ */
function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const Icon = toast.type === "error" ? XCircle : CheckCircle;
  return (
    <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`} role="alert">
      <Icon size={16} /><span>{toast.msg}</span>
      <button className={styles.toastClose} onClick={onDismiss} aria-label="Dismiss"><XCircle size={14} /></button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DONUT CHART — pure SVG
═══════════════════════════════════════════════════════════════════ */
const STATUS_META = {
  pending:     { label: "Pending",     color: "#f59e0b" },
  accepted:    { label: "Accepted",    color: "#10b981" },
  declined:    { label: "Declined",    color: "#ef4444" },
  checked_in:  { label: "Checked In",  color: "#6366f1" },
  checked_out: { label: "Checked Out", color: "#8b5cf6" },
  BOOKED:      { label: "Booked",      color: "#7c3aed" },
  CANCELLED:   { label: "Cancelled",   color: "#ef4444" },
  COMPLETED:   { label: "Completed",   color: "#10b981" },
};

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  if (!total) return (
    <div className={styles.emptyChart}>
      <BarChart2 size={32} className={styles.emptyChartIcon} /><p>No data available</p>
    </div>
  );
  const r = 38, cx = 50, cy = 50, circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map((d) => {
    const key = d.status || d.name, meta = STATUS_META[key] || {};
    const color = meta.color || "#a78bfa", dash = (d.count / total) * circ;
    const slice = { ...d, dash, offset, color, label: meta.label || key };
    offset += dash; return slice;
  });
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donutChart}>
        <svg viewBox="0 0 100 100" className={styles.donutSvg}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="16" />
          {slices.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-s.offset + circ * 0.25} className={styles.donutSlice} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" className={styles.donutTotal}>{total}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" className={styles.donutLabel}>TOTAL</text>
        </svg>
      </div>
      <div className={styles.donutLegend}>
        {slices.map((s, i) => (
          <div key={i} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            <span className={styles.legendName}>{s.label}</span>
            <span className={styles.legendCount}>{s.count}</span>
            <span className={styles.legendPct}>{((s.count / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BAR CHART — daily trend
═══════════════════════════════════════════════════════════════════ */
function BarChart({ data, color }) {
  if (!data?.length) return (
    <div className={styles.emptyChart}>
      <Activity size={32} className={styles.emptyChartIcon} /><p>No trend data available</p>
    </div>
  );
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className={styles.barChartOuter}><div className={styles.barChart}>
      {data.map((d, i) => {
        const heightPct = Math.max((d.count / max) * 100, 2);
        const label = d.date ? new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
        const showLabel = data.length <= 15 || i % Math.ceil(data.length / 10) === 0;
        return (
          <div key={i} className={styles.barCol} title={`${label}: ${d.count}`}>
            <div className={styles.bar} style={{ height: `${heightPct}%`, background: color }} />
            {showLabel && <span className={styles.barTick}>{label}</span>}
          </div>
        );
      })}
    </div></div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HORIZONTAL BAR LIST
═══════════════════════════════════════════════════════════════════ */
function HBarList({ data, accent }) {
  if (!data?.length) return (
    <div className={styles.emptyChart}>
      <AlertCircle size={28} className={styles.emptyChartIcon} /><p>No data available</p>
    </div>
  );
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className={styles.hBarList}>
      {data.slice(0, 6).map((d, i) => (
        <div key={i} className={styles.hBarItem}>
          <div className={styles.hBarMeta}>
            <span className={styles.hBarRank}>{i + 1}</span>
            <span className={styles.hBarName}>{d.name || d.person_to_meet || "—"}</span>
            <span className={styles.hBarVal}>{d.count}</span>
          </div>
          <div className={styles.hBarTrack}>
            <div className={styles.hBarFill} style={{ width: `${(d.count / max) * 100}%`, background: accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CARD
═══════════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <div className={styles.kpiCard} style={{ "--kpi-accent": accent }}>
      <div className={styles.kpiIcon} style={{ background: `${accent}18`, color: accent }}><Icon size={20} /></div>
      <div className={styles.kpiBody}>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue} style={{ color: accent }}>{value ?? 0}</p>
        {sub && <p className={styles.kpiSub}>{sub}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION HEADING — with subtitle + index badge
═══════════════════════════════════════════════════════════════════ */
function SectionHeading({ icon: Icon, title, subtitle, accent, index }) {
  return (
    <div className={styles.sectionHeading}>
      <div className={styles.sectionHeadingLeft}>
        <div className={styles.sectionHeadingIcon}
          style={{ background: `${accent}12`, color: accent, borderColor: `${accent}25` }}>
          <Icon size={17} />
        </div>
        <div>
          <h2 className={styles.sectionHeadingText}>{title}</h2>
          {subtitle && <p className={styles.sectionHeadingSub}>{subtitle}</p>}
        </div>
      </div>
      <span className={styles.sectionIndex}>{String(index).padStart(2, "0")}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const router = useRouter();
  const [analytics,  setAnalytics]  = useState(null);
  const [company,    setCompany]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);
  const [exporting,  setExporting]  = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAnalytics = useCallback(async (silent = false) => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/auth/login"); return; }
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/exports/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setAnalytics(await res.json());
    } catch {
      showToast("Failed to load analytics data. Please try again.", "error");
    } finally { setLoading(false); setRefreshing(false); }
  }, [router, showToast]);

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (stored) { try { setCompany(JSON.parse(stored)); } catch {} }
    loadAnalytics();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [loadAnalytics]);

  const handleExport = async (type) => {
    const map = {
      visitors: { endpoint: "/api/exports/visitors",            label: "Visitor Records" },
      bookings: { endpoint: "/api/exports/conference-bookings", label: "Conference Bookings" },
      all:      { endpoint: "/api/exports/all",                 label: "Complete Report" },
    };
    const { endpoint, label } = map[type] || {};
    if (!endpoint) return;
    try {
      setExporting(type);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const cd   = res.headers.get("content-disposition");
      let filename = `${label.replace(/\s+/g, "-")}-${Date.now()}.xlsx`;
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m) filename = m[1]; }
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
      showToast(`${label} exported successfully.`, "success");
    } catch { showToast("Export failed. Please try again.", "error"); }
    finally  { setExporting(null); }
  };

  if (loading) return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingSpinner} />
      <p className={styles.loadingText}>Loading analytics…</p>
    </div>
  );

  const v = analytics?.visitors || {};
  const b = analytics?.bookings  || {};
  const visitStatusData   = (v.visitStatusBreakdown || []).map((d) => ({ ...d }));
  const bookingStatusData = (b.statusBreakdown      || []).map((d) => ({ ...d }));

  return (
    <div className={styles.page}>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => router.push("/home")} aria-label="Back">
            <ArrowLeft size={16} /><span>Back</span>
          </button>
          <div className={styles.headerDivider} />
          <div className={styles.headerBrand}>
            <span className={styles.headerTitle}>{company?.name || "Dashboard"}</span>
            <span className={styles.headerSubtitle}>Analytics &amp; Reports</span>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={() => loadAnalytics(true)}
          disabled={refreshing} aria-label="Refresh data">
          <RefreshCw size={15} className={refreshing ? styles.spinning : ""} />
          <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
      </header>

      {/* ── HERO ── */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroPill}>
            <span className={styles.heroPillDot} />
            Live data · Last 30 days
          </div>
          <h1 className={styles.heroTitle}>
            Visitor &amp; Conference <span>Analytics</span>
          </h1>
          <p className={styles.heroSub}>
            Unified intelligence across visitor management and room bookings
          </p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>{v.total ?? "—"}</span>
              <span className={styles.heroStatLabel}>Total Visitors</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>{v.today ?? "—"}</span>
              <span className={styles.heroStatLabel}>Today</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>{b.total ?? "—"}</span>
              <span className={styles.heroStatLabel}>Bookings</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>{b.upcoming ?? "—"}</span>
              <span className={styles.heroStatLabel}>Upcoming</span>
            </div>
          </div>
        </div>
        <div className={styles.heroOrb1} aria-hidden="true" />
        <div className={styles.heroOrb2} aria-hidden="true" />
        <div className={styles.heroGrid}  aria-hidden="true" />
      </div>

      {/* ── BODY ── */}
      <div className={styles.scrollBody}>
        <div className={styles.content}>

          {/* ══ 01 · VISITOR ANALYTICS ══ */}
          <section className={styles.section}>
            <SectionHeading icon={Users} title="Visitor Analytics"
              subtitle="Check-in activity, status breakdown and top hosts"
              accent="#7c3aed" index={1} />

            <div className={styles.kpiGrid}>
              <KpiCard label="Total Visitors"   value={v.total}  icon={Users}       accent="#7c3aed" />
              <KpiCard label="Inside Now"       value={v.active} icon={UserCheck}   accent="#f59e0b" />
              <KpiCard label="Today's Arrivals" value={v.today}  icon={TrendingUp}  accent="#10b981" />
              <KpiCard label="Passes Issued"    value={v.passIssued ?? v.total} icon={CheckCircle} accent="#6366f1" />
            </div>

            <div className={styles.chartRow}>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Daily Visitor Trend</h3>
                    <span className={styles.chartCardSub}>Arrivals over last 30 days</span>
                  </div>
                  <div className={styles.chartAccentBar} style={{ background: "#7c3aed" }} />
                </div>
                <BarChart data={v.dailyTrend || []} color="linear-gradient(180deg,#7c3aed 0%,#a78bfa 100%)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Visit Status</h3>
                    <span className={styles.chartCardSub}>Distribution breakdown</span>
                  </div>
                </div>
                <DonutChart data={visitStatusData} />
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Top Employees Visited</h3>
                    <span className={styles.chartCardSub}>Ranked by visitor count</span>
                  </div>
                </div>
                <HBarList data={v.topEmployees || []} accent="linear-gradient(90deg,#7c3aed,#a78bfa)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Visit Purposes</h3>
                    <span className={styles.chartCardSub}>Most common reasons</span>
                  </div>
                </div>
                <HBarList data={v.topPurposes || []} accent="linear-gradient(90deg,#7c3aed,#a78bfa)" />
              </div>
            </div>
          </section>

          {/* ══ 02 · CONFERENCE ANALYTICS ══ */}
          <section className={styles.section}>
            <SectionHeading icon={CalendarDays} title="Conference Analytics"
              subtitle="Room utilisation, booking patterns and department usage"
              accent="#0ea5e9" index={2} />

            <div className={styles.kpiGrid}>
              <KpiCard label="Total Bookings" value={b.total}     icon={CalendarDays} accent="#0ea5e9" />
              <KpiCard label="Upcoming"       value={b.upcoming}  icon={Clock}        accent="#f59e0b" />
              <KpiCard label="Completed"      value={b.completed} icon={CheckCircle}  accent="#10b981" />
              <KpiCard label="Cancelled"      value={b.cancelled} icon={XCircle}      accent="#ef4444" />
            </div>

            <div className={styles.chartRow}>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Daily Booking Trend</h3>
                    <span className={styles.chartCardSub}>Bookings over last 30 days</span>
                  </div>
                  <div className={styles.chartAccentBar} style={{ background: "#0ea5e9" }} />
                </div>
                <BarChart data={b.dailyTrend || []} color="linear-gradient(180deg,#0ea5e9 0%,#7dd3fc 100%)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Booking Status</h3>
                    <span className={styles.chartCardSub}>Distribution breakdown</span>
                  </div>
                </div>
                <DonutChart data={bookingStatusData} />
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Most Booked Rooms</h3>
                    <span className={styles.chartCardSub}>Ranked by booking count</span>
                  </div>
                </div>
                <HBarList data={b.topRooms || []} accent="linear-gradient(90deg,#0ea5e9,#7dd3fc)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartCardHeader}>
                  <div>
                    <h3 className={styles.chartCardTitle}>Bookings by Department</h3>
                    <span className={styles.chartCardSub}>Top departments</span>
                  </div>
                </div>
                <HBarList data={b.byDepartment || []} accent="linear-gradient(90deg,#0ea5e9,#7dd3fc)" />
              </div>
            </div>
          </section>

          {/* ══ EXPORT ══ */}
          <section className={styles.exportSection}>
            <div className={styles.exportHeader}>
              <div className={styles.exportIconWrap}><FileDown size={22} /></div>
              <div>
                <h3 className={styles.exportTitle}>Export Reports</h3>
                <p className={styles.exportSub}>Download formatted Excel workbooks</p>
              </div>
            </div>

            <div className={styles.exportCards}>

              <div className={styles.exportCard}>
                <div className={styles.exportCardTop}>
                  <div className={styles.exportCardIcon} style={{ background: "#7c3aed12", color: "#7c3aed" }}>
                    <Users size={20} />
                  </div>
                  <span className={styles.exportCardBadge} style={{ background: "#7c3aed10", color: "#7c3aed" }}>.xlsx</span>
                </div>
                <p className={styles.exportCardTitle}>Visitor Records</p>
                <p className={styles.exportCardSub}>Check-in, check-out times, pass status and visitor details</p>
                <button className={styles.exportBtn} style={{ "--eb": "#7c3aed" }}
                  onClick={() => handleExport("visitors")} disabled={!!exporting}>
                  {exporting === "visitors"
                    ? <><RefreshCw size={14} className={styles.spinning} /> Exporting…</>
                    : <><Download size={14} /> Download</>}
                </button>
              </div>

              <div className={styles.exportCard}>
                <div className={styles.exportCardTop}>
                  <div className={styles.exportCardIcon} style={{ background: "#0ea5e912", color: "#0ea5e9" }}>
                    <Calendar size={20} />
                  </div>
                  <span className={styles.exportCardBadge} style={{ background: "#0ea5e910", color: "#0ea5e9" }}>.xlsx</span>
                </div>
                <p className={styles.exportCardTitle}>Conference Bookings</p>
                <p className={styles.exportCardSub}>Room schedules, departments, hosts and booking status</p>
                <button className={styles.exportBtn} style={{ "--eb": "#0ea5e9" }}
                  onClick={() => handleExport("bookings")} disabled={!!exporting}>
                  {exporting === "bookings"
                    ? <><RefreshCw size={14} className={styles.spinning} /> Exporting…</>
                    : <><Download size={14} /> Download</>}
                </button>
              </div>

              <div className={`${styles.exportCard} ${styles.exportCardFull}`}>
                <div className={styles.exportCardTop}>
                  <div className={styles.exportCardIcon} style={{ background: "rgba(255,255,255,0.12)", color: "#fbbf24" }}>
                    <Layers size={20} />
                  </div>
                  <span className={styles.exportCardBadge}
                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>Multi-sheet</span>
                </div>
                <p className={styles.exportCardTitle}>Complete Report</p>
                <p className={styles.exportCardSub}>All visitor and booking data in a single multi-sheet workbook</p>
                <button className={`${styles.exportBtn} ${styles.exportBtnFull}`}
                  onClick={() => handleExport("all")} disabled={!!exporting}>
                  {exporting === "all"
                    ? <><RefreshCw size={14} className={styles.spinning} /> Exporting…</>
                    : <><Download size={14} /> Download All</>}
                </button>
              </div>

            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
