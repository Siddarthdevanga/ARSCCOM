"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./style.module.css";

/* ======================================================
   HELPERS
====================================================== */
const fmt = (val) => (val === null || val === undefined ? "-" : val);

const statusColor = (status) => {
  switch ((status || "").toLowerCase()) {
    case "active":    return styles.badgeActive;
    case "trial":     return styles.badgeTrial;
    case "expired":   return styles.badgeExpired;
    case "cancelled": return styles.badgeCancelled;
    case "pending":   return styles.badgePending;
    default:          return styles.badgePending;
  }
};

const planColor = (plan) => {
  switch ((plan || "").toLowerCase()) {
    case "enterprise": return styles.planEnterprise;
    case "business":   return styles.planBusiness;
    default:           return styles.planTrial;
  }
};

/* ======================================================
   MODAL
====================================================== */
function CompanyModal({ company, onClose, onRefresh, token, apiBase }) {
  const [tab, setTab]         = useState("overview");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);

  // plan / status / dates
  const [plan, setPlan]               = useState(company.plan || "trial");
  const [status, setStatus]           = useState(company.subscription_status || "pending");
  const [trialEndsAt, setTrialEndsAt] = useState(company.trial_ends_at?.slice(0, 10) || "");
  const [subEndsAt, setSubEndsAt]     = useState(company.subscription_ends_at?.slice(0, 10) || "");

  // edit fields
  const [editName,       setEditName]       = useState(company.name || "");
  const [editCompanyId,  setEditCompanyId]  = useState(company.id || "");
  const [editUserEmail,  setEditUserEmail]  = useState("");
  const [editNewEmail,   setEditNewEmail]   = useState("");

  // users list for email picker
  const [users,       setUsers]       = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // fetch users when Edit tab opens
  useEffect(() => {
    if (tab !== "edit") return;
    setUsersLoading(true);
    fetch(`${apiBase}/api/superadmin/companies/${company.id}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const list = d.users || [];
        setUsers(list);
        if (list.length > 0 && !editUserEmail) setEditUserEmail(list[0].email);
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [tab]);

  const call = async (endpoint, method = "PATCH", body = {}) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(
        `${apiBase}/api/superadmin/companies/${company.id}/${endpoint}`,
        {
          method,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      setMsg({ type: res.ok ? "success" : "error", text: data.message });
      if (res.ok) onRefresh();
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompany = async () => {
    const body = {};

    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== company.name) body.name = trimmedName;

    const newId = Number(editCompanyId);
    if (newId && newId !== Number(company.id)) body.newCompanyId = newId;

    if (editUserEmail.trim() && editNewEmail.trim()) {
      body.userEmail    = editUserEmail.trim().toLowerCase();
      body.newUserEmail = editNewEmail.trim().toLowerCase();
    }

    if (!Object.keys(body).length) {
      setMsg({ type: "error", text: "No changes detected" });
      return;
    }

    await call("update", "PATCH", body);
  };

  const TABS = ["overview", "edit", "plan", "dates", "danger"];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{company.name}</h2>
            <p className={styles.modalSub}>Company ID: {company.id}</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* TABS */}
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => { setTab(t); setMsg(null); }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {msg && (
          <div className={`${styles.modalMsg} ${msg.type === "success" ? styles.modalMsgSuccess : styles.modalMsgError}`}>
            {msg.text}
          </div>
        )}

        <div className={styles.modalBody}>

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div className={styles.overviewGrid}>
              {[
                ["Plan",       <span className={`${styles.badge} ${planColor(company.plan)}`}>{(company.plan || "trial").toUpperCase()}</span>],
                ["Status",     <span className={`${styles.badge} ${statusColor(company.subscription_status)}`}>{company.subscription_status || "-"}</span>],
                ["Suspended",  company.is_suspended ? <span className={styles.badgeCancelled}>YES</span> : <span className={styles.badgeActive}>NO</span>],
                ["Trial Ends", fmt(company.trial_ends_at?.slice(0, 10))],
                ["Sub Ends",   fmt(company.subscription_ends_at?.slice(0, 10))],
                ["Rooms",      company.total_rooms],
                ["Bookings",   company.total_bookings],
                ["Visitors",   company.total_visitors],
                ["Users",      company.total_users],
                ["Registered", company.created_at?.slice(0, 10)],
              ].map(([label, val]) => (
                <div key={label} className={styles.overviewItem}>
                  <span className={styles.overviewLabel}>{label}</span>
                  <span className={styles.overviewVal}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── EDIT ── */}
          {tab === "edit" && (
            <div className={styles.formSection}>

              <label className={styles.label}>Company Name</label>
              <input
                type="text"
                className={styles.input}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Company name"
              />

              <div className={styles.divider} />

              <label className={styles.label}>Change Company ID</label>
              <input
                type="number"
                className={styles.input}
                value={editCompanyId}
                onChange={(e) => setEditCompanyId(e.target.value)}
                placeholder="New company ID"
              />
              <p className={styles.hintText}>
                ⚠ This cascades the new ID across all related tables. Use with caution.
              </p>

              <div className={styles.divider} />

              <label className={styles.label}>Change User Email</label>
              {usersLoading ? (
                <p className={styles.hintText}>Loading users…</p>
              ) : users.length === 0 ? (
                <p className={styles.hintText}>No users found for this company</p>
              ) : (
                <div className={styles.inputGroup}>
                  <select
                    className={styles.select}
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.name ? `${u.name} — ${u.email}` : u.email}
                      </option>
                    ))}
                  </select>
                  <input
                    type="email"
                    className={styles.input}
                    value={editNewEmail}
                    onChange={(e) => setEditNewEmail(e.target.value)}
                    placeholder="New email address"
                  />
                </div>
              )}

              <div className={styles.divider} />

              <button
                className={styles.btnPrimary}
                disabled={loading}
                onClick={handleUpdateCompany}
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}

          {/* ── PLAN ── */}
          {tab === "plan" && (
            <div className={styles.formSection}>
              <label className={styles.label}>Change Plan</label>
              <select className={styles.select} value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="trial">Trial</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <button className={styles.btnPrimary} disabled={loading} onClick={() => call("plan", "PATCH", { plan })}>
                {loading ? "Saving…" : "Update Plan"}
              </button>

              <div className={styles.divider} />

              <label className={styles.label}>Change Subscription Status</label>
              <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className={styles.btnPrimary} disabled={loading} onClick={() => call("status", "PATCH", { status })}>
                {loading ? "Saving…" : "Update Status"}
              </button>
            </div>
          )}

          {/* ── DATES ── */}
          {tab === "dates" && (
            <div className={styles.formSection}>
              <label className={styles.label}>Extend Trial Until</label>
              <input
                type="date"
                className={styles.input}
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
              />
              <button className={styles.btnPrimary} disabled={loading} onClick={() => call("extend-trial", "PATCH", { trial_ends_at: trialEndsAt })}>
                {loading ? "Saving…" : "Extend Trial"}
              </button>

              <div className={styles.divider} />

              <label className={styles.label}>Subscription Ends At</label>
              <input
                type="date"
                className={styles.input}
                value={subEndsAt}
                onChange={(e) => setSubEndsAt(e.target.value)}
              />
              <button className={styles.btnPrimary} disabled={loading} onClick={() => call("subscription-dates", "PATCH", { subscription_ends_at: subEndsAt })}>
                {loading ? "Saving…" : "Update Subscription Dates"}
              </button>
            </div>
          )}

          {/* ── DANGER ── */}
          {tab === "danger" && (
            <div className={styles.formSection}>
              <button
                className={styles.btnWarning}
                disabled={loading}
                onClick={() => call("force-cancel", "POST", {})}
              >
                {loading ? "Processing…" : "⚠ Force Cancel Subscription"}
              </button>

              <button
                className={styles.btnWarning}
                disabled={loading}
                onClick={() => call(company.is_suspended ? "unsuspend" : "suspend", "POST", {})}
              >
                {loading ? "Processing…" : company.is_suspended ? "✓ Unsuspend Company" : "⛔ Suspend Company"}
              </button>

              <div className={styles.divider} />

              <div className={styles.dangerZone}>
                <p className={styles.dangerText}>
                  ⚠ Permanently deletes company and ALL related data. This cannot be undone.
                </p>
                <button
                  className={styles.btnDanger}
                  disabled={loading}
                  onClick={async () => {
                    if (!confirm(`DELETE "${company.name}" and ALL its data permanently?`)) return;
                    await call("", "DELETE", {});
                    onClose();
                  }}
                >
                  {loading ? "Deleting…" : "🗑 Permanently Delete Company"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ======================================================
   MAIN PAGE
====================================================== */
export default function SuperAdminDashboard() {
  const router  = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [token,        setToken]        = useState(null);
  const [admin,        setAdmin]        = useState(null);
  const [companies,    setCompanies]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterPlan,   setFilterPlan]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [toast,        setToast]        = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  /* ── AUTH ── */
  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    const a = localStorage.getItem("sa_admin");
    if (!t || !a) { router.replace("/auth/login"); return; }
    try {
      setToken(t);
      setAdmin(JSON.parse(a));
    } catch {
      localStorage.removeItem("sa_token");
      localStorage.removeItem("sa_admin");
      router.replace("/auth/login");
    }
  }, [router]);

  /* ── FETCH ── */
  const fetchDashboard = useCallback(async (t) => {
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/superadmin/dashboard`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("sa_token");
        localStorage.removeItem("sa_admin");
        router.replace("/auth/login");
        return;
      }
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch {
      showToast("Failed to load dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, [apiBase, router]);

  useEffect(() => { if (token) fetchDashboard(token); }, [token, fetchDashboard]);

  /* ── LOGOUT ── */
  const logout = () => {
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_admin");
    router.replace("/auth/login");
  };

  /* ── STATS ── */
  const totalCompanies = companies.length;
  const activeCount    = companies.filter((c) => c.subscription_status === "active").length;
  const trialCount     = companies.filter((c) => c.subscription_status === "trial").length;
  const suspendedCount = companies.filter((c) => c.is_suspended).length;

  /* ── FILTER ── */
  const filtered = companies.filter((c) => {
    const matchSearch =
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.slug?.toLowerCase().includes(search.toLowerCase());
    const matchPlan   = filterPlan   === "all" || c.plan   === filterPlan;
    const matchStatus = filterStatus === "all" || c.subscription_status === filterStatus;
    return matchSearch && matchPlan && matchStatus;
  });

  if (!token) return null;

  return (
    <div className={styles.container}>

      {/* TOAST */}
      {toast.show && (
        <div className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
          {toast.message}
        </div>
      )}

      {/* MODAL */}
      {selected && (
        <CompanyModal
          company={selected}
          token={token}
          apiBase={apiBase}
          onClose={() => setSelected(null)}
          onRefresh={() => fetchDashboard(token)}
        />
      )}

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoContainer}>
            <Image
              src="/Brand Logo.png"
              alt="Promeet Logo"
              width={280}
              height={90}
              priority
              className={styles.brandLogo}
            />
          </div>
          <span className={styles.superBadge}>SUPERADMIN</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.adminEmail}>{admin?.email}</span>
          <button className={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </header>

      {/* ── SCROLL BODY ── */}
      <div className={styles.scrollBody}>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Super<span>Admin</span> Dashboard
          </h1>
          <p className={styles.heroSub}>Full control over all companies, plans and subscriptions</p>

          <div className={styles.heroStats}>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Total Companies</div>
              <div className={styles.heroStatValue}>{totalCompanies}</div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Active</div>
              <div className={`${styles.heroStatValue} ${styles.valActive}`}>{activeCount}</div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>On Trial</div>
              <div className={`${styles.heroStatValue} ${styles.valTrial}`}>{trialCount}</div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Suspended</div>
              <div className={`${styles.heroStatValue} ${styles.valSuspended}`}>{suspendedCount}</div>
            </div>
          </div>
        </section>

        {/* ── FILTERS ── */}
        <div className={styles.filterBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="🔍  Search company name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={styles.filterSelect} value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
            <option value="all">All Plans</option>
            <option value="trial">Trial</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select className={styles.filterSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className={styles.refreshBtn} onClick={() => fetchDashboard(token)}>↻ Refresh</button>
        </div>

        {/* ── TABLE ── */}
        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Loading companies…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>No companies found</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Trial Ends</th>
                    <th>Sub Ends</th>
                    <th>Rooms</th>
                    <th>Bookings</th>
                    <th>Visitors</th>
                    <th>Users</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={c.is_suspended ? styles.rowSuspended : ""}>
                      <td>
                        <div className={styles.companyCell}>
                          <span className={styles.companyName}>{c.name}</span>
                          <span className={styles.companySlug}>{c.slug}</span>
                          {c.is_suspended && <span className={styles.suspendedTag}>SUSPENDED</span>}
                        </div>
                      </td>
                      <td><span className={`${styles.badge} ${planColor(c.plan)}`}>{(c.plan || "trial").toUpperCase()}</span></td>
                      <td><span className={`${styles.badge} ${statusColor(c.subscription_status)}`}>{c.subscription_status || "-"}</span></td>
                      <td className={styles.dateCell}>{c.trial_ends_at?.slice(0, 10) || "-"}</td>
                      <td className={styles.dateCell}>{c.subscription_ends_at?.slice(0, 10) || "-"}</td>
                      <td className={styles.numCell}>{c.total_rooms}</td>
                      <td className={styles.numCell}>{c.total_bookings}</td>
                      <td className={styles.numCell}>{c.total_visitors}</td>
                      <td className={styles.numCell}>{c.total_users}</td>
                      <td>
                        <button className={styles.manageBtn} onClick={() => setSelected(c)}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
