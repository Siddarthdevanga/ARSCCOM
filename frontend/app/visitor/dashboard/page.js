"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import styles from "./style.module.css";
import graceStyles from "../../styles/gracePeriod.module.css";
import LockedModule from "../../components/LockedModule";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/* ─── Visit Status Badge ─────────────────── */
const VS_CONFIG = {
  pending:     { label: "Pending",     bg: "rgba(240,165,0,0.12)",  color: "#c77800" },
  accepted:    { label: "Accepted",    bg: "rgba(0,184,148,0.12)",  color: "#00a875" },
  declined:    { label: "Declined",    bg: "rgba(204,17,0,0.1)",    color: "#cc1100" },
  checked_in:  { label: "Checked In",  bg: "rgba(59,130,246,0.12)", color: "#2563eb" },
  checked_out:      { label: "Checked Out",      bg: "rgba(18, 18, 22,0.1)",    color: "#121216" },
  auto_checked_out: { label: "Auto Checked Out", bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
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
    timeZone: "Asia/Kolkata",
  });
};

/* ─── Date formatter ─────────────────────── */
const fmtDate = (dt) => {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", {
    month: "short", day: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

export default function VisitorDashboard() {
  const router = useRouter();
  const [data,           setData]           = useState(null);
  const [company,        setCompany]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [locked,         setLocked]         = useState(false);
  // Form Builder toggles — default everything on until the real config loads
  const [formFields,     setFormFields]     = useState({ personToMeet: true, fromCompany: true });
  const [navOpen,        setNavOpen]        = useState(false);
  const [qrUrl,          setQrUrl]          = useState(null);
  const [regUrl,         setRegUrl]         = useState("");
  const [toast,          setToast]          = useState(null);
  const [checkingOut,    setCheckingOut]    = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [tab,            setTab]            = useState("active");
  const [query,          setQuery]          = useState("");
  const [live,           setLive]           = useState(true);

  const toastTimer = useRef(null);
  const pollTimer  = useRef(null);

  const showToast = (msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/visitors/dashboard`, {
        credentials: "include",
      });
      if (res.status === 401) { router.replace("/"); return; }
      if (res.status === 403) { setLocked(true); return; }
      const json = await res.json();
      setData(json);

      // Registration QR/link must reflect the company's current slug, not
      // whatever was cached in localStorage at login — merge in the fresh
      // value from the server rather than trusting the stale snapshot.
      if (json?.company?.slug) {
        setCompany((prev) => ({ ...prev, slug: json.company.slug, name: json.company.name }));
      }
    } catch {
      /* silent on poll */
    }
  }, [router]);

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/"); return; }
    try { setCompany(JSON.parse(stored)); } catch {}

    fetchDashboard().then(() => setLoading(false));

    fetch(`${API}/api/settings/visitor-fields`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.fields) setFormFields((prev) => ({ ...prev, ...d.fields })); })
      .catch(() => {});

    return () => { clearInterval(pollTimer.current); };
  }, [fetchDashboard]);

  /* Poll only while Live is on and the tab is visible — a reception screen
     left in a background tab should not keep hitting the API. */
  useEffect(() => {
    if (!live) return;
    const tick = () => { if (document.visibilityState === "visible") fetchDashboard(); };
    pollTimer.current = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(pollTimer.current);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, fetchDashboard]);

  useEffect(() => {
    if (!company?.slug) return;
    const url = `${window.location.origin}/visitor/${company.slug}`;
    setRegUrl(url);
    QRCode.toDataURL(url, {
      width: 220, margin: 2,
      color: { dark: "#08080c", light: "#ffffff" },
    }).then(setQrUrl).catch(() => {});
  }, [company]);

  const handleCheckout = async (visitorCode) => {
    setCheckingOut(visitorCode);
    try {
      const res = await fetch(`${API}/api/visitors/${visitorCode}/checkout`, {
        method:  "POST",
        credentials: "include",
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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      showToast(status === "accepted" ? "Visit accepted" : "Visit declined.");
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

  /* ─────────────────────────────────────────────────────
     DOWNLOAD BRANDED QR IMAGE
     Composes a full branded PNG on canvas matching the
     conference QR download style:
       - Purple gradient header with company name
       - "Visitor Registration" title
       - URL line
       - QR code centered
       - Instructions section
       - Hai Visitor footer
  ───────────────────────────────────────────────────── */
  const downloadPdf = async () => {
    if (!qrUrl) return;

    const companyName = company?.name?.toUpperCase() || "YOUR COMPANY";
    const W = 800;
    const H = 1050;

    const canvas  = document.createElement("canvas");
    canvas.width  = W;
    canvas.height = H;
    const ctx     = canvas.getContext("2d");

    /* ── Background ── */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    /* ── Header gradient ── */
    const headerGrad = ctx.createLinearGradient(0, 0, W, 80);
    headerGrad.addColorStop(0, "#0f0f13");
    headerGrad.addColorStop(1, "#151519");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, 80);

    /* ── Company name in header ── */
    ctx.fillStyle   = "#ffffff";
    ctx.font        = "bold 26px Arial, sans-serif";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(companyName, W / 2, 40);

    /* ── Title ── */
    ctx.fillStyle   = "#0f0f13";
    ctx.font        = "bold 32px Arial, sans-serif";
    ctx.textAlign   = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Visitor Registration", W / 2, 148);

    /* ── Subtitle ── */
    ctx.fillStyle = "#666666";
    ctx.font      = "16px Arial, sans-serif";
    ctx.fillText("Scan QR Code or Visit:", W / 2, 185);

    /* ── URL ── */
    ctx.fillStyle = "#0f0f13";
    ctx.font      = "bold 14px Arial, sans-serif";
    const displayUrl = regUrl.length > 72 ? regUrl.slice(0, 70) + "…" : regUrl;
    ctx.fillText(displayUrl, W / 2, 212);

    /* ── QR code image ── */
    await new Promise((resolve) => {
      const qrImg    = new window.Image();
      qrImg.onload   = () => {
        const qrSize = 340;
        const qrX    = (W - qrSize) / 2;
        const qrY    = 235;

        /* shadow */
        ctx.shadowColor   = "rgba(18, 18, 22,0.15)";
        ctx.shadowBlur    = 18;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        /* white card behind QR */
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18);
        ctx.fill();

        /* reset shadow */
        ctx.shadowColor = "transparent";
        ctx.shadowBlur  = 0;

        /* border */
        ctx.strokeStyle = "#ebebee";
        ctx.lineWidth   = 2;
        roundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18);
        ctx.stroke();

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        resolve();
      };
      qrImg.onerror  = resolve;
      qrImg.src      = qrUrl;
    });

    /* ── Divider ── */
    const dividerY = 645;
    ctx.strokeStyle = "#ebebee";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, dividerY);
    ctx.lineTo(W - 60, dividerY);
    ctx.stroke();

    /* ── Instructions heading ── */
    ctx.fillStyle   = "#0f0f13";
    ctx.font        = "bold 20px Arial, sans-serif";
    ctx.textAlign   = "left";
    ctx.fillText("Instructions for Visitors:", 60, 690);

    /* ── Instruction steps ── */
    const steps = [
      "Scan the QR code with your phone camera",
      "Or visit the URL above in your browser",
      "Complete the registration form",
      "A visitor pass link will be sent to their WhatsApp instantly",
      "Show the WhatsApp pass link at the reception desk",
    ];

    ctx.fillStyle = "#333333";
    ctx.font      = "16px Arial, sans-serif";
    steps.forEach((step, i) => {
      const y = 726 + i * 36;
      /* bullet dot */
      ctx.fillStyle = "#121216";
      ctx.beginPath();
      ctx.arc(76, y - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      /* step text */
      ctx.fillStyle = "#333333";
      ctx.fillText(`${i + 1}. ${step}`, 96, y);
    });

    /* ── Footer background ── */
    ctx.fillStyle = "#f2f2f5";
    ctx.fillRect(0, H - 80, W, 80);

    /* ── Footer top border ── */
    ctx.strokeStyle = "#d9d9dc";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 80);
    ctx.lineTo(W, H - 80);
    ctx.stroke();

    /* ── Footer text ── */
    ctx.fillStyle   = "#0f0f13";
    ctx.font        = "bold 22px Arial, sans-serif";
    ctx.textAlign   = "center";
    ctx.fillText("Hai Visitor", W / 2, H - 44);

    ctx.fillStyle = "#28282c";
    ctx.font      = "14px Arial, sans-serif";
    ctx.fillText("Visitor Management Platform", W / 2, H - 22);

    /* ── Trigger download ── */
    const slug     = company?.slug || "visitor";
    const fileName = `${slug}-visitor-qr-${Date.now()}.png`;
    const link     = document.createElement("a");
    link.href      = canvas.toDataURL("image/png");
    link.download  = fileName;
    link.click();

    showToast("QR image downloaded!", "success");
  };

  /* ── Canvas rounded rect helper ── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  if (loading) return (
    <div className={styles.loading}><div className={styles.spinner} /></div>
  );

  if (locked) return <LockedModule moduleName="Visitor Management" />;

  const stats     = data?.stats || {};
  const active    = data?.activeVisitors    || [];
  const history   = data?.checkedOutVisitors || [];

  const totalVisitors = stats.totalVisitors  ?? 0;
  const activeCount   = stats.activeVisitors ?? 0;

  const planLimit = stats.planLimit        ?? 0;
  const planUsed  = stats.planVisitorsUsed ?? 0;
  const planPct   = planLimit > 0 ? Math.min((planUsed / planLimit) * 100, 100) : 0;

  /* A visitor still marked IN after this long has almost certainly left
     without checking out — the desk needs that surfaced, not buried. */
  const LONG_STAY_HOURS = 8;
  const hoursInside = (checkIn) => {
    if (!checkIn) return 0;
    const t = new Date(checkIn).getTime();
    return Number.isNaN(t) ? 0 : (Date.now() - t) / 3_600_000;
  };
  const elapsed = (checkIn) => {
    const h = hoursInside(checkIn);
    if (h <= 0) return "—";
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
  };

  const purposeOf = (v) =>
    [v.purpose_category, v.purpose_subcategory].filter(Boolean).join(" · ") || "—";

  const matches = (v) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [v.visitor_code, v.name, v.from_company, v.person_to_meet, v.phone,
            v.purpose_category, v.purpose_subcategory]
      .some((f) => (f || "").toString().toLowerCase().includes(q));
  };

  const activeFiltered  = active.filter(matches);
  const historyFiltered = history.filter(matches);
  const longStayCount   = active.filter((v) => hoursInside(v.check_in) >= LONG_STAY_HOURS).length;
  const rows = tab === "active" ? activeFiltered : historyFiltered;
  const planColor =
    planPct >= 85 ? "#ef4444" :   // at the ceiling
    planPct >= 60 ? "#f5a524" :   // worth watching
                    "#34d399";    // comfortable
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
          {company?.id && (
            <Image src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`} alt="Logo" width={72} height={36}
              className={styles.companyLogo} unoptimized
              onError={e => { e.currentTarget.style.display = "none"; }} />
          )}
          <button className={styles.newBtn} disabled={atLimit}
            onClick={() => router.push("/visitor/new")}>
            + New Visit
          </button>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>
            &larr; Home
          </button>
        </div>
      </header>

      {/* NAV OVERLAY */}
      {navOpen && <div className={styles.navOverlay} onClick={() => setNavOpen(false)} />}

      {/* NAV PANEL */}
      <div className={`${styles.navPanel} ${navOpen ? styles.navPanelOpen : ""}`}>
        <div className={styles.navPanelHeader}>
          <h3>Registration QR</h3>
          <button className={styles.navCloseBtn} onClick={() => setNavOpen(false)}>&#x2715;</button>
        </div>

        {/* GRACE PERIOD WARNING */}
        {data?.gracePeriodWarning?.inGracePeriod && (
          <div className={graceStyles.graceBanner}>
            ⚠️ Grace Period: {data.gracePeriodWarning.daysRemaining} days left.
            <a href="/subscription">Renew Now</a>
          </div>
        )}

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
                  <button className={styles.copyBtn} onClick={copyUrl}>Copy</button>
                </div>
              </div>
              <button className={styles.downloadPdfBtn} onClick={downloadPdf}>
                Download QR Image
              </button>
            </>
          ) : (
            <div className={styles.navQRLoading}>
              <div className={styles.spinner} /><p>Generating QR...</p>
            </div>
          )}
          <div className={styles.navInstructions}>
            <h4>How It Works</h4>
            <ol>
              <li>Print or display the QR code at reception</li>
              <li>Visitors scan with their phone</li>
              <li>They complete the registration form</li>
              <li>A pass link is sent to their WhatsApp instantly</li>
              <li>The person to meet gets a notification</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Everything below the header scrolls: the hero and plan bar used to
          sit outside this container, so the visitor list was squeezed into
          whatever height was left over. */}
      <div className={styles.scrollBody}>

        {/* COMPACT HERO */}
        <div className={styles.hero}>
          <div className={styles.heroTop}>
            <h1 className={styles.heroTitle}>Visitor <span>Dashboard</span></h1>
            <button
              className={`${styles.liveToggle} ${live ? styles.liveOn : ""}`}
              onClick={() => setLive((l) => !l)}
              aria-pressed={live}
              title={live ? "Refreshing every 30s" : "Auto-refresh paused"}
            >
              <span className={styles.liveDot} />
              <span>{live ? "Live" : "Paused"}</span>
            </button>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Total Visitors</div>
              <div className={styles.heroStatValue}>{totalVisitors}</div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Currently In</div>
              <div className={`${styles.heroStatValue} ${styles.statAmber}`}>{activeCount}</div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Checked Out</div>
              <div className={`${styles.heroStatValue} ${styles.statMint}`}>{stats.checkedOutToday ?? 0}</div>
            </div>
          </div>

          {/* Plan usage lives in the hero as a single slim line rather than a
              card of its own below it — it is reference information, not
              something the desk acts on. */}
          {planLimit > 0 && (
            <div className={styles.heroPlan}>
              <span className={styles.heroPlanLabel}>Plan Usage</span>
              <div className={styles.heroPlanTrack}>
                <div
                  className={styles.heroPlanFill}
                  style={{ width: `${planPct}%`, background: planColor }}
                />
              </div>
              <span className={styles.heroPlanMeta}>
                <strong>{planUsed} / {planLimit}</strong> visits
                <span className={styles.heroPlanDim}> · {Math.max(0, planLimit - planUsed)} left</span>
              </span>
            </div>
          )}
        </div>

        {/* UPGRADE MSG */}
        {atLimit && (
          <div className={styles.upgradeMsg}>
            Visitor limit reached for your plan. Upgrade to allow new check-ins.
          </div>
        )}

        <div className={styles.mainContent}>
          <div className={styles.listCard}>

            {/* TABS + SEARCH */}
            <div className={styles.listToolbar}>
              <div className={styles.tabs} role="tablist">
                <button
                  role="tab" aria-selected={tab === "active"}
                  className={`${styles.tab} ${tab === "active" ? styles.tabOn : ""}`}
                  onClick={() => setTab("active")}
                >
                  Active Visitors
                  <span className={styles.tabCount}>{active.length}</span>
                </button>
                <button
                  role="tab" aria-selected={tab === "history"}
                  className={`${styles.tab} ${tab === "history" ? styles.tabOn : ""}`}
                  onClick={() => setTab("history")}
                >
                  Checked Out
                  <span className={styles.tabCount}>{history.length}</span>
                </button>
              </div>

              <input
                className={styles.searchInput}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, code, company, host or purpose..."
                aria-label="Search visitors"
              />
            </div>

            {tab === "active" && longStayCount > 0 && (
              <div className={styles.longStayNotice}>
                {longStayCount} visitor{longStayCount === 1 ? " has" : "s have"} been on premises
                over {LONG_STAY_HOURS} hours &mdash; they may have left without checking out.
              </div>
            )}

            {rows.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>&mdash;</span>
                {query.trim()
                  ? "No visitors match that search"
                  : tab === "active" ? "No visitors currently in" : "No checkout history yet"}
              </div>
            ) : tab === "active" ? (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Visitor</th>
                      {formFields.personToMeet && <th>Meeting</th>}
                      <th>Purpose</th>
                      <th>Visit Status</th>
                      <th>Pass</th>
                      <th>Check In</th>
                      <th>Time Inside</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFiltered.map((v) => {
                      const isPending  = (v.visit_status || "pending") === "pending";
                      const isUpdating = (st) => updatingStatus === `${v.visitor_code}-${st}`;
                      const longStay   = hoursInside(v.check_in) >= LONG_STAY_HOURS;
                      return (
                        <tr key={v.visitor_code} className={longStay ? styles.rowLongStay : ""}>
                          <td data-label="Code">
                            <span className={styles.visitorCode}>{v.visitor_code}</span>
                          </td>
                          <td data-label="Visitor">
                            <div className={styles.cellName}>{v.name}</div>
                            {formFields.fromCompany && v.from_company && (
                              <div className={styles.cellSub}>{v.from_company}</div>
                            )}
                          </td>
                          {formFields.personToMeet && (
                            <td data-label="Meeting" className={styles.cellMuted}>
                              {v.person_to_meet || "\u2014"}
                            </td>
                          )}
                          <td data-label="Purpose" className={styles.cellMuted}>{purposeOf(v)}</td>
                          <td data-label="Visit Status">
                            <div className={styles.statusCell}>
                              <VisitStatusBadge status={v.visit_status || "pending"} />
                              {isPending && (
                                <div className={styles.statusActions}>
                                  <button
                                    className={styles.acceptBtn}
                                    disabled={!!updatingStatus}
                                    onClick={() => handleVisitStatus(v.visitor_code, "accepted")}
                                  >
                                    {isUpdating("accepted") ? "..." : "Accept"}
                                  </button>
                                  <button
                                    className={styles.declineBtn}
                                    disabled={!!updatingStatus}
                                    onClick={() => handleVisitStatus(v.visitor_code, "declined")}
                                  >
                                    {isUpdating("declined") ? "..." : "Decline"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td data-label="Pass">
                            <span className={v.pass_issued ? styles.passSent : styles.passPending}>
                              {v.pass_issued ? "Sent" : "Pending"}
                            </span>
                          </td>
                          <td data-label="Check In" className={styles.cellMuted}>{fmtTime(v.check_in)}</td>
                          <td data-label="Time Inside">
                            <span className={longStay ? styles.elapsedFlag : styles.cellMuted}>
                              {elapsed(v.check_in)}
                            </span>
                          </td>
                          <td data-label="Action">
                            <button
                              className={styles.checkoutBtn}
                              onClick={() => handleCheckout(v.visitor_code)}
                              disabled={checkingOut === v.visitor_code}
                            >
                              {checkingOut === v.visitor_code ? "..." : "Check Out"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Visitor</th>
                      <th>Purpose</th>
                      <th>Visit Status</th>
                      <th>Duration</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyFiltered.map((v) => (
                      <tr key={v.visitor_code}>
                        <td data-label="Code">
                          <span className={styles.visitorCode}>{v.visitor_code}</span>
                        </td>
                        <td data-label="Visitor">
                          <div className={styles.cellName}>{v.name}</div>
                          {formFields.personToMeet && v.person_to_meet && (
                            <div className={styles.cellSub}>&rarr; {v.person_to_meet}</div>
                          )}
                        </td>
                        <td data-label="Purpose" className={styles.cellMuted}>{purposeOf(v)}</td>
                        <td data-label="Visit Status">
                          <VisitStatusBadge status={v.visit_status || "checked_out"} />
                        </td>
                        <td data-label="Duration" className={styles.cellMuted}>
                          {calcDuration(v.check_in, v.check_out)}
                        </td>
                        <td data-label="Date" className={styles.cellSub}>{fmtDate(v.check_in)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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
