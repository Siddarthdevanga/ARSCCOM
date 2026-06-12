"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Users, Calendar, CheckCircle, XCircle, MessageSquare, Star, UserMinus } from "lucide-react";
import styles from "../dashboard/style.module.css";

/* ─────────────── TREE LAYOUT ─────────────── */

const NODE_W    = 138;
const NODE_H    = 72;
const NODE_SM_W = 84;
const NODE_SM_H = 44;
const TREE_W    = 1020;
const TREE_H    = 585;

/*
  Full journey tree:

  [Bot Interaction]
  ├─ (dashed) [No Action]           ← never booked demo, no start action
  ├──────────  [Demo Booked]
  │            ├── [Attended]
  │            │   ├─ (dashed) [No Conversion]   ← attended, didn't buy, not nurtured
  │            │   └──────────  [Converted]
  │            │                └── [Trial][Business][Enterprise][Expired·dashed]
  │            └── [Missed]
  │                └── [In Nurture]
  │                    └── [Step 1][Step 2][Final][Closed]
  └─ (dashed) [Unsubscribed]
*/
const TREE_NODES = [
  // Level 1
  { key: "botInteraction", label: "Bot Interaction", Icon: Users,         color: "#7c3aed", cx: 590,  cy: 55,  size: "lg" },
  // Level 2
  { key: "noAction",       label: "No Action",       Icon: UserMinus,     color: "#94a3b8", cx: 110,  cy: 185, size: "lg" },
  { key: "demoBooked",     label: "Demo Booked",     Icon: Calendar,      color: "#3b82f6", cx: 440,  cy: 185, size: "lg" },
  { key: "unsubscribed",   label: "Unsubscribed",    Icon: UserMinus,     color: "#6b7280", cx: 910,  cy: 185, size: "lg" },
  // Level 3
  { key: "demoAttended",   label: "Attended",        Icon: CheckCircle,   color: "#10b981", cx: 190,  cy: 315, size: "lg" },
  { key: "demoMissed",     label: "Missed",          Icon: XCircle,       color: "#ef4444", cx: 700,  cy: 315, size: "lg" },
  // Level 4
  { key: "noConversion",   label: "No Conversion",   Icon: XCircle,       color: "#f97316", cx: 100,  cy: 430, size: "lg" },
  { key: "converted",      label: "Converted",       Icon: Star,          color: "#f59e0b", cx: 280,  cy: 430, size: "lg" },
  { key: "inNurture",      label: "In Nurture",      Icon: MessageSquare, color: "#8b5cf6", cx: 700,  cy: 430, size: "lg" },
  // Level 5 — Plan breakdown under Converted (centered at cx=280)
  { key: "planTrial",      label: "Trial",           Icon: Users,         color: "#0ea5e9", cx: 142,  cy: 545, size: "sm" },
  { key: "planBusiness",   label: "Business",        Icon: CheckCircle,   color: "#10b981", cx: 234,  cy: 545, size: "sm" },
  { key: "planEnterprise", label: "Enterprise",      Icon: Star,          color: "#7c3aed", cx: 326,  cy: 545, size: "sm" },
  { key: "planExpired",    label: "Expired",         Icon: XCircle,       color: "#ef4444", cx: 418,  cy: 545, size: "sm" },
  // Level 5 — Nurture steps under In Nurture (centered at cx=700)
  { key: "nurtureStep1",   label: "Step 1",          Icon: MessageSquare, color: "#3b82f6", cx: 562,  cy: 545, size: "sm" },
  { key: "nurtureStep2",   label: "Step 2",          Icon: MessageSquare, color: "#8b5cf6", cx: 654,  cy: 545, size: "sm" },
  { key: "nurtureFinal",   label: "Final",           Icon: MessageSquare, color: "#f59e0b", cx: 746,  cy: 545, size: "sm" },
  { key: "nurtureClosed",  label: "Closed",          Icon: UserMinus,     color: "#6b7280", cx: 838,  cy: 545, size: "sm" },
];

// labeled: true → show count+% pill on the edge midpoint
const TREE_EDGES = [
  { from: "botInteraction", to: "noAction",       dashed: true,  labeled: true  },
  { from: "botInteraction", to: "demoBooked",     dashed: false, labeled: true  },
  { from: "botInteraction", to: "unsubscribed",   dashed: true,  labeled: true  },
  { from: "demoBooked",     to: "demoAttended",   dashed: false, labeled: true  },
  { from: "demoBooked",     to: "demoMissed",     dashed: false, labeled: true  },
  { from: "demoAttended",   to: "noConversion",   dashed: true,  labeled: true  },
  { from: "demoAttended",   to: "converted",      dashed: false, labeled: true  },
  { from: "demoMissed",     to: "inNurture",      dashed: false, labeled: true  },
  { from: "converted",      to: "planTrial",      dashed: false, labeled: false },
  { from: "converted",      to: "planBusiness",   dashed: false, labeled: false },
  { from: "converted",      to: "planEnterprise", dashed: false, labeled: false },
  { from: "converted",      to: "planExpired",    dashed: true,  labeled: false },
  { from: "inNurture",      to: "nurtureStep1",   dashed: false, labeled: false },
  { from: "inNurture",      to: "nurtureStep2",   dashed: false, labeled: false },
  { from: "inNurture",      to: "nurtureFinal",   dashed: false, labeled: false },
  { from: "inNurture",      to: "nurtureClosed",  dashed: false, labeled: false },
];

const FLOW_PERIODS = [
  { key: "week",  label: "This Week"  },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year"  },
  { key: "all",   label: "All Time"   },
];

/* ─────────────── STAGE FILTERS ─────────────── */

const STAGE_FILTER = {
  botInteraction: ()  => true,
  noAction:       (l) => !l.demo_id && !["start_with_promeet","book_a_demo"].includes(l.last_action) && !l.unsubscribed,
  demoBooked:     (l) => !!l.demo_id,
  unsubscribed:   (l) => !!l.unsubscribed,
  demoAttended:   (l) => l.demo_attended == 1,
  demoMissed:     (l) => !!l.demo_id && l.demo_attended == 0,
  noConversion:   (l) => l.demo_attended == 1 && l.is_converted != 1 && (l.nurture_step || 0) == 0 && !l.unsubscribed,
  converted:      (l) => l.is_converted == 1,
  inNurture:      (l) => (l.nurture_step || 0) > 0 && !l.unsubscribed,
  planTrial:      (l) => l.company_plan?.toUpperCase() === "TRIAL",
  planBusiness:   (l) => l.company_plan?.toUpperCase() === "BUSINESS",
  planEnterprise: (l) => l.company_plan?.toUpperCase() === "ENTERPRISE",
  planExpired:    (l) => ["expired","suspended"].includes(l.company_sub_status),
  nurtureStep1:   (l) => l.nurture_step == 1 && !l.unsubscribed,
  nurtureStep2:   (l) => l.nurture_step == 2 && !l.unsubscribed,
  nurtureFinal:   (l) => l.nurture_step == 3 && !l.unsubscribed,
  nurtureClosed:  (l) => l.nurture_step == 4 && !l.unsubscribed,
};

function computeFlowStats(leads, period) {
  const now    = new Date();
  const cutoff = { week: 7, month: 30, year: 365 }[period];
  const fl     = cutoff
    ? leads.filter((l) => new Date(l.created_at) >= new Date(now - cutoff * 86400000))
    : leads;
  return {
    botInteraction: fl.length,
    noAction:       fl.filter((l) => !l.demo_id && !["start_with_promeet","book_a_demo"].includes(l.last_action) && !l.unsubscribed).length,
    demoBooked:     fl.filter((l) => !!l.demo_id).length,
    unsubscribed:   fl.filter((l) => !!l.unsubscribed).length,
    demoAttended:   fl.filter((l) => l.demo_attended == 1).length,
    demoMissed:     fl.filter((l) => !!l.demo_id && l.demo_attended == 0).length,
    noConversion:   fl.filter((l) => l.demo_attended == 1 && l.is_converted != 1 && (l.nurture_step || 0) == 0 && !l.unsubscribed).length,
    converted:      fl.filter((l) => l.is_converted == 1).length,
    inNurture:      fl.filter((l) => (l.nurture_step || 0) > 0 && !l.unsubscribed).length,
    planTrial:      fl.filter((l) => l.company_plan?.toUpperCase() === "TRIAL").length,
    planBusiness:   fl.filter((l) => l.company_plan?.toUpperCase() === "BUSINESS").length,
    planEnterprise: fl.filter((l) => l.company_plan?.toUpperCase() === "ENTERPRISE").length,
    planExpired:    fl.filter((l) => ["expired","suspended"].includes(l.company_sub_status)).length,
    nurtureStep1:   fl.filter((l) => l.nurture_step == 1 && !l.unsubscribed).length,
    nurtureStep2:   fl.filter((l) => l.nurture_step == 2 && !l.unsubscribed).length,
    nurtureFinal:   fl.filter((l) => l.nurture_step == 3 && !l.unsubscribed).length,
    nurtureClosed:  fl.filter((l) => l.nurture_step == 4 && !l.unsubscribed).length,
  };
}

/* ─────────────── TREE DIAGRAM COMPONENT ─────────────── */

function LeadFlowTree({ leads, activeStage, onStageClick }) {
  const [flowPeriod, setFlowPeriod] = useState("all");
  const stats   = computeFlowStats(leads, flowPeriod);
  const nodeMap = Object.fromEntries(TREE_NODES.map((n) => [n.key, n]));
  const total   = stats.botInteraction || 1;

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ede9fe", padding: "1.5rem", margin: "0 1.5rem 1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1a0038", margin: 0 }}>Lead Journey Tree</h3>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
            Click any node to filter leads below · dashed = dropout/no-progress · pill = count · %
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FLOW_PERIODS.map((p) => (
            <button key={p.key} onClick={() => setFlowPeriod(p.key)}
              style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: flowPeriod === p.key ? "2px solid #7c3aed" : "1.5px solid #e5e7eb",
                background: flowPeriod === p.key ? "rgba(124,58,237,0.08)" : "#fff",
                color: flowPeriod === p.key ? "#7c3aed" : "#6b7280" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ position: "relative", width: TREE_W, height: TREE_H, margin: "0 auto" }}>

          {/* ── SVG edges ── */}
          <svg width={TREE_W} height={TREE_H}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {TREE_EDGES.map(({ from, to, dashed }) => {
              const fn   = nodeMap[from];
              const tn   = nodeMap[to];
              const hn_f = fn.size === "sm" ? NODE_SM_H / 2 : NODE_H / 2;
              const hn_t = tn.size === "sm" ? NODE_SM_H / 2 : NODE_H / 2;
              const x1   = fn.cx;
              const y1   = fn.cy + hn_f;
              const x2   = tn.cx;
              const y2   = tn.cy - hn_t;
              const midY = (y1 + y2) / 2;
              const isHi = activeStage === to;
              return (
                <path key={`e-${from}-${to}`}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isHi ? tn.color : dashed ? "#cbd5e1" : "#d1d5db"}
                  strokeWidth={isHi ? 2.5 : 1.5}
                  strokeDasharray={dashed ? "6 4" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Arrowheads */}
            {TREE_EDGES.map(({ from, to }) => {
              const tn   = nodeMap[to];
              const hn_t = tn.size === "sm" ? NODE_SM_H / 2 : NODE_H / 2;
              const x2   = tn.cx;
              const y2   = tn.cy - hn_t;
              const isHi = activeStage === to;
              return (
                <polygon key={`arr-${from}-${to}`}
                  points={`${x2},${y2} ${x2 - 5},${y2 - 8} ${x2 + 5},${y2 - 8}`}
                  fill={isHi ? tn.color : "#d1d5db"}
                />
              );
            })}
          </svg>

          {/* ── Edge count labels (positioned divs, on top of SVG) ── */}
          {TREE_EDGES.filter((e) => e.labeled).map(({ from, to }) => {
            const fn     = nodeMap[from];
            const tn     = nodeMap[to];
            const x1     = fn.cx;
            const y1     = fn.cy + NODE_H / 2;
            const x2     = tn.cx;
            const y2     = tn.cy - NODE_H / 2;
            const lx     = (x1 + x2) / 2;
            const ly     = (y1 + y2) / 2;
            const cnt    = stats[to];
            const parent = stats[from] || 1;
            const pct    = Math.round((cnt / parent) * 100);
            return (
              <div key={`lbl-${from}-${to}`}
                style={{
                  position: "absolute",
                  left: lx - 20,
                  top:  ly - 9,
                  background: "rgba(255,255,255,0.97)",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  padding: "1px 5px",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#6b7280",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  lineHeight: "16px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                  zIndex: 2,
                }}>
                {cnt} · {pct}%
              </div>
            );
          })}

          {/* ── Node cards ── */}
          {TREE_NODES.map((node) => {
            const { Icon } = node;
            const count    = stats[node.key];
            const isActive = activeStage === node.key;
            const pct      = Math.round((count / total) * 100);
            const isSm     = node.size === "sm";
            const w        = isSm ? NODE_SM_W : NODE_W;
            const h        = isSm ? NODE_SM_H : NODE_H;

            return (
              <div key={node.key}
                onClick={() => onStageClick(isActive ? null : node.key)}
                title={`${count} leads (${pct}%) — click to filter`}
                style={{
                  position: "absolute",
                  left: node.cx - w / 2,
                  top:  node.cy - h / 2,
                  width: w, height: h,
                  background: isActive ? `${node.color}12` : "#fafafa",
                  border: isActive ? `2px solid ${node.color}` : "1.5px solid #e9e3f5",
                  borderRadius: isSm ? 9 : 12,
                  cursor: "pointer",
                  padding: isSm ? "6px 8px" : "10px 10px 8px",
                  boxSizing: "border-box",
                  boxShadow: isActive ? `0 0 0 3px ${node.color}25` : "0 1px 3px rgba(0,0,0,0.07)",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: isSm ? "row" : "column",
                  alignItems: "center",
                  justifyContent: isSm ? "flex-start" : "center",
                  gap: isSm ? 6 : 3,
                  userSelect: "none",
                  zIndex: 3,
                }}>
                {isSm ? (
                  <>
                    <div style={{ background: `${node.color}18`, borderRadius: 6, padding: "3px 4px", flexShrink: 0 }}>
                      <Icon size={12} color={node.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: node.color, lineHeight: 1 }}>{count}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2 }}>
                        {node.label}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: `${node.color}18`, borderRadius: 7, padding: "4px 6px", display: "flex", alignItems: "center", gap: 5 }}>
                      <Icon size={14} color={node.color} />
                      <span style={{ fontSize: 22, fontWeight: 900, color: node.color, lineHeight: 1 }}>{count}</span>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", lineHeight: 1.3 }}>
                      {node.label}
                    </div>
                    <div style={{ width: "80%", height: 3, borderRadius: 3, background: "#ede9fe", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: node.color, borderRadius: 3 }} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active filter chip */}
      {activeStage && (
        <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(124,58,237,0.06)", borderRadius: 8, fontSize: 12, color: "#7c3aed", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Filtering by: <strong>{TREE_NODES.find((n) => n.key === activeStage)?.label}</strong></span>
          <button onClick={() => onStageClick(null)} style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── TABLE HELPERS ─────────────── */

const ACTION_LABEL = {
  start_with_promeet: "Start With Promeet",
  book_a_demo:        "Book A Demo",
};
const ACTION_COLOR = {
  start_with_promeet: "#7c3aed",
  book_a_demo:        "#d97706",
};
const NURTURE_LABEL = ["—", "Step 1", "Step 2", "Final", "Closed"];
const NURTURE_COLOR = ["#9ca3af", "#3b82f6", "#8b5cf6", "#f59e0b", "#6b7280"];

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};
const fmtDemoDate = (date, time) =>
  date ? `${String(date).split("T")[0]} ${String(time).substring(0, 5)}` : null;

function DemoStatus({ lead, onMarkAttended }) {
  if (!lead.demo_id) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
  if (lead.demo_attended == 1)
    return <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Attended</span>;
  if (lead.demo_attended == 0)
    return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Missed</span>;

  const demoDateTime = new Date(`${String(lead.demo_date).split("T")[0]}T${String(lead.demo_time).substring(0, 8)}`);
  const isPast = demoDateTime < new Date();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ background: isPast ? "#fef3c7" : "#ede9fe", color: isPast ? "#92400e" : "#5b21b6", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
        {isPast ? "Pending" : "Upcoming"}: {fmtDemoDate(lead.demo_date, lead.demo_time)}
      </span>
      {isPast && (
        <button onClick={() => onMarkAttended(lead.demo_id)}
          style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#10b981", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
          Mark Attended
        </button>
      )}
    </div>
  );
}

/* ─────────────── PAGE ─────────────── */

export default function WhatsAppLeadsPage() {
  const router  = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [token,       setToken]       = useState(null);
  const [admin,       setAdmin]       = useState(null);
  const [leads,       setLeads]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("all");
  const [showFlow,    setShowFlow]    = useState(false);
  const [activeStage, setActiveStage] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    const a = localStorage.getItem("sa_admin");
    if (!t || !a) { router.replace("/auth/login"); return; }
    try { setToken(t); setAdmin(JSON.parse(a)); }
    catch {
      localStorage.removeItem("sa_token"); localStorage.removeItem("sa_admin");
      router.replace("/auth/login");
    }
  }, [router]);

  const fetchLeads = useCallback(async (t) => {
    if (!t) return;
    setLoading(true);
    try {
      const res  = await fetch(`${apiBase}/api/superadmin/whatsapp-leads`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401 || res.status === 403) { router.replace("/auth/login"); return; }
      const data = await res.json();
      setLeads(data.leads || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [apiBase, router]);

  useEffect(() => { if (token) fetchLeads(token); }, [token, fetchLeads]);

  const logout = () => {
    localStorage.removeItem("sa_token"); localStorage.removeItem("sa_admin");
    router.replace("/auth/login");
  };

  const markAttended = async (demoId) => {
    try {
      const res  = await fetch(`${apiBase}/api/superadmin/demo-appointments/${demoId}/mark-attended`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) fetchLeads(token);
    } catch { /* silent */ }
  };

  const filtered = leads.filter((l) => {
    const matchSearch = !search ||
      (l.phone || "").includes(search) ||
      (l.name  || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || l.last_action === filter;
    const matchStage  = !activeStage || STAGE_FILTER[activeStage]?.(l);
    return matchSearch && matchFilter && matchStage;
  });

  if (!token) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoContainer}>
            <Image src="/Brand Logo.png" alt="Promeet Logo" width={280} height={90} priority className={styles.brandLogo} />
          </div>
          <span className={styles.superBadge}>SUPERADMIN</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.adminEmail}>{admin?.email}</span>
          <a href="/superadmin/dashboard" className={styles.logoutBtn} style={{ textDecoration: "none", marginRight: 8 }}>← Dashboard</a>
          <button className={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>WhatsApp <span>Leads</span></h1>
          <p className={styles.heroSub}>All contacts who messaged the Promeet WhatsApp bot</p>
          <div className={styles.heroStats}>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Total Leads</div>
              <div className={styles.heroStatValue}>{leads.length}</div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Start With Promeet</div>
              <div className={`${styles.heroStatValue} ${styles.valActive}`}>
                {leads.filter((l) => l.last_action === "start_with_promeet").length}
              </div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Book A Demo</div>
              <div className={`${styles.heroStatValue} ${styles.valTrial}`}>
                {leads.filter((l) => l.last_action === "book_a_demo").length}
              </div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Unsubscribed</div>
              <div className={styles.heroStatValue} style={{ color: "#ef4444" }}>
                {leads.filter((l) => l.unsubscribed).length}
              </div>
            </div>
          </div>
        </section>

        <div className={styles.filterBar}>
          <input className={styles.searchInput} type="text" placeholder="Search by phone or name…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={styles.filterSelect} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="start_with_promeet">Start With Promeet</option>
            <option value="book_a_demo">Book A Demo</option>
          </select>
          <button className={styles.filterSelect} style={{ cursor: "pointer" }} onClick={() => fetchLeads(token)}>Refresh</button>
          <button
            onClick={() => { setShowFlow((v) => !v); setActiveStage(null); }}
            style={{ cursor: "pointer", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: showFlow ? "2px solid #7c3aed" : "1.5px solid #e5e7eb",
              background: showFlow ? "rgba(124,58,237,0.08)" : "#fff",
              color: showFlow ? "#7c3aed" : "#6b7280" }}>
            {showFlow ? "Hide Flow" : "Show Flow"}
          </button>
        </div>

        {showFlow && (
          <LeadFlowTree leads={leads} activeStage={activeStage} onStageClick={setActiveStage} />
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: 16 }}>Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: 16 }}>
            {activeStage
              ? `No leads in "${TREE_NODES.find((n) => n.key === activeStage)?.label}" stage.`
              : "No leads found."}
          </div>
        ) : (
          <div style={{ overflowX: "auto", padding: "0 1.5rem 2rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}>
                  <th style={th}>#</th>
                  <th style={th}>Name</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Action Taken</th>
                  <th style={th}>Demo Status</th>
                  <th style={th}>Nurture</th>
                  <th style={th}>Plan</th>
                  <th style={th}>First Contact</th>
                  <th style={th}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => {
                  const plan      = lead.company_plan?.toUpperCase();
                  const subStatus = lead.company_sub_status;
                  const isExpired = ["expired","suspended"].includes(subStatus);
                  const planColor = plan === "TRIAL" ? "#0ea5e9" : plan === "BUSINESS" ? "#10b981" : plan === "ENTERPRISE" ? "#7c3aed" : null;
                  return (
                    <tr key={lead.id} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff", borderBottom: "1px solid #ede9fe" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {lead.unsubscribed ? <span style={{ color: "#9ca3af" }}>{lead.name || "—"}</span> : (lead.name || "—")}
                      </td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{lead.phone ? `+${lead.phone}` : "—"}</td>
                      <td style={td}>
                        {lead.last_action
                          ? <span style={{ background: ACTION_COLOR[lead.last_action] || "#6b7280", color: "#fff", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{ACTION_LABEL[lead.last_action] || lead.last_action}</span>
                          : <span style={{ color: "#9ca3af", fontSize: 13 }}>No action</span>}
                      </td>
                      <td style={td}><DemoStatus lead={lead} onMarkAttended={markAttended} /></td>
                      <td style={td}>
                        {lead.unsubscribed
                          ? <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Unsubscribed</span>
                          : <span style={{ background: NURTURE_COLOR[lead.nurture_step || 0] + "22", color: NURTURE_COLOR[lead.nurture_step || 0], padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{NURTURE_LABEL[lead.nurture_step || 0]}</span>}
                      </td>
                      <td style={td}>
                        {plan
                          ? <span style={{ background: (isExpired ? "#ef4444" : planColor) + "18", color: isExpired ? "#ef4444" : planColor, padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                              {isExpired ? `${plan} (Expired)` : plan}
                            </span>
                          : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...td, color: "#6b7280", fontSize: 13 }}>{fmtDate(lead.created_at)}</td>
                      <td style={{ ...td, color: "#6b7280", fontSize: 13 }}>{fmtDate(lead.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const th = { padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, letterSpacing: "0.5px" };
const td = { padding: "12px 16px", fontSize: 14, color: "#1f2937" };
