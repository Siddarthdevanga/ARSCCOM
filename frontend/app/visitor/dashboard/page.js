"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/* ─── Visit Status Badge ─────────────────── */
const VS_CONFIG = {
  pending:     { label: "Pending",     bg: "rgba(240,165,0,0.12)",  color: "#c77800" },
  accepted:    { label: "Accepted",    bg: "rgba(0,184,148,0.12)",  color: "#00a875" },
  declined:    { label: "Declined",    bg: "rgba(204,17,0,0.1)",    color: "#cc1100" },
  checked_in:  { label: "Checked In",  bg: "rgba(59,130,246,0.12)", color: "#2563eb" },
  checked_out: { label: "Checked Out", bg: "rgba(98,0,214,0.1)",    color: "#6200d6" },
};

function VisitStatusBadge({ status }) {
  const cfg = VS_CONFIG[status] || VS_CONFIG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 50, fontSize: 10,
      fontWeight: 800, background: cfg.bg, color: cfg.color,
      whiteSpace: "nowrap",
    }}>
      ● {cfg.label}
    </span>
  );
}

/* ─── Duration formatter ─────────────────── */
const calcDuration = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return "—";
  const mins = Math.round((new Date(checkOut) - new Date(checkIn)) / 60_000);
  if (isNaN(mins) || mins < 0) return "—";
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
};

/* ─── Time formatter ─────────────────────── */
const fmtTime = (dt) => {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

/* ─── Date formatter ─────────────────────── */
const fmtDate = (dt) => {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", {
    month: "short", day: "numeric",
  });
};

export default function VisitorDashboard() {
  const router = useRouter();
  const [data,           setData]           = useState(null);
  const [company,        setCompany]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [navOpen,        setNavOpen]        = useState(false);
  const [qrUrl,          setQrUrl]          = useState(null);
  const [regUrl,         setRegUrl]         = useState("");
  const [toast,          setToast]          = useState(null);
  const [checkingOut,    setCheckingOut]    = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const toastTimer = useRef(null);
  const pollTimer  = useRef(null);

  const showToast = (msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const getToken = () => localStorage.getItem("token");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/visitors/dashboard`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.replace("/"); return; }
      const json = await res.json();
      setData(json);
    } catch {
      /* silent on poll */
    }
  }, [router]);

  useEffect(() => {
    const token  = getToken();
    const stored = localStorage.getItem("company");
    if (!token) { router.replace("/"); return; }

    if (stored) {
      try { setCompany(JSON.parse(stored)); } catch {}
    }

    fetchDashboard().then(() => setLoading(false));
    pollTimer.current = setInterval(fetchDashboard, 30_000);
    return () => clearInterval(pollTimer.current);
  }, [fetchDashboard]);

  useEffect(() => {
    if (!company?.slug) return;
    const url = `${window.location.origin}/visitor/${company.slug}`;
    setRegUrl(url);
    QRCode.toDataURL(url, {
      width: 220, margin: 2,
      color: { dark: "#1a0038", light: "#ffffff" },
    }).then(setQrUrl).catch(() => {});
  }, [company]);

  const handleCheckout = async (visitorCode) => {
    setCheckingOut(visitorCode);
    try {
      const res = await fetch(`${API}/api/visitors/${visitorCode}/checkout`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      showToast("Visitor checked out.");
      await fetchDashboard();
    } catch {
      showToast("Checkout failed.", "error");
    } finally {
      setCheckingOut(null);
    }
  };

  const handleVisitStatus = async (visitorCode, status) => {
    const key = `${visitorCode}-${status}`;
    setUpdatingStatus(key);
    try {
      const res = await fetch(`${API}/api/visitors/${visitorCode}/visit-status`, {
        method:  "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      showToast(status === "accepted" ? "Visit accepted ✓" : "Visit declined.");
      await fetchDashboard();
    } catch {
      showToast("Failed to update status.", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(regUrl)
      .then(() => showToast("Registration link copied!", "success"))
      .catch(() => showToast("Copy failed.", "error"));
  };

  const downloadPdf = () => {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = "visitor-qr.png";
    link.click();
  };

  if (loading) return (
    <div className={styles.loading}><div className={styles.spinner} /></div>
  );

  /* ─────────────────────────────────────────────────────────
     STATS — read keys returned by the fixed controller:
       totalVisitors    (was: stats.totalVisitors  — prev: stats.today)
       activeVisitors   (was: stats.activeVisitors — prev: stats.inside)
       pendingVisits    (was: stats.pendingVisits  — prev: stats.pending)
       planLimit        (now inlined into stats)
       planVisitorsUsed (now inlined into stats)
  ───────────────────────────────────────────────────────── */
  const stats     = data?.stats || {};
  const active    = data?.activeVisitors    || [];
  const history   = data?.checkedOutVisitors || [];

  const totalVisitors = stats.totalVisitors  ?? 0;
  const activeCount   = stats.activeVisitors ?? 0;

  // FIX 7: plan fields are now inlined in stats
  const planLimit = stats.planLimit        ?? 0;
  const planUsed  = stats.planVisitorsUsed ?? 0;
  const planPct   = planLimit > 0 ? Math.min((planUsed / planLimit) * 100, 100) : 0;
  const planColor = planPct > 85 ? "#cc1100" : planPct > 60 ? "#f0a500" : "#6200d6";
  const atLimit   = planLimit > 0 && planUsed >= planLimit;

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.hamburgerBtn} onClick={() => setNavOpen(true)} aria-label="Menu">
            <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
          </button>
          <span className={styles.logoText}>{company?.name || "Visitor Dashboard"}</span>
        </div>
        <div className={styles.rightHeader}>
          {company?.logo && (
            <Image src={company.logo} alt="Logo" width={72} height={36}
              className={styles.companyLogo} unoptimized />
          )}
          <button className={styles.newBtn} disabled={atLimit}
            onClick={() => router.push("/visitor/primary_details")}>
            + New Visit
          </button>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>
            ← Home
          </button>
        </div>
      </header>

      {/* NAV OVERLAY */}
      {navOpen && <div className={styles.navOverlay} onClick={() => setNavOpen(false)} />}

      {/* NAV PANEL */}
      <div className={`${styles.navPanel} ${navOpen ? styles.navPanelOpen : ""}`}>
        <div className={styles.navPanelHeader}>
          <h3>Registration QR</h3>
          <button className={styles.navCloseBtn} onClick={() => setNavOpen(false)}>✕</button>
        </div>
        <div className={styles.navPanelBody}>
          {qrUrl ? (
            <>
              <div className={styles.qrSection}>
                <img src={qrUrl} alt="QR Code" className={styles.qrImage} />
                <p className={styles.qrHint}>Scan to Register</p>
              </div>
              <div className={styles.urlSection}>
                <label>Registration Link</label>
                <div className={styles.urlBox}>
                  <input className={styles.urlInput} readOnly value={regUrl} />
                  <button className={styles.copyBtn} onClick={copyUrl}>📋</button>
                </div>
              </div>
              <button className={styles.downloadPdfBtn} onClick={downloadPdf}>
                ⬇ Download QR Image
              </button>
            </>
          ) : (
            <div className={styles.navQRLoading}>
              <div className={styles.spinner} /><p>Generating QR…</p>
            </div>
          )}
          <div className={styles.navInstructions}>
            <h4>How It Works</h4>
            <ol>
              <li>Print or display the QR code at reception</li>
              <li>Visitors scan with their phone</li>
              <li>They complete the registration form</li>
              <li>A pass is sent to their email instantly</li>
              <li>The person to meet gets a notification</li>
            </ol>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Visitor <span>Dashboard</span></h1>
        <p className={styles.heroSub}>Real-time overview of all visitors on premises</p>
        <div className={styles.heroStats}>
          <div className={styles.heroStatCard}>
            <div className={styles.heroStatLabel}>Total Visitors</div>
            <div className={styles.heroStatValue}>{totalVisitors}</div>
          </div>
          <div className={styles.heroStatCard}>
            <div className={styles.heroStatLabel}>Currently In</div>
            <div className={styles.heroStatValue}>{activeCount}</div>
          </div>
          <div className={styles.heroStatCard}>
            <div className={styles.heroStatLabel}>Checked Out</div>
            <div className={styles.heroStatValue}>{stats.checkedOutToday ?? 0}</div>
          </div>
        </div>
      </div>

      {/* UPGRADE MSG */}
      {atLimit && (
        <div className={styles.upgradeMsg}>
          ⚠ Visitor limit reached for your plan. Upgrade to allow new check-ins.
        </div>
      )}

      {/* PLAN BAR */}
      {planLimit > 0 && (
        <div className={styles.planBarWrapper}>
          <div className={styles.planHeader}>
            <span>Plan Usage</span>
            <span className={styles.planName}>{planUsed} / {planLimit} visits</span>
          </div>
          <div className={styles.planBarBg}>
            <div className={styles.planBarFill}
              style={{ width: `${planPct}%`, background: planColor }} />
          </div>
          <div className={styles.planFooter}>
            <span>{Math.round(planPct)}% used</span>
            <span>{Math.max(0, planLimit - planUsed)} remaining</span>
          </div>
        </div>
      )}

      <div className={styles.scrollBody}>
        <div className={styles.mainContent}>

          {/* ── ACTIVE VISITORS ── */}
          <div className={styles.tablesRow}>
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardDot} />
                <h2 className={styles.cardTitle}>Active Visitors</h2>
                <span className={styles.cardCount}>{active.length}</span>
              </div>

              {active.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🚶</span>No visitors currently in
                </div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Visitor</th>
                        <th>Meeting</th>
                        <th>Visit Status</th>
                        <th>Pass</th>
                        <th>Check In</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.map((v) => {
                        const isPending  = (v.visit_status || "pending") === "pending";
                        const isUpdating = (s) => updatingStatus === `${v.visitor_code}-${s}`;
                        return (
                          <tr key={v.visitor_code}>
                            <td>
                              <span className={styles.visitorCode}>{v.visitor_code}</span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 800, color: "#1a0038", fontSize: 13 }}>
                                {v.name}
                              </div>
                              {/* FIX 3: from_company now returned by controller */}
                              {v.from_company && (
                                <div style={{ fontSize: 11, color: "#9980c8" }}>{v.from_company}</div>
                              )}
                            </td>
                            <td style={{ fontSize: 12, color: "#2a0050" }}>
                              {v.person_to_meet || "—"}
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                <VisitStatusBadge status={v.visit_status || "pending"} />
                                {isPending && (
                                  <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                                    <button
                                      style={{
                                        background: "rgba(0,184,148,0.12)", color: "#00a875",
                                        border: "none", padding: "3px 8px", borderRadius: 50,
                                        fontSize: 10, fontWeight: 800, cursor: "pointer",
                                        fontFamily: "inherit", transition: "all 0.15s",
                                        opacity: updatingStatus ? 0.6 : 1,
                                      }}
                                      disabled={!!updatingStatus}
                                      onClick={() => handleVisitStatus(v.visitor_code, "accepted")}
                                    >
                                      {isUpdating("accepted") ? "…" : "✓ Accept"}
                                    </button>
                                    <button
                                      style={{
                                        background: "rgba(204,17,0,0.08)", color: "#cc1100",
                                        border: "none", padding: "3px 8px", borderRadius: 50,
                                        fontSize: 10, fontWeight: 800, cursor: "pointer",
                                        fontFamily: "inherit", transition: "all 0.15s",
                                        opacity: updatingStatus ? 0.6 : 1,
                                      }}
                                      disabled={!!updatingStatus}
                                      onClick={() => handleVisitStatus(v.visitor_code, "declined")}
                                    >
                                      {isUpdating("declined") ? "…" : "✕ Decline"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <span style={{
                                fontSize: 10, fontWeight: 800,
                                background: v.pass_issued ? "rgba(0,184,148,0.12)" : "rgba(240,165,0,0.12)",
                                color:      v.pass_issued ? "#00a875" : "#c77800",
                                padding: "3px 8px", borderRadius: 50,
                              }}>
                                {v.pass_issued ? "✓ Sent" : "Pending"}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: "#9980c8" }}>
                              {/* FIX: use fmtTime helper */}
                              {fmtTime(v.check_in)}
                            </td>
                            <td>
                              <button
                                className={styles.checkoutBtn}
                                onClick={() => handleCheckout(v.visitor_code)}
                                disabled={checkingOut === v.visitor_code}
                              >
                                {checkingOut === v.visitor_code ? "…" : "Check Out"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── HISTORY ── */}
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <span className={`${styles.cardDot} ${styles.cardDotGreen}`} />
                <h2 className={styles.cardTitle}>Checked Out</h2>
                <span className={`${styles.cardCount} ${styles.cardCountGreen}`}>
                  {history.length}
                </span>
              </div>

              {history.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📋</span>No checkout history yet
                </div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Visitor</th>
                        <th>Visit Status</th>
                        <th>Duration</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((v) => (
                        <tr key={v.visitor_code}>
                          <td>
                            <span className={styles.visitorCode}>{v.visitor_code}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: "#1a0038", fontSize: 13 }}>
                              {v.name}
                            </div>
                            {v.person_to_meet && (
                              <div style={{ fontSize: 11, color: "#9980c8" }}>
                                → {v.person_to_meet}
                              </div>
                            )}
                          </td>
                          <td>
                            <VisitStatusBadge status={v.visit_status || "checked_out"} />
                          </td>
                          {/* FIX 2: calcDuration now works — check_in is returned by controller */}
                          <td style={{ fontSize: 12, color: "#2a0050" }}>
                            {calcDuration(v.check_in, v.check_out)}
                          </td>
                          {/* FIX 2: fmtDate now works — check_in returned */}
                          <td style={{ fontSize: 11, color: "#9980c8" }}>
                            {fmtDate(v.check_in)}
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
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`${styles.toast} ${
          toast.type === "error" ? styles.toastError : styles.toastSuccess
        }`}>
          {toast.msg}
        </div>
      )}

    </div>
  );
}
