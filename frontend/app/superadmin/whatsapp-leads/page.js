"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Users, CalendarDays, CheckCircle, XCircle, MessageSquare, Star, UserMinus } from "lucide-react";
import styles from "../dashboard/style.module.css";

const FLOW_PERIODS = [
  { key: "week",  label: "This Week"  },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year"  },
  { key: "all",   label: "All Time"   },
];

const STAGES = [
  { key: "botInteraction", label: "Bot Interaction", Icon: Users,          color: "#7c3aed" },
  { key: "demoBooked",     label: "Demo Booked",     Icon: CalendarDays,   color: "#3b82f6" },
  { key: "demoAttended",   label: "Demo Attended",   Icon: CheckCircle,    color: "#10b981" },
  { key: "demoMissed",     label: "Demo Missed",     Icon: XCircle,        color: "#ef4444" },
  { key: "inNurture",      label: "In Nurture",      Icon: MessageSquare,  color: "#8b5cf6" },
  { key: "converted",      label: "Converted",       Icon: Star,           color: "#f59e0b" },
  { key: "unsubscribed",   label: "Unsubscribed",    Icon: UserMinus,      color: "#6b7280" },
];

function computeFlowStats(leads, period) {
  const now = new Date();
  const cutoff = { week: 7, month: 30, year: 365 }[period];
  const fl = cutoff
    ? leads.filter(l => new Date(l.created_at) >= new Date(now - cutoff * 86400000))
    : leads;
  return {
    botInteraction: fl.length,
    demoBooked:     fl.filter(l => l.demo_id).length,
    demoAttended:   fl.filter(l => l.demo_attended === 1).length,
    demoMissed:     fl.filter(l => l.demo_attended === 0).length,
    inNurture:      fl.filter(l => (l.nurture_step || 0) > 0 && !l.unsubscribed).length,
    converted:      fl.filter(l => l.is_converted).length,
    unsubscribed:   fl.filter(l => l.unsubscribed).length,
  };
}

const STAGE_FILTER = {
  botInteraction: () => true,
  demoBooked:     l => !!l.demo_id,
  demoAttended:   l => l.demo_attended === 1,
  demoMissed:     l => l.demo_attended === 0,
  inNurture:      l => (l.nurture_step || 0) > 0 && !l.unsubscribed,
  converted:      l => !!l.is_converted,
  unsubscribed:   l => !!l.unsubscribed,
};

function LeadFlowDiagram({ leads, activeStage, onStageClick }) {
  const [flowPeriod, setFlowPeriod] = useState("all");
  const stats = computeFlowStats(leads, flowPeriod);
  const total = stats.botInteraction || 1;

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ede9fe", padding: "1.5rem", margin: "0 1.5rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1a0038", margin: 0 }}>Lead Flow Diagram</h3>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>Click any stage to filter the leads table below</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {FLOW_PERIODS.map(p => (
            <button key={p.key} onClick={() => setFlowPeriod(p.key)}
              style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: flowPeriod === p.key ? "2px solid #7c3aed" : "1.5px solid #e5e7eb", background: flowPeriod === p.key ? "rgba(124,58,237,0.08)" : "#fff", color: flowPeriod === p.key ? "#7c3aed" : "#6b7280" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
        {STAGES.map((stage, i) => {
          const { Icon } = stage;
          const count = stats[stage.key];
          const pct = Math.round((count / total) * 100);
          const isActive = activeStage === stage.key;
          const isLast = i === STAGES.length - 1;
          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center" }}>
              <div onClick={() => onStageClick(isActive ? null : stage.key)}
                style={{ cursor: "pointer", minWidth: 115, padding: "14px 12px", borderRadius: 12, border: isActive ? `2px solid ${stage.color}` : "1.5px solid #e5e7eb", background: isActive ? `${stage.color}10` : "#faf8ff", textAlign: "center", transition: "all 0.15s", boxShadow: isActive ? `0 0 0 3px ${stage.color}22` : "none" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                  <div style={{ background: `${stage.color}18`, borderRadius: 8, padding: 7 }}>
                    <Icon size={18} color={stage.color} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: stage.color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.3 }}>{stage.label}</div>
                <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: "#e9e3f5", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: stage.color, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{pct}%</div>
              </div>
              {!isLast && (
                <svg width="28" height="16" viewBox="0 0 28 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M0 8 H20 M16 4 L22 8 L16 12" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {activeStage && (
        <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(124,58,237,0.06)", borderRadius: 8, fontSize: 12, color: "#7c3aed", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Filtering by: {STAGES.find(s => s.key === activeStage)?.label}</span>
          <button onClick={() => onStageClick(null)} style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>✕ Clear</button>
        </div>
      )}
    </div>
  );
}

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
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtDemoDate = (date, time) => {
  if (!date) return null;
  const d = String(date).split("T")[0];
  const t = String(time).substring(0, 5);
  return `${d} ${t}`;
};

function DemoStatus({ lead, onMarkAttended }) {
  if (!lead.demo_id) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;

  if (lead.demo_attended === 1)
    return <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>✅ Attended</span>;

  if (lead.demo_attended === 0)
    return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>❌ Missed</span>;

  // attended IS NULL — upcoming or past
  const demoDateTime = new Date(`${String(lead.demo_date).split("T")[0]}T${String(lead.demo_time).substring(0, 8)}`);
  const now = new Date();
  const isPast = demoDateTime < now;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ background: isPast ? "#fef3c7" : "#ede9fe", color: isPast ? "#92400e" : "#5b21b6", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
        {isPast ? "⏳ Pending" : "📅 Upcoming"}: {fmtDemoDate(lead.demo_date, lead.demo_time)}
      </span>
      {isPast && (
        <button
          onClick={() => onMarkAttended(lead.demo_id)}
          style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#10b981", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
        >
          Mark Attended
        </button>
      )}
    </div>
  );
}

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

  /* ── AUTH ── */
  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    const a = localStorage.getItem("sa_admin");
    if (!t || !a) { router.replace("/auth/login"); return; }
    try { setToken(t); setAdmin(JSON.parse(a)); }
    catch { localStorage.removeItem("sa_token"); localStorage.removeItem("sa_admin"); router.replace("/auth/login"); }
  }, [router]);

  /* ── FETCH ── */
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
      const res = await fetch(`${apiBase}/api/superadmin/demo-appointments/${demoId}/mark-attended`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) fetchLeads(token);
    } catch { /* silent */ }
  };

  /* ── FILTER ── */
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
          <a href="/superadmin/dashboard" className={styles.logoutBtn} style={{ textDecoration: "none", marginRight: "8px" }}>← Dashboard</a>
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
            placeholder="🔍  Search by phone or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={styles.filterSelect} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="start_with_promeet">Start With Promeet</option>
            <option value="book_a_demo">Book A Demo</option>
          </select>
          <button className={styles.filterSelect} style={{ cursor: "pointer" }} onClick={() => fetchLeads(token)}>
            🔄 Refresh
          </button>
          <button
            onClick={() => { setShowFlow(v => !v); setActiveStage(null); }}
            style={{ cursor: "pointer", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: showFlow ? "2px solid #7c3aed" : "1.5px solid #e5e7eb", background: showFlow ? "rgba(124,58,237,0.08)" : "#fff", color: showFlow ? "#7c3aed" : "#6b7280" }}>
            {showFlow ? "Hide Flow" : "Show Flow"}
          </button>
        </div>

        {/* FLOW DIAGRAM */}
        {showFlow && (
          <LeadFlowDiagram
            leads={leads}
            activeStage={activeStage}
            onStageClick={setActiveStage}
          />
        )}

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: "16px" }}>Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: "16px" }}>No leads found.</div>
        ) : (
          <div style={{ overflowX: "auto", padding: "0 1.5rem 2rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
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
                      {lead.unsubscribed ? <span style={{ color: "#9ca3af" }}>🚫 {lead.name || "—"}</span> : (lead.name || "—")}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{lead.phone ? `+${lead.phone}` : "—"}</td>
                    <td style={td}>
                      {lead.last_action ? (
                        <span style={{ background: ACTION_COLOR[lead.last_action] || "#6b7280", color: "#fff", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
                          {ACTION_LABEL[lead.last_action] || lead.last_action}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: "13px" }}>No action</span>
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
                    <td style={{ ...td, color: "#6b7280", fontSize: "13px" }}>{fmtDate(lead.created_at)}</td>
                    <td style={{ ...td, color: "#6b7280", fontSize: "13px" }}>{fmtDate(lead.updated_at)}</td>
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

const th = { padding: "12px 16px", textAlign: "left", fontSize: "13px", fontWeight: 700, letterSpacing: "0.5px" };
const td = { padding: "12px 16px", fontSize: "14px", color: "#1f2937" };
