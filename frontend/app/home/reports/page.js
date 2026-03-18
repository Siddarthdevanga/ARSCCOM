"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Download, Users, CalendarDays, TrendingUp, TrendingDown,
  CheckCircle, XCircle, Clock, AlertCircle, Activity, BarChart2,
  FileDown, RefreshCw, UserCheck, Layers, Calendar, Timer,
} from "lucide-react";
import styles from "./style.module.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PERIODS = [
  { key: "today",   label: "Today"   },
  { key: "week",    label: "Week"    },
  { key: "month",   label: "Month"   },
  { key: "quarter", label: "Quarter" },
  { key: "year",    label: "Year"    },
];

const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

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

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const Icon = toast.type === "error" ? XCircle : CheckCircle;
  return (
    <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`} role="alert">
      <Icon size={16} /><span>{toast.msg}</span>
      <button className={styles.toastClose} onClick={onDismiss}><XCircle size={14} /></button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PERIOD PILL SELECTOR
═══════════════════════════════════════════════════════════════ */
function PeriodSelector({ value, onChange }) {
  return (
    <div className={styles.periodBar}>
      {PERIODS.map(p => (
        <button
          key={p.key}
          className={`${styles.periodBtn} ${value === p.key ? styles.periodBtnActive : ""}`}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KPI CARD  — with period-over-period % change
═══════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, prev, icon: Icon, accent, sub, loading }) {
  const pct = prev > 0 ? Math.round(((value - prev) / prev) * 100) : null;
  const up = pct >= 0;
  return (
    <div className={styles.kpiCard} style={{ "--ka": accent }}>
      {loading && <div className={styles.kpiSkeleton} />}
      <div className={styles.kpiIconWrap} style={{ background: `${accent}18`, color: accent }}>
        <Icon size={20} />
      </div>
      <div className={styles.kpiBody}>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue} style={{ color: accent }}>{value ?? 0}</p>
        {pct !== null && (
          <p className={`${styles.kpiChange} ${up ? styles.kpiUp : styles.kpiDown}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(pct)}% vs prev
          </p>
        )}
        {sub && <p className={styles.kpiSub}>{sub}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DONUT CHART
═══════════════════════════════════════════════════════════════ */
function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  if (!total) return (
    <div className={styles.emptyChart}>
      <BarChart2 size={32} className={styles.emptyChartIcon} /><p>No data for this period</p>
    </div>
  );
  const r = 38, cx = 50, cy = 50, circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => {
    const key = d.status || d.name;
    const meta = STATUS_META[key] || {};
    const color = meta.color || "#a78bfa";
    const dash = (d.count / total) * circ;
    const slice = { ...d, dash, offset, color, label: meta.label || key };
    offset += dash;
    return slice;
  });
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donutChart}>
        <svg viewBox="0 0 100 100" className={styles.donutSvg}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="16" />
          {slices.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-s.offset + circ * 0.25}
              className={styles.donutSlice} />
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

/* ═══════════════════════════════════════════════════════════════
   BAR CHART  (vertical, trend)
═══════════════════════════════════════════════════════════════ */
function BarChart({ data, color }) {
  if (!data?.length) return (
    <div className={styles.emptyChart}>
      <Activity size={32} className={styles.emptyChartIcon} /><p>No trend data for this period</p>
    </div>
  );
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className={styles.barChartOuter}>
      <div className={styles.barChart}>
        {data.map((d, i) => {
          const h = Math.max((d.count / max) * 100, 2);
          const showLabel = data.length <= 14 || i % Math.ceil(data.length / 10) === 0;
          return (
            <div key={i} className={styles.barCol} title={`${d.date}: ${d.count}`}>
              <span className={styles.barValue}>{d.count > 0 && d.count}</span>
              <div className={styles.bar} style={{ height: `${h}%`, background: color }} />
              {showLabel && <span className={styles.barTick}>{d.date}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HORIZONTAL BAR LIST
═══════════════════════════════════════════════════════════════ */
function HBarList({ data, accent }) {
  if (!data?.length) return (
    <div className={styles.emptyChart}>
      <AlertCircle size={28} className={styles.emptyChartIcon} /><p>No data for this period</p>
    </div>
  );
  const max = Math.max(...data.map(d => d.count), 1);
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

/* ═══════════════════════════════════════════════════════════════
   HOURLY HEATMAP  — 24-bar chart showing peak check-in hours
═══════════════════════════════════════════════════════════════ */
function HourlyHeatmap({ data, accent }) {
  // data = [{ hour: 0..23, count }]
  const filled = Array.from({ length: 24 }, (_, h) => {
    const found = data?.find(d => Number(d.hour) === h);
    return { hour: h, count: found?.count || 0 };
  });
  const max = Math.max(...filled.map(d => d.count), 1);
  const ampm = (h) => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h-12}pm`;

  return (
    <div className={styles.heatmapWrap}>
      {filled.map((d, i) => {
        const intensity = d.count / max;
        return (
          <div key={i} className={styles.heatmapCell} title={`${ampm(d.hour)}: ${d.count} visitors`}>
            <div
              className={styles.heatmapBar}
              style={{
                height: `${Math.max(intensity * 100, 4)}%`,
                background: accent,
                opacity: 0.15 + intensity * 0.85,
              }}
            />
            {(i % 3 === 0) && <span className={styles.heatmapTick}>{ampm(d.hour)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DOW CHART  — day-of-week activity bar
═══════════════════════════════════════════════════════════════ */
function DowChart({ data, accent }) {
  // data = [{ dow: 1(Sun)..7(Sat), count }]
  const filled = Array.from({ length: 7 }, (_, i) => {
    const found = data?.find(d => Number(d.dow) === i + 1);
    return { day: DOW_LABELS[i], count: found?.count || 0 };
  });
  const max = Math.max(...filled.map(d => d.count), 1);
  return (
    <div className={styles.dowWrap}>
      {filled.map((d, i) => (
        <div key={i} className={styles.dowCol} title={`${d.day}: ${d.count}`}>
          <span className={styles.dowCount}>{d.count || ""}</span>
          <div className={styles.dowBar} style={{
            height: `${Math.max((d.count / max) * 100, 6)}%`,
            background: accent,
            opacity: 0.2 + (d.count / max) * 0.8,
          }} />
          <span className={styles.dowLabel}>{d.day}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAT CHIP — small inline stat inside chart cards
═══════════════════════════════════════════════════════════════ */
function StatChip({ label, value, color }) {
  return (
    <div className={styles.statChip} style={{ "--sc": color }}>
      <span className={styles.statChipVal} style={{ color }}>{value}</span>
      <span className={styles.statChipLbl}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADING
═══════════════════════════════════════════════════════════════ */
function SectionHeading({ icon: Icon, title, subtitle, accent, index }) {
  return (
    <div className={styles.sectionHeading}>
      <div className={styles.sectionLeft}>
        <div className={styles.sectionIcon} style={{ background: `${accent}12`, color: accent, borderColor: `${accent}25` }}>
          <Icon size={17} />
        </div>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {subtitle && <p className={styles.sectionSub}>{subtitle}</p>}
        </div>
      </div>
      <span className={styles.sectionIdx}>{String(index).padStart(2, "0")}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHART CARD WRAPPER
═══════════════════════════════════════════════════════════════ */
function ChartCard({ title, sub, accent, children, chips }) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartCardHead}>
        <div>
          <h3 className={styles.chartCardTitle}>{title}</h3>
          {sub && <span className={styles.chartCardSub}>{sub}</span>}
        </div>
        <div className={styles.chartCardRight}>
          {chips && chips.map((c, i) => <StatChip key={i} {...c} />)}
          {accent && <div className={styles.accentBar} style={{ background: accent }} />}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const router     = useRouter();
  const [period,     setPeriod]     = useState("month");
  const [analytics,  setAnalytics]  = useState(null);
  const [company,    setCompany]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [fetching,   setFetching]   = useState(false);
  const [toast,      setToast]      = useState(null);
  const [exporting,  setExporting]  = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAnalytics = useCallback(async (p = period, silent = false) => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/auth/login"); return; }
    if (!silent) setLoading(true); else setFetching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/exports/analytics?period=${p}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error();
      setAnalytics(await res.json());
    } catch {
      showToast("Failed to load analytics. Please try again.", "error");
    } finally { setLoading(false); setFetching(false); }
  }, [router, showToast, period]);

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (stored) { try { setCompany(JSON.parse(stored)); } catch {} }
    loadAnalytics(period);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);  // eslint-disable-line

  const handlePeriodChange = (p) => {
    setPeriod(p);
    loadAnalytics(p, true);
  };

  const handleExport = async (type) => {
    const map = {
      visitors: { endpoint: "/api/exports/visitors",            label: "Visitor Records"    },
      bookings: { endpoint: "/api/exports/conference-bookings", label: "Conference Bookings" },
      all:      { endpoint: "/api/exports/all",                 label: "Complete Report"     },
    };
    const { endpoint, label } = map[type] || {};
    if (!endpoint) return;
    try {
      setExporting(type);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}?period=${period}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const cd   = res.headers.get("content-disposition");
      let filename = `${label.replace(/\s+/g,"-")}-${period}-${Date.now()}.xlsx`;
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m) filename = m[1]; }
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      showToast(`${label} (${period}) exported successfully.`);
    } catch { showToast("Export failed. Please try again.", "error"); }
    finally { setExporting(null); }
  };

  if (loading) return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingSpinner} />
      <p className={styles.loadingText}>Loading analytics…</p>
    </div>
  );

  const v = analytics?.visitors || {};
  const b = analytics?.bookings  || {};
  const periodLabel = PERIODS.find(p => p.key === period)?.label || "Month";

  return (
    <div className={styles.page}>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>
            <ArrowLeft size={16} /><span>Back</span>
          </button>
          <div className={styles.headerDivider} />
          <div className={styles.headerBrand}>
            <span className={styles.headerTitle}>{company?.name || "Dashboard"}</span>
            <span className={styles.headerSub}>Analytics &amp; Reports</span>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={() => loadAnalytics(period, true)} disabled={fetching}>
          <RefreshCw size={15} className={fetching ? styles.spinning : ""} />
          <span>{fetching ? "Refreshing…" : "Refresh"}</span>
        </button>
      </header>

      {/* ── HERO ── */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroPill}>
            <span className={styles.heroPillDot} />
            Live data · {periodLabel}
            {fetching && <span className={styles.heroPillSpinner} />}
          </div>
          <h1 className={styles.heroTitle}>
            Visitor &amp; Conference <span>Analytics</span>
          </h1>
          <p className={styles.heroSub}>
            Unified intelligence across visitor management and room bookings
          </p>
          <div className={styles.heroStats}>
            {[
              { val: v.total,    label: "Visitors"  },
              { val: v.today,    label: "Today"     },
              { val: b.total,    label: "Bookings"  },
              { val: b.upcoming, label: "Upcoming"  },
            ].map((s, i) => (
              <div key={i} className={styles.heroStat}>
                {i > 0 && <div className={styles.heroStatDiv} />}
                <span className={styles.heroStatVal}>{s.val ?? "—"}</span>
                <span className={styles.heroStatLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.heroOrb1} aria-hidden />
        <div className={styles.heroOrb2} aria-hidden />
        <div className={styles.heroGrid}  aria-hidden />
      </div>

      {/* ── PERIOD SELECTOR (sticky) ── */}
      <div className={styles.periodWrap}>
        <PeriodSelector value={period} onChange={handlePeriodChange} />
        <span className={styles.periodNote}>
          {fetching ? "Updating charts…" : `Showing data for: ${periodLabel}`}
        </span>
      </div>

      {/* ── SCROLL BODY ── */}
      <div className={styles.scrollBody}>
        <div className={styles.content}>

          {/* ══ 01 · VISITOR ANALYTICS ══ */}
          <section className={styles.section}>
            <SectionHeading
              icon={Users} title="Visitor Analytics"
              subtitle={`Check-in activity and trends — ${periodLabel}`}
              accent="#7c3aed" index={1}
            />

            {/* KPI row */}
            <div className={styles.kpiGrid}>
              <KpiCard label="Total Visitors"    value={v.total}      prev={v.prevTotal}  icon={Users}      accent="#7c3aed" loading={fetching} />
              <KpiCard label="Inside Now"        value={v.active}     icon={UserCheck}                      accent="#f59e0b" loading={fetching} />
              <KpiCard label="Today's Arrivals"  value={v.today}      icon={TrendingUp}                     accent="#10b981" loading={fetching} />
              <KpiCard label="Passes Issued"     value={v.passIssued} icon={CheckCircle}                    accent="#6366f1" loading={fetching} />
            </div>

            {/* Trend + Status */}
            <div className={styles.chartRow}>
              <ChartCard
                title={`Visitor Trend — ${periodLabel}`}
                sub="Check-ins over selected period"
                accent="#7c3aed"
                chips={v.total > 0 ? [{ label: "Peak", value: Math.max(...(v.dailyTrend||[]).map(d=>d.count),0), color:"#7c3aed" }] : []}
              >
                <BarChart data={v.dailyTrend || []} color="linear-gradient(180deg,#7c3aed 0%,#a78bfa 100%)" />
              </ChartCard>

              <ChartCard title="Visit Status" sub="Distribution for this period">
                <DonutChart data={(v.visitStatusBreakdown || []).map(d => ({ ...d }))} />
              </ChartCard>
            </div>

            {/* Hourly heatmap + Day-of-week */}
            <div className={styles.chartRow}>
              <ChartCard title="Peak Check-in Hours" sub="Busiest hours of the day (IST)">
                <HourlyHeatmap data={v.hourlyDistribution || []} accent="#7c3aed" />
              </ChartCard>

              <ChartCard title="Activity by Day of Week" sub="Which days see most visitors">
                <DowChart data={v.dowDistribution || []} accent="#7c3aed" />
              </ChartCard>
            </div>

            {/* Top lists */}
            <div className={styles.twoCol}>
              <ChartCard title="Top Employees Visited" sub="Ranked by visitor count">
                <HBarList data={v.topEmployees || []} accent="linear-gradient(90deg,#7c3aed,#a78bfa)" />
              </ChartCard>
              <ChartCard title="Visit Purposes" sub="Most common reasons">
                <HBarList data={v.topPurposes || []} accent="linear-gradient(90deg,#7c3aed,#a78bfa)" />
              </ChartCard>
            </div>
          </section>

          {/* ══ 02 · CONFERENCE ANALYTICS ══ */}
          <section className={styles.section}>
            <SectionHeading
              icon={CalendarDays} title="Conference Analytics"
              subtitle={`Room utilisation and booking patterns — ${periodLabel}`}
              accent="#0ea5e9" index={2}
            />

            {/* KPI row */}
            <div className={styles.kpiGrid}>
              <KpiCard label="Total Bookings" value={b.total}     prev={b.prevTotal}  icon={CalendarDays} accent="#0ea5e9" loading={fetching} />
              <KpiCard label="Upcoming"       value={b.upcoming}                       icon={Clock}        accent="#f59e0b" loading={fetching} />
              <KpiCard label="Completed"      value={b.completed}                      icon={CheckCircle}  accent="#10b981" loading={fetching} />
              <KpiCard label="Cancelled"      value={b.cancelled}                      icon={XCircle}      accent="#ef4444" loading={fetching} />
            </div>

            {/* Avg duration chip */}
            {b.avgDurationMinutes > 0 && (
              <div className={styles.durationBanner}>
                <Timer size={16} />
                <span>Average booking duration this {period}: <strong>{b.avgDurationMinutes} min</strong></span>
              </div>
            )}

            {/* Trend + Status */}
            <div className={styles.chartRow}>
              <ChartCard
                title={`Booking Trend — ${periodLabel}`}
                sub="Bookings over selected period"
                accent="#0ea5e9"
                chips={b.total > 0 ? [{ label: "Peak", value: Math.max(...(b.dailyTrend||[]).map(d=>d.count),0), color:"#0ea5e9" }] : []}
              >
                <BarChart data={b.dailyTrend || []} color="linear-gradient(180deg,#0ea5e9 0%,#7dd3fc 100%)" />
              </ChartCard>

              <ChartCard title="Booking Status" sub="Distribution for this period">
                <DonutChart data={(b.statusBreakdown || []).map(d => ({ ...d }))} />
              </ChartCard>
            </div>

            {/* DoW */}
            <div className={styles.chartRow}>
              <ChartCard title="Bookings by Day of Week" sub="Which days rooms are booked most">
                <DowChart data={b.dowDistribution || []} accent="#0ea5e9" />
              </ChartCard>

              <ChartCard title="Most Booked Rooms" sub="Ranked by booking count">
                <HBarList data={b.topRooms || []} accent="linear-gradient(90deg,#0ea5e9,#7dd3fc)" />
              </ChartCard>
            </div>

            {/* Department */}
            <div className={styles.twoCol}>
              <ChartCard title="Bookings by Department" sub="Top departments">
                <HBarList data={b.byDepartment || []} accent="linear-gradient(90deg,#0ea5e9,#7dd3fc)" />
              </ChartCard>
              <ChartCard title="Completion Rate" sub="Completed vs cancelled bookings">
                <DonutChart data={
                  (b.statusBreakdown || []).filter(d => ["COMPLETED","CANCELLED","BOOKED"].includes(d.status))
                } />
              </ChartCard>
            </div>
          </section>

          {/* ══ EXPORT ══ */}
          <section className={styles.exportSection}>
            <div className={styles.exportHead}>
              <div className={styles.exportIconWrap}><FileDown size={22} /></div>
              <div>
                <h3 className={styles.exportTitle}>Export Reports</h3>
                <p className={styles.exportSub}>
                  Download Excel workbooks scoped to: <strong>{periodLabel}</strong>
                </p>
              </div>
            </div>

            <div className={styles.exportCards}>

              <div className={styles.exportCard}>
                <div className={styles.exportCardTop}>
                  <div className={styles.exportCardIcon} style={{ background:"#7c3aed12", color:"#7c3aed" }}>
                    <Users size={20} />
                  </div>
                  <span className={styles.exportBadge} style={{ background:"#7c3aed10", color:"#7c3aed" }}>.xlsx</span>
                </div>
                <p className={styles.exportCardTitle}>Visitor Records</p>
                <p className={styles.exportCardSub}>Check-in/out times, pass status and visitor details</p>
                <button className={styles.exportBtn} style={{ "--eb":"#7c3aed" }}
                  onClick={() => handleExport("visitors")} disabled={!!exporting}>
                  {exporting === "visitors"
                    ? <><RefreshCw size={14} className={styles.spinning} /> Exporting…</>
                    : <><Download size={14} /> Download {periodLabel}</>}
                </button>
              </div>

              <div className={styles.exportCard}>
                <div className={styles.exportCardTop}>
                  <div className={styles.exportCardIcon} style={{ background:"#0ea5e912", color:"#0ea5e9" }}>
                    <Calendar size={20} />
                  </div>
                  <span className={styles.exportBadge} style={{ background:"#0ea5e910", color:"#0ea5e9" }}>.xlsx</span>
                </div>
                <p className={styles.exportCardTitle}>Conference Bookings</p>
                <p className={styles.exportCardSub}>Room schedules, departments, hosts and booking status</p>
                <button className={styles.exportBtn} style={{ "--eb":"#0ea5e9" }}
                  onClick={() => handleExport("bookings")} disabled={!!exporting}>
                  {exporting === "bookings"
                    ? <><RefreshCw size={14} className={styles.spinning} /> Exporting…</>
                    : <><Download size={14} /> Download {periodLabel}</>}
                </button>
              </div>

              <div className={`${styles.exportCard} ${styles.exportCardFull}`}>
                <div className={styles.exportCardTop}>
                  <div className={styles.exportCardIcon} style={{ background:"rgba(255,255,255,0.12)", color:"#fbbf24" }}>
                    <Layers size={20} />
                  </div>
                  <span className={styles.exportBadge} style={{ background:"rgba(251,191,36,0.15)", color:"#fbbf24" }}>
                    Multi-sheet
                  </span>
                </div>
                <p className={styles.exportCardTitle}>Complete Report</p>
                <p className={styles.exportCardSub}>Visitors + bookings in one workbook — filtered to {periodLabel}</p>
                <button className={`${styles.exportBtn} ${styles.exportBtnFull}`}
                  onClick={() => handleExport("all")} disabled={!!exporting}>
                  {exporting === "all"
                    ? <><RefreshCw size={14} className={styles.spinning} /> Exporting…</>
                    : <><Download size={14} /> Download All ({periodLabel})</>}
                </button>
              </div>

            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
