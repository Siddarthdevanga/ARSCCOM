"use client";
/* ============================================================================
   REPORTS — CHART COMPONENTS
   Chart.js replacements for the hand-rolled SVG charts. Component names and
   props are unchanged, so the page's render tree did not have to move.

   Colour rule: the page chrome stays monochrome; colour lives inside the
   charts, where it carries meaning. A series colour tells you which series
   you are looking at — that is information, not decoration.
   ========================================================================== */
import { useMemo } from "react";
import { Activity } from "lucide-react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Tooltip, Legend, Filler, RadialLinearScale,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import styles from "./style.module.css";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Filler, RadialLinearScale
);

/* ── Categorical palette ──────────────────────────────────────────────────
   Ordered so that adjacent series stay distinguishable, and so the first
   colour is the brand amber. */
export const SERIES = [
  "#f5a524", // amber  — brand lead
  "#38bdf8", // sky
  "#34d399", // mint
  "#a78bfa", // violet
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#facc15", // yellow
  "#94a3b8", // slate
];

export const ink = "#17171a";
const grid = "rgba(5,5,5,0.06)";
const tick = "#8d8e97";

const FONT = { family: "'Nunito','Segoe UI',sans-serif", size: 11, weight: "600" };

/* Shared tooltip styling — dark card, matching the app's surfaces. */
const tooltip = {
  backgroundColor: "rgba(5,5,5,0.92)",
  titleColor: "#ffffff",
  bodyColor: "rgba(255,255,255,0.86)",
  borderColor: "rgba(255,255,255,0.12)",
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  displayColors: true,
  boxWidth: 9,
  boxHeight: 9,
  boxPadding: 4,
  titleFont: { ...FONT, size: 12, weight: "800" },
  bodyFont: FONT,
};

const baseOpts = (extra = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 650, easing: "easeOutQuart" },
  interaction: { mode: "index", intersect: false },
  plugins: { legend: { display: false }, tooltip },
  ...extra,
});

const cartesianScales = ({ xLabel = false } = {}) => ({
  x: {
    grid: { display: false, drawBorder: false },
    ticks: { color: tick, font: FONT, maxRotation: 0, autoSkipPadding: 12 },
    display: xLabel !== "hidden",
  },
  y: {
    beginAtZero: true,
    grid: { color: grid, drawBorder: false },
    border: { display: false },
    ticks: { color: tick, font: FONT, precision: 0, maxTicksLimit: 5 },
  },
});

/* Builds a vertical gradient for bar/area fills. Needs the live canvas, so
 * it is produced per-render from the Chart.js scriptable context. */
const vGradient = (ctx, chartArea, from, to) => {
  if (!chartArea) return from;
  const g = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  g.addColorStop(0, to);
  g.addColorStop(1, from);
  return g;
};

const hexA = (hex, a) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* ── Empty state ─────────────────────────────────────────────────────────── */
export function EmptyChart({ icon: Icon = Activity, msg = "No data for this period" }) {
  return (
    <div className={styles.emptyChart}>
      <Icon size={22} />
      <span>{msg}</span>
    </div>
  );
}

/* ── Bar chart (daily trend) ─────────────────────────────────────────────── */
export function SvgBarChart({ data, color = SERIES[0], color2 }) {
  const rows = data || [];
  if (!rows.length) return <EmptyChart />;
  const top = color2 || color;

  return (
    <div className={styles.chartBox}>
      <Bar
        data={{
          labels: rows.map((d) => d.date ?? d.label ?? ""),
          datasets: [{
            label: "Count",
            data: rows.map((d) => Number(d.count) || 0),
            backgroundColor: (c) => vGradient(c.chart.ctx, c.chart.chartArea, top, hexA(color, 0.55)),
            hoverBackgroundColor: top,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 44,
          }],
        }}
        options={baseOpts({ scales: cartesianScales() })}
      />
    </div>
  );
}

/* ── Area / line chart ───────────────────────────────────────────────────── */
export function SvgLineChart({ data, color = SERIES[1] }) {
  const rows = data || [];
  if (rows.length < 2) return <EmptyChart msg="Not enough data points" />;

  return (
    <div className={styles.chartBox}>
      <Line
        data={{
          labels: rows.map((d) => d.date ?? d.label ?? ""),
          datasets: [{
            label: "Count",
            data: rows.map((d) => Number(d.count) || 0),
            borderColor: color,
            borderWidth: 2.5,
            fill: true,
            backgroundColor: (c) =>
              vGradient(c.chart.ctx, c.chart.chartArea, hexA(color, 0.02), hexA(color, 0.34)),
            tension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
          }],
        }}
        options={baseOpts({ scales: cartesianScales() })}
      />
    </div>
  );
}

/* ── Doughnut ────────────────────────────────────────────────────────────── */
export function SvgDonut({ data, meta = {} }) {
  const rows = (data || []).filter((d) => Number(d.count) > 0);
  if (!rows.length) return <EmptyChart />;

  const labels = rows.map((d) => meta[d.status]?.label ?? d.status ?? d.name ?? "—");
  const colors = rows.map((d, i) => meta[d.status]?.color ?? SERIES[i % SERIES.length]);
  const total = rows.reduce((s, d) => s + Number(d.count || 0), 0);

  return (
    <div className={styles.donutBox}>
      <Doughnut
        data={{
          labels,
          datasets: [{
            data: rows.map((d) => Number(d.count) || 0),
            backgroundColor: colors,
            borderColor: "#fff",
            borderWidth: 2,
            hoverOffset: 10,
            hoverBorderColor: "#fff",
          }],
        }}
        options={baseOpts({
          cutout: "66%",
          interaction: { mode: "nearest", intersect: true },
          plugins: {
            legend: {
              display: true,
              position: "bottom",
              labels: {
                color: ink, font: FONT, usePointStyle: true,
                pointStyle: "circle", boxWidth: 8, padding: 12,
              },
            },
            tooltip: {
              ...tooltip,
              callbacks: {
                label: (c) => {
                  const pct = total ? Math.round((c.parsed / total) * 100) : 0;
                  return ` ${c.label}: ${c.parsed} (${pct}%)`;
                },
              },
            },
          },
        })}
      />
      <div className={styles.donutCentre}>
        <strong>{total}</strong>
        <span>TOTAL</span>
      </div>
    </div>
  );
}

/* ── Horizontal bar list ─────────────────────────────────────────────────── */
export function HBarList({ data, color = SERIES[0] }) {
  const rows = (data || []).filter((d) => Number(d.count) > 0);
  if (!rows.length) return <EmptyChart />;

  return (
    <div className={styles.chartBox} style={{ height: Math.max(150, rows.length * 38) }}>
      <Bar
        data={{
          labels: rows.map((d) => d.name ?? "—"),
          datasets: [{
            data: rows.map((d) => Number(d.count) || 0),
            backgroundColor: rows.map((_, i) => SERIES[i % SERIES.length]),
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 22,
          }],
        }}
        options={baseOpts({
          indexAxis: "y",
          interaction: { mode: "nearest", intersect: true },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: grid, drawBorder: false },
              border: { display: false },
              ticks: { color: tick, font: FONT, precision: 0, maxTicksLimit: 5 },
            },
            y: {
              grid: { display: false, drawBorder: false },
              border: { display: false },
              ticks: { color: ink, font: { ...FONT, weight: "700" } },
            },
          },
        })}
      />
    </div>
  );
}

/* ── Hourly distribution (peak hours) ────────────────────────────────────── */
export function HeatmapChart({ data }) {
  const rows = data || [];
  const byHour = useMemo(() => {
    const m = new Array(24).fill(0);
    rows.forEach((d) => { const h = Number(d.hour); if (h >= 0 && h < 24) m[h] = Number(d.count) || 0; });
    return m;
  }, [rows]);

  if (!rows.length) return <EmptyChart msg="No check-ins recorded" />;
  const peak = Math.max(...byHour);

  return (
    <div className={styles.chartBox}>
      <Bar
        data={{
          labels: byHour.map((_, h) => `${String(h).padStart(2, "0")}:00`),
          datasets: [{
            data: byHour,
            // The busiest hour is the answer to the question this chart asks,
            // so it is the only bar that gets the brand colour.
            backgroundColor: byHour.map((n) =>
              n > 0 && n === peak ? SERIES[0] : hexA(SERIES[1], n > 0 ? 0.72 : 0.12)),
            hoverBackgroundColor: SERIES[0],
            borderRadius: 4,
            borderSkipped: false,
          }],
        }}
        options={baseOpts({
          scales: {
            ...cartesianScales(),
            x: {
              grid: { display: false, drawBorder: false },
              ticks: {
                color: tick, font: { ...FONT, size: 10 }, maxRotation: 0,
                callback(v, i) { return i % 3 === 0 ? this.getLabelForValue(v) : ""; },
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.parsed.y} check-in${c.parsed.y === 1 ? "" : "s"}` } },
          },
        })}
      />
    </div>
  );
}

/* ── Day-of-week ─────────────────────────────────────────────────────────── */
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DowChart({ data }) {
  const rows = data || [];
  const counts = useMemo(() => {
    const m = new Array(7).fill(0);
    // MySQL DAYOFWEEK() is 1=Sunday .. 7=Saturday
    rows.forEach((d) => { const i = Number(d.dow) - 1; if (i >= 0 && i < 7) m[i] = Number(d.count) || 0; });
    return m;
  }, [rows]);

  if (!rows.length) return <EmptyChart />;

  return (
    <div className={styles.chartBox}>
      <Bar
        data={{
          labels: DOW,
          datasets: [{
            data: counts,
            backgroundColor: counts.map((_, i) => SERIES[i % SERIES.length]),
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 40,
          }],
        }}
        options={baseOpts({
          interaction: { mode: "nearest", intersect: true },
          scales: cartesianScales(),
        })}
      />
    </div>
  );
}

/* ── Stacked proportion bar ──────────────────────────────────────────────── */
export function StackedBar({ data, meta = {} }) {
  const rows = (data || []).filter((d) => Number(d.count) > 0);
  if (!rows.length) return null;
  const total = rows.reduce((s, d) => s + Number(d.count), 0);

  return (
    <div className={styles.stackedBar}>
      {rows.map((d, i) => {
        const pct = (Number(d.count) / total) * 100;
        const c = meta[d.status]?.color ?? SERIES[i % SERIES.length];
        const label = meta[d.status]?.label ?? d.status ?? d.name;
        return (
          <span
            key={`${label}-${i}`}
            style={{ width: `${pct}%`, background: c }}
            title={`${label}: ${d.count} (${Math.round(pct)}%)`}
          />
        );
      })}
    </div>
  );
}

/* ── Progress ring ───────────────────────────────────────────────────────── */
export function ProgressRing({ value, max, color = SERIES[0], label, sub }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const R = 36, C = 46, CIRC = 2 * Math.PI * R;
  const dash = (pct / 100) * CIRC;

  return (
    <div className={styles.ringWrap}>
      <svg viewBox="0 0 92 92" className={styles.ringSvg}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(5,5,5,0.07)" strokeWidth="10" />
        <circle
          cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${CIRC - dash}`}
          strokeDashoffset={CIRC * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray .7s cubic-bezier(.4,0,.2,1)" }}
        />
        <text x={C} y={C - 4} textAnchor="middle" fontSize="13" fontWeight="900" fill="#0d0d10">{pct}%</text>
        <text x={C} y={C + 10} textAnchor="middle" fontSize="7" fontWeight="700" fill="#9ca3af" letterSpacing="0.3">{label}</text>
      </svg>
      {sub && <p className={styles.ringSub}>{sub}</p>}
    </div>
  );
}

/* ── Grouped bar: purpose category -> subcategory ────────────────────────── */
/* The only dataset the API returned that nothing rendered. Each category is
   a stack, each subcategory a segment, so you can see both the category
   total and what it is made of. */
export function SubcategoryChart({ data }) {
  const rows = (data || []).filter((d) => Number(d.count) > 0);
  if (!rows.length) return <EmptyChart msg="No purpose breakdown for this period" />;

  const categories = [...new Set(rows.map((d) => d.category || "Other"))];
  const subs = [...new Set(rows.map((d) => d.name || "Other"))];

  return (
    <div className={styles.chartBox} style={{ height: Math.max(220, categories.length * 46) }}>
      <Bar
        data={{
          labels: categories,
          datasets: subs.map((s, i) => ({
            label: s,
            data: categories.map((c) =>
              rows.filter((r) => (r.category || "Other") === c && (r.name || "Other") === s)
                  .reduce((sum, r) => sum + Number(r.count || 0), 0)),
            backgroundColor: SERIES[i % SERIES.length],
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 26,
          })),
        }}
        options={baseOpts({
          indexAxis: "y",
          scales: {
            x: {
              stacked: true, beginAtZero: true,
              grid: { color: grid, drawBorder: false },
              border: { display: false },
              ticks: { color: tick, font: FONT, precision: 0, maxTicksLimit: 5 },
            },
            y: {
              stacked: true,
              grid: { display: false, drawBorder: false },
              border: { display: false },
              ticks: { color: ink, font: { ...FONT, weight: "700" } },
            },
          },
          plugins: {
            tooltip,
            legend: {
              display: true, position: "bottom",
              labels: {
                color: ink, font: FONT, usePointStyle: true,
                pointStyle: "circle", boxWidth: 8, padding: 10,
              },
            },
          },
        })}
      />
    </div>
  );
}
