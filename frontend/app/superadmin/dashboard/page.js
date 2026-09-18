"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Pencil, CreditCard, CalendarDays, Clock, AlertTriangle,
} from "lucide-react";
import styles from "./style.module.css";
import SuperAdminNav from "./NavHeader";
import { APP_VERSION } from "../../constants/appVersion";
import ConfirmModal from "../../components/ConfirmModal";

const TAB_META = {
  overview: { label: "Overview", Icon: LayoutDashboard },
  edit:     { label: "Edit",     Icon: Pencil },
  plan:     { label: "Plan",     Icon: CreditCard },
  dates:    { label: "Dates",    Icon: CalendarDays },
  grace:    { label: "Grace",    Icon: Clock },
  danger:   { label: "Danger",   Icon: AlertTriangle },
};

/* ======================================================
   HELPERS
====================================================== */
const fmt = (val) => (val === null || val === undefined ? "-" : val);

const statusColor = (status) => {
  switch ((status || "").toLowerCase()) {
    case "active":       return styles.badgeActive;
    case "trial":        return styles.badgeTrial;
    case "grace_period": return styles.badgeGracePeriod;
    case "expired":      return styles.badgeExpired;
    case "cancelled":    return styles.badgeCancelled;
    case "pending":      return styles.badgePending;
    default:             return styles.badgePending;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // plan / status / dates
  const [plan, setPlan]               = useState(company.plan || "trial");
  const [status, setStatus]           = useState(company.subscription_status || "pending");
  const [trialEndsAt, setTrialEndsAt] = useState(company.trial_ends_at?.slice(0, 10) || "");
  const [subEndsAt, setSubEndsAt]     = useState(company.subscription_ends_at?.slice(0, 10) || "");

  // grace period
  const [gracePeriodDays, setGracePeriodDays] = useState(10);

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
      const text = (res.ok && data.warnings?.length)
        ? `${data.message} — ⚠️ ${data.warnings.join(" ")}`
        : data.message;
      setMsg({ type: res.ok ? "success" : "error", text });
      if (res.ok) onRefresh();
      return res.ok;
    } catch {
      setMsg({ type: "error", text: "Network error" });
      return false;
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

  const handleGracePeriod = async (enable) => {
    await call("grace-period", "PATCH", { enable, days: gracePeriodDays });
  };

  const TABS = ["overview", "edit", "plan", "dates", "grace", "danger"];

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

        <div className={styles.modalLayout}>

          {/* SIDEBAR */}
          <div className={styles.sidebar}>
            {TABS.map((t) => {
              const { label, Icon } = TAB_META[t];
              return (
                <button
                  key={t}
                  className={`${styles.sidebarTab} ${tab === t ? styles.sidebarTabActive : ""} ${t === "danger" ? styles.sidebarTabDanger : ""}`}
                  onClick={() => { setTab(t); setMsg(null); }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>

          <div className={styles.modalMain}>
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
                <option value="grace_period">Grace Period (10-day default)</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {status === "active" && (
                <p className={styles.hintText}>
                  If this company's trial/subscription end date has already passed, activating requires a new future date — set it in the <b>Dates</b> tab first (or below).
                </p>
              )}
              <button
                className={styles.btnPrimary}
                disabled={loading}
                onClick={() => call("status", "PATCH", {
                  status,
                  endsAt: company.plan === "trial" ? trialEndsAt : subEndsAt,
                })}
              >
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

          {/* ── GRACE PERIOD ── */}
          {tab === "grace" && (
            <div className={styles.formSection}>
              <label className={styles.label}>Grace Period Management</label>
              <p className={styles.hintText}>
                {company.subscription_status === "grace_period"
                  ? `⚠️ Company is currently in grace period. Grace period day: ${company.grace_period_day || 0}/10`
                  : "Set a grace period to allow the company to continue using the platform after subscription expiration."}
              </p>

              {company.grace_period_ends_at && (
                <div className={styles.infoBox} style={{ background: "#FEF3C7", border: "1px solid #F59E0B", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>
                  <p style={{ margin: 0, color: "#92400E", fontSize: "14px" }}>
                    <strong>Grace Period Ends:</strong> {company.grace_period_ends_at?.slice(0, 10) || "-"}
                  </p>
                </div>
              )}

              <div className={styles.divider} />

              <label className={styles.label}>Grace Period Duration (Days)</label>
              <input
                type="number"
                className={styles.input}
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 10)))}
                min="1"
                max="30"
                placeholder="10"
              />
              <p className={styles.hintText}>
                Set the number of days for the grace period (1-30 days). Default is 10 days.
              </p>

              <div className={styles.divider} />

              <button
                className={styles.btnPrimary}
                disabled={loading}
                onClick={() => handleGracePeriod(true)}
              >
                {loading ? "Processing…" : "✓ Enable Grace Period"}
              </button>

              <button
                className={styles.btnWarning}
                disabled={loading}
                onClick={() => handleGracePeriod(false)}
                style={{ marginTop: "12px" }}
              >
                {loading ? "Processing…" : "✕ Clear Grace Period"}
              </button>

              <p className={styles.hintText} style={{ marginTop: "16px" }}>
                <strong>Note:</strong> Enabling grace period will set the company status to "grace_period"
                and calculate the end date based on the duration specified above. Clearing will remove
                the grace period and reset related fields.
              </p>
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
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  {loading ? "Deleting…" : "🗑 Permanently Delete Company"}
                </button>
              </div>
            </div>
          )}

            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        variant="danger"
        title={`Delete "${company.name}"?`}
        message={<>This permanently deletes the company and <strong>ALL</strong> related data — visitors, bookings, responses, everything. This cannot be undone.</>}
        confirmLabel="Permanently Delete"
        loading={loading}
        onConfirm={async () => {
          const ok = await call("", "DELETE", {});
          setShowDeleteConfirm(false);
          // Only close the company modal on success — on failure, stay
          // open so the error message (set by call() above) is visible.
          if (ok) onClose();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

/* ======================================================
   ADD SUB-ADMIN MODAL
====================================================== */
function SubAdminModal({ onClose, onCreated, token, apiBase, showToast }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/superadmin/sub-admins`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      showToast(data.message || (res.ok ? "Sub-admin created" : "Failed to create sub-admin"), res.ok ? "success" : "error");
      if (res.ok) onCreated();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Add Sub-Admin</h2>
            <p className={styles.modalSub}>Read-only access — Landing Page Conversions only</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              className={styles.searchInput}
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <input
              className={styles.searchInput}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={styles.searchInput}
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button className={styles.refreshBtn} type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Read-Only Sub-Admin"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   EXPORT COMPANIES MODAL
====================================================== */
const todayStr = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

function ExportCompaniesModal({ onClose, token, apiBase, showToast }) {
  const [from, setFrom]       = useState(todayStr());
  const [to, setTo]           = useState(todayStr());
  const [downloading, setDownloading] = useState(false);

  const setToday = () => { const t = todayStr(); setFrom(t); setTo(t); };

  const download = async () => {
    if (!from || !to) { showToast("Pick both a from and to date", "error"); return; }
    if (from > to) { showToast("'From' date must be before 'To' date", "error"); return; }

    setDownloading(true);
    try {
      const res = await fetch(`${apiBase}/api/superadmin/companies/export?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Failed to export companies", "error");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      let filename = `companies-${from}-to-${to}.xlsx`;
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m) filename = m[1]; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      showToast("Companies exported");
      onClose();
    } catch {
      showToast("Network error", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Download Companies</h2>
            <p className={styles.modalSub}>Export by registration date range — name, plan, email, phone, status &amp; expiry</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label className={styles.label}>From</label>
                <input type="date" className={styles.input} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className={styles.label}>To</label>
                <input type="date" className={styles.input} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            <button className={styles.filterSelect} style={{ alignSelf: "flex-start" }} onClick={setToday}>
              Today
            </button>

            <button className={styles.btnPrimary} disabled={downloading} onClick={download}>
              {downloading ? "Downloading…" : "⬇ Download Excel"}
            </button>
          </div>
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

  const [activeTab, setActiveTab] = useState(() =>
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "razorpay")
      ? "razorpay"
      : "companies"
  );
  const [razorpaySignups, setRazorpaySignups] = useState([]);
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [resendingId,     setResendingId]     = useState(null);
  const [sendingVideoId,  setSendingVideoId]  = useState(null);
  const [razorpaySearch,  setRazorpaySearch]  = useState("");
  const [razorpayStatus,  setRazorpayStatus]  = useState("all");

  // Restricted sub-admins (role: superadmin_readonly) can only ever see
  // Landing Page Conversions — every other route/tab/action is hidden for
  // them, not just visually but enforced server-side too.
  const isFullAdmin = admin?.role === "superadmin";

  const [showAddAdmin,  setShowAddAdmin]  = useState(false);
  const [showExport,    setShowExport]    = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  /* ── AUTH ── */
  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    const a = localStorage.getItem("sa_admin");
    if (!t || !a) { router.replace("/login"); return; }
    try {
      const parsedAdmin = JSON.parse(a);
      setToken(t);
      setAdmin(parsedAdmin);
      // Restricted role has exactly one view — skip the "All Companies"
      // default and land straight on Landing Page Conversions.
      if (parsedAdmin?.role !== "superadmin") setActiveTab("razorpay");
    } catch {
      localStorage.removeItem("sa_token");
      localStorage.removeItem("sa_admin");
      router.replace("/login");
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
        router.replace("/login");
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

  useEffect(() => {
    // /dashboard is full-superadmin-only server-side — never call it for the
    // restricted role, or the 403 would incorrectly log them out.
    if (token && isFullAdmin) fetchDashboard(token);
  }, [token, isFullAdmin, fetchDashboard]);

  /* ── RAZORPAY SIGNUPS ── */
  const fetchRazorpaySignups = useCallback(async (t) => {
    if (!t) return;
    setRazorpayLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/superadmin/razorpay-signups`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("sa_token");
        localStorage.removeItem("sa_admin");
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setRazorpaySignups(data.signups || []);
    } catch {
      showToast("Failed to load landing page conversions", "error");
    } finally {
      setRazorpayLoading(false);
    }
  }, [apiBase, router]);

  useEffect(() => {
    if (token && activeTab === "razorpay") fetchRazorpaySignups(token);
  }, [token, activeTab, fetchRazorpaySignups]);

  const resendRazorpayPassword = async (companyId) => {
    setResendingId(companyId);
    try {
      const res = await fetch(`${apiBase}/api/superadmin/razorpay-signups/${companyId}/resend-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      showToast(data.message || (res.ok ? "Temp password resent" : "Failed to resend"), res.ok ? "success" : "error");
    } catch {
      showToast("Network error", "error");
    } finally {
      setResendingId(null);
    }
  };

  const sendOnboardingVideo = async (companyId) => {
    setSendingVideoId(companyId);
    try {
      const res = await fetch(`${apiBase}/api/superadmin/razorpay-signups/${companyId}/send-onboarding-message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ day: 1 }),
      });
      const data = await res.json();
      showToast(data.message || (res.ok ? "Video message sent" : "Failed to send"), res.ok ? "success" : "error");
      if (res.ok) fetchRazorpaySignups(token);
    } catch {
      showToast("Network error", "error");
    } finally {
      setSendingVideoId(null);
    }
  };

  /* ── LOGOUT ── */
  const logout = () => {
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_admin");
    router.replace("/login");
  };

  /* ── STATS ── */
  const totalCompanies  = companies.length;
  const activeCount     = companies.filter((c) => c.subscription_status === "active").length;
  const suspendedCount  = companies.filter((c) => c.is_suspended).length;
  const graceCount      = companies.filter((c) => c.subscription_status === "grace_period").length;
  const expiredCount    = companies.filter((c) => c.subscription_status === "expired").length;
  const businessCount   = companies.filter((c) => c.plan === "business").length;
  const enterpriseCount = companies.filter((c) => c.plan === "enterprise").length;
  const trialPlanCount  = companies.filter((c) => c.plan === "trial").length;

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

  const filteredSignups = razorpaySignups.filter((s) => {
    const matchSearch =
      !razorpaySearch ||
      s.name?.toLowerCase().includes(razorpaySearch.toLowerCase()) ||
      s.email?.toLowerCase().includes(razorpaySearch.toLowerCase()) ||
      s.phone?.includes(razorpaySearch);
    const matchStatus =
      razorpayStatus === "all" ||
      (razorpayStatus === "complete" ? s.registration_complete : !s.registration_complete);
    return matchSearch && matchStatus;
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

      {/* ── HEADER + NAV DRAWER ── */}
      <SuperAdminNav
        admin={admin}
        isFullAdmin={isFullAdmin}
        activeView={activeTab}
        onDashboardNav={() => setActiveTab("companies")}
        onRazorpayNav={() => setActiveTab("razorpay")}
        onLogout={logout}
        headerRightExtra={isFullAdmin && (
          <>
            <button className={styles.logoutBtn} style={{ marginRight: "8px" }} onClick={() => setShowExport(true)}>
              ⬇ Export
            </button>
            <button className={styles.logoutBtn} style={{ marginRight: "8px" }} onClick={() => setShowAddAdmin((v) => !v)}>
              + Add Sub-Admin
            </button>
          </>
        )}
      />

      {isFullAdmin && showAddAdmin && (
        <SubAdminModal
          token={token}
          apiBase={apiBase}
          showToast={showToast}
          onClose={() => setShowAddAdmin(false)}
          onCreated={() => setShowAddAdmin(false)}
        />
      )}

      {isFullAdmin && showExport && (
        <ExportCompaniesModal
          token={token}
          apiBase={apiBase}
          showToast={showToast}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── SCROLL BODY ── */}
      <div className={styles.scrollBody}>

        {/* ── HERO ── */}
        {isFullAdmin ? (
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
                <div className={styles.heroStatLabel}>Suspended</div>
                <div className={`${styles.heroStatValue} ${styles.valSuspended}`}>{suspendedCount}</div>
              </div>
              <div className={styles.heroStatCard}>
                <div className={styles.heroStatLabel}>Grace Period</div>
                <div className={`${styles.heroStatValue} ${styles.valGrace}`}>{graceCount}</div>
              </div>
              <div className={styles.heroStatCard}>
                <div className={styles.heroStatLabel}>Expired</div>
                <div className={`${styles.heroStatValue} ${styles.valExpired}`}>{expiredCount}</div>
              </div>
              <div className={styles.heroStatCard}>
                <div className={styles.heroStatLabel}>Business</div>
                <div className={`${styles.heroStatValue} ${styles.valBusiness}`}>{businessCount}</div>
              </div>
              <div className={styles.heroStatCard}>
                <div className={styles.heroStatLabel}>Enterprise</div>
                <div className={`${styles.heroStatValue} ${styles.valEnterprise}`}>{enterpriseCount}</div>
              </div>
              <div className={styles.heroStatCard}>
                <div className={styles.heroStatLabel}>Trial</div>
                <div className={`${styles.heroStatValue} ${styles.valTrial}`}>{trialPlanCount}</div>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.hero}>
            <h1 className={styles.heroTitle}>
              Landing Page <span>Conversions</span>
            </h1>
            <p className={styles.heroSub}>Read-only view of trial signups from the landing page</p>
          </section>
        )}

        {isFullAdmin && activeTab === "companies" && (
          <>
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
                <option value="grace_period">Grace Period</option>
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
                        <th className={styles.stickyCol}>Company</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Visitors</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id} className={c.is_suspended ? styles.rowSuspended : ""}>
                          <td className={styles.stickyCol}>
                            <div className={styles.companyCell}>
                              <span className={styles.companyAvatar} aria-hidden="true">{(c.name || "?").trim().charAt(0).toUpperCase()}</span>
                              <div className={styles.companyCellText}>
                                <span className={styles.companyName}>{c.name}</span>
                                <span className={styles.companySlug}>{c.slug}</span>
                                {c.is_suspended && <span className={styles.suspendedTag}>SUSPENDED</span>}
                              </div>
                            </div>
                          </td>
                          <td><span className={`${styles.badge} ${planColor(c.plan)}`}>{(c.plan || "trial").toUpperCase()}</span></td>
                          <td><span className={`${styles.badge} ${statusColor(c.subscription_status)}`}>{c.subscription_status || "-"}</span></td>
                          {/* Trial/Sub Ends are mutually exclusive per company —
                              only one is ever populated, so one column covers
                              both instead of always showing a dangling "-". */}
                          <td className={styles.dateCell}>{(c.trial_ends_at || c.subscription_ends_at)?.slice(0, 10) || "-"}</td>
                          <td className={styles.numCell}>{c.total_visitors}</td>
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
          </>
        )}

        {activeTab === "razorpay" && (
          <>
            <div className={styles.filterBar}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="🔍  Search name, email or phone…"
                value={razorpaySearch}
                onChange={(e) => setRazorpaySearch(e.target.value)}
              />
              {isFullAdmin && (
                <select className={styles.filterSelect} value={razorpayStatus} onChange={(e) => setRazorpayStatus(e.target.value)}>
                  <option value="all">All Setup Statuses</option>
                  <option value="complete">Complete</option>
                  <option value="incomplete">Setup Incomplete</option>
                </select>
              )}
              <button className={styles.refreshBtn} onClick={() => fetchRazorpaySignups(token)}>↻ Refresh</button>
            </div>

            <div className={styles.tableWrapper}>
              {razorpayLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} />
                  <p>Loading landing page conversions…</p>
                </div>
              ) : filteredSignups.length === 0 ? (
                <div className={styles.emptyState}>No landing-page trial signups found</div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Amount Paid</th>
                        <th>Payment ID</th>
                        <th>Paid On</th>
                        {isFullAdmin && <th>Setup Status</th>}
                        {isFullAdmin && <th>Onboarding Messages</th>}
                        {isFullAdmin && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSignups.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className={styles.companyCell}>
                              <span className={styles.companyAvatar} aria-hidden="true">{(s.name || "?").trim().charAt(0).toUpperCase()}</span>
                              <span className={styles.companyName}>{s.name}</span>
                            </div>
                          </td>
                          <td>{s.email}</td>
                          <td>{s.phone}</td>
                          <td className={styles.numCell}>
                            {s.amount_paid != null ? `₹${(s.amount_paid / 100).toFixed(2)}` : "-"}
                          </td>
                          <td>{s.razorpay_payment_id || "-"}</td>
                          <td className={styles.dateCell}>{s.created_at?.slice(0, 10) || "-"}</td>
                          {isFullAdmin && (
                            <td>
                              {s.registration_complete ? (
                                <span className={`${styles.badge} ${styles.badgeActive}`}>COMPLETE</span>
                              ) : (
                                <span className={`${styles.badge} ${styles.badgePending}`}>SETUP INCOMPLETE</span>
                              )}
                            </td>
                          )}
                          {isFullAdmin && (
                            <td>
                              <div className={styles.dayBadges}>
                                {[1, 5, 7, 10, 12].map((day) => {
                                  const sentDays = (s.onboarding_nurture_sent || "").split(",").filter(Boolean);
                                  const sent = sentDays.includes(String(day));
                                  return (
                                    <span
                                      key={day}
                                      title={`Day ${day}${sent ? " — sent" : " — not sent"}`}
                                      className={`${styles.badge} ${sent ? styles.badgeActive : styles.badgePending}`}
                                    >
                                      {day}{sent ? " ✓" : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          )}
                          {isFullAdmin && (
                            <td>
                              <div className={styles.actionGroup}>
                                <button
                                  className={styles.manageBtn}
                                  disabled={resendingId === s.id}
                                  onClick={() => resendRazorpayPassword(s.id)}
                                >
                                  {resendingId === s.id ? "Sending…" : "Resend Temp Password"}
                                </button>
                                <button
                                  className={styles.manageBtn}
                                  disabled={sendingVideoId === s.id}
                                  onClick={() => sendOnboardingVideo(s.id)}
                                >
                                  {sendingVideoId === s.id ? "Sending…" : "Send Video Message"}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <footer style={{ textAlign: "center", padding: "16px 0 24px", fontSize: "12px", color: "#9980c8" }}>
          Hai Visitor v{APP_VERSION}
        </footer>
      </div>
    </div>
  );
}
