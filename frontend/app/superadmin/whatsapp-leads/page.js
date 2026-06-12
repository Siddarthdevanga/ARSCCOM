"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Users, Calendar, CheckCircle, XCircle, MessageSquare, Star, UserMinus } from "lucide-react";
import styles from "../dashboard/style.module.css";

/* ───────────── FLOW TREE CONSTANTS ───────────── */

const FLOW_PERIODS = [
  { key: "week",  label: "This Week"  },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year"  },
  { key: "all",   label: "All Time"   },
];

const NODE_W  = 138;
const NODE_H  = 74;
const TREE_W  = 700;
const TREE_H  = 490;

// cx / cy = center of each node in the SVG canvas
const TREE_NODES = [
  { key: "botInteraction", label: "Bot Interaction", Icon: Users,         color: "#7c3aed", cx: 350, cy: 55  },
  { key: "demoBooked",     label: "Demo Booked",     Icon: Calendar,      color: "#3b82f6", cx: 190, cy: 185 },
  { key: "unsubscribed",   label: "Unsubscribed",    Icon: UserMinus,     color: "#6b7280", cx: 548, cy: 185 },
  { key: "demoAttended",   label: "Attended",        Icon: CheckCircle,   color: "#10b981", cx: 82,  cy: 315 },
  { key: "demoMissed",     label: "Missed",          Icon: XCircle,       color: "#ef4444", cx: 300, cy: 315 },
  { key: "converted",      label: "Converted",       Icon: Star,          color: "#f59e0b", cx: 82,  cy: 440 },
  { key: "inNurture",      label: "In Nurture",      Icon: MessageSquare, color: "#8b5cf6", cx: 300, cy: 440 },
];

const TREE_EDGES = [
  { from: "botInteraction", to: "demoBooked",   dashed: false },
  { from: "botInteraction", to: "unsubscribed", dashed: true  },
  { from: "demoBooked",     to: "demoAttended", dashed: false },
  { from: "demoBooked",     to: "demoMissed",   dashed: false },
  { from: "demoAttended",   to: "converted",    dashed: false },
  { from: "demoMissed",     to: "inNurture",    dashed: false },
];

/* ───────────── STAGE FILTERS (used for table) ───────────── */

const STAGE_FILTER = {
  botInteraction: ()  => true,
  demoBooked:     (l) => !!l.demo_id,
  demoAttended:   (l) => l.demo_attended == 1,
  demoMissed:     (l) => !!l.demo_id && l.demo_attended == 0,
  inNurture:      (l) => (l.nurture_step || 0) > 0 && !l.unsubscribed,
  converted:      (l) => l.is_converted == 1,
  unsubscribed:   (l) => !!l.unsubscribed,
};

function computeFlowStats(leads, period) {
  const now    = new Date();
  const cutoff = { week: 7, month: 30, year: 365 }[period];
  const fl     = cutoff
    ? leads.filter((l) => new Date(l.created_at) >= new Date(now - cutoff * 86400000))
    : leads;
  return {
    botInteraction: fl.length,
    demoBooked:     fl.filter((l) => !!l.demo_id).length,
    demoAttended:   fl.filter((l) => l.demo_attended == 1).length,
    demoMissed:     fl.filter((l) => !!l.demo_id && l.demo_attended == 0).length,
    inNurture:      fl.filter((l) => (l.nurture_step || 0) > 0 && !l.unsubscribed).length,
    converted:      fl.filter((l) => l.is_converted == 1).length,
    unsubscribed:   fl.filter((l) => !!l.unsubscribed).length,
  };
}

/* ───────────── TREE DIAGRAM COMPONENT ───────────── */

function LeadFlowTree({ leads, activeStage, onStageClick }) {
  const [flowPeriod, setFlowPeriod] = useState("all");
  const stats   = computeFlowStats(leads, flowPeriod);
  const nodeMap = Object.fromEntries(TREE_NODES.map((n) => [n.key, n]));

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ede9fe", padding: "1.5rem", margin: "0 1.5rem 1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1a0038", margin: 0 }}>Lead Journey Tree</h3>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>Click any node to filter leads below · dashed line = dropout</p>
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

          {/* SVG edges */}
          <svg
            width={TREE_W} height={TREE_H}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {TREE_EDGES.map(({ from, to, dashed }) => {
              const fn  = nodeMap[from];
              const tn  = nodeMap[to];
              const x1  = fn.cx;
              const y1  = fn.cy + NODE_H / 2;
              const x2  = tn.cx;
              const y2  = tn.cy - NODE_H / 2;
              const midY = (y1 + y2) / 2;
              const isHighlighted = activeStage === to;
              return (
                <path
                  key={`${from}-${to}`}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isHighlighted ? tn.color : "#d1d5db"}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={dashed ? "6 4" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
            {/* arrowheads */}
            {TREE_EDGES.map(({ from, to }) => {
              const tn = nodeMap[to];
              const x2 = tn.cx;
              const y2 = tn.cy - NODE_H / 2;
              const isHighlighted = activeStage === to;
              return (
                <polygon
                  key={`arr-${from}-${to}`}
                  points={`${x2},${y2} ${x2 - 5},${y2 - 9} ${x2 + 5},${y2 - 9}`}
                  fill={isHighlighted ? tn.color : "#d1d5db"}
                />
              );
            })}
          </svg>

          {/* Node cards */}
          {TREE_NODES.map((node) => {
            const { Icon } = node;
            const count    = stats[node.key];
            const isActive = activeStage === node.key;
            const pct      = stats.botInteraction > 0
              ? Math.round((count / stats.botInteraction) * 100)
              : 0;
            return (
              <div
                key={node.key}
                onClick={() => onStageClick(isActive ? null : node.key)}
                title={`${count} leads (${pct}%) — click to filter`}
                style={{
                  position: "absolute",
                  left:   node.cx - NODE_W / 2,
                  top:    node.cy - NODE_H / 2,
                  width:  NODE_W,
                  height: NODE_H,
                  background: isActive ? `${node.color}12` : "#fafafa",
                  border: isActive ? `2px solid ${node.color}` : "1.5px solid #e9e3f5",
                  borderRadius: 12,
                  cursor: "pointer",
                  padding: "10px 10px 8px",
                  boxSizing: "border-box",
                  boxShadow: isActive ? `0 0 0 4px ${node.color}25` : "0 1px 3px rgba(0,0,0,0.07)",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  userSelect: "none",
                }}>
                <div style={{ background: `${node.color}18`, borderRadius: 7, padding: "4px 6px", display: "flex", alignItems: "center", gap: 5 }}>
                  <Icon size={14} color={node.color} />
                  <span style={{ fontSize: 20, fontWeight: 900, color: node.color, lineHeight: 1 }}>{count}</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", lineHeight: 1.3 }}>
                  {node.label}
                </div>
                <div style={{ width: "80%", height: 3, borderRadius: 3, background: "#ede9fe", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: node.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active filter chip */}
      {activeStage && (
        <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(124,58,237,0.06)", borderRadius: 8, fontSize: 12, color: "#7c3aed", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Filtering by: {TREE_NODES.find((n) => n.key === activeStage)?.label}</span>
          <button onClick={() => onStageClick(null)} style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── TABLE HELPERS ───────────── */

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

const fmtDemoDate = (date, time) => {
  if (!date) return null;
  const d = String(date).split("T")[0];
  const t = String(time).substring(0, 5);
  return `${d} ${t}`;
};

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

/* ───────────── PAGE ───────────── */

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

  /* AUTH */
  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    const a = localStorage.getItem("sa_admin");
    if (!t || !a) { router.replace("/auth/login"); return; }
    try { setToken(t); setAdmin(JSON.parse(a)); }
    catch {
      localStorage.removeItem("sa_token");
      localStorage.removeItem("sa_admin");
      router.replace("/auth/login");
    }
  }, [router]);

  /* FETCH */
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
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_admin");
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

  /* FILTER */
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

      {/* HEADER */}
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

        {/* HERO */}
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

        {/* FILTERS */}
        <div className={styles.filterBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by phone or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={styles.filterSelect} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="start_with_promeet">Start With Promeet</option>
            <option value="book_a_demo">Book A Demo</option>
          </select>
          <button className={styles.filterSelect} style={{ cursor: "pointer" }} onClick={() => fetchLeads(token)}>
            Refresh
          </button>
          <button
            onClick={() => { setShowFlow((v) => !v); setActiveStage(null); }}
            style={{ cursor: "pointer", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: showFlow ? "2px solid #7c3aed" : "1.5px solid #e5e7eb",
              background: showFlow ? "rgba(124,58,237,0.08)" : "#fff",
              color: showFlow ? "#7c3aed" : "#6b7280" }}>
            {showFlow ? "Hide Flow" : "Show Flow"}
          </button>
        </div>

        {/* FLOW TREE */}
        {showFlow && (
          <LeadFlowTree
            leads={leads}
            activeStage={activeStage}
            onStageClick={setActiveStage}
          />
        )}

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: 16 }}>Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: 16 }}>
            {activeStage ? `No leads in "${TREE_NODES.find((n) => n.key === activeStage)?.label}" stage.` : "No leads found."}
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
                  <th style={th}>First Contact</th>
                  <th style={th}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr key={lead.id} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff", borderBottom: "1px solid #ede9fe" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {lead.unsubscribed
                        ? <span style={{ color: "#9ca3af" }}>{lead.name || "—"}</span>
                        : (lead.name || "—")}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{lead.phone ? `+${lead.phone}` : "—"}</td>
                    <td style={td}>
                      {lead.last_action ? (
                        <span style={{ background: ACTION_COLOR[lead.last_action] || "#6b7280", color: "#fff", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {ACTION_LABEL[lead.last_action] || lead.last_action}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>No action</span>
                      )}
                    </td>
                    <td style={td}>
                      <DemoStatus lead={lead} onMarkAttended={markAttended} />
                    </td>
                    <td style={td}>
                      {lead.unsubscribed ? (
                        <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Unsubscribed</span>
                      ) : (
                        <span style={{ background: NURTURE_COLOR[lead.nurture_step || 0] + "22", color: NURTURE_COLOR[lead.nurture_step || 0], padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          {NURTURE_LABEL[lead.nurture_step || 0]}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, color: "#6b7280", fontSize: 13 }}>{fmtDate(lead.created_at)}</td>
                    <td style={{ ...td, color: "#6b7280", fontSize: 13 }}>{fmtDate(lead.updated_at)}</td>
                  </tr>
                ))}
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
