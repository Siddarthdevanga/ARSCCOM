"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "../dashboard/style.module.css";

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

  const [token,   setToken]   = useState(null);
  const [admin,   setAdmin]   = useState(null);
  const [leads,   setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");

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
    return matchSearch && matchFilter;
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
        </div>

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
