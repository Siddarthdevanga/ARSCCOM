"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  DoorOpen,
  FileSpreadsheet,
  CheckCircle,
  X,
  Zap,
  Crown,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Settings,
  Info,
  LogOut,
  UserCog,
} from "lucide-react";
import styles from "./style.module.css";
import graceStyles from "../styles/gracePeriod.module.css";

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
let toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = "info", title, message, duration = 4000, actions }) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, title, message, duration, actions, exiting: false }]);

    if (!actions) {
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = {
    success: (title, message, opts) => addToast({ type: "success", title, message, ...opts }),
    error:   (title, message, opts) => addToast({ type: "error",   title, message, ...opts }),
    warning: (title, message, opts) => addToast({ type: "warning", title, message, ...opts }),
    info:    (title, message, opts) => addToast({ type: "info",    title, message, ...opts }),
    confirm: (title, message, onConfirm, onCancel) =>
      addToast({ type: "warning", title, message, actions: { onConfirm, onCancel } }),
  };

  return { toasts, toast, removeToast };
}

const TOAST_ICONS = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertCircle,
  info:    Info,
};

const TOAST_LABELS = {
  success: "Success",
  error:   "Error",
  warning: "Warning",
  info:    "Info",
};

function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.toastContainer} role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => {
        const Icon = TOAST_ICONS[t.type];
        return (
          <div
            key={t.id}
            className={`${styles.toast} ${t.exiting ? styles.exiting : ""}`}
            data-type={t.type}
            role="alert"
          >
            <div className={styles.toastInner}>
              <div className={styles.toastIconWrap}>
                <Icon size={18} />
              </div>
              <div className={styles.toastBody}>
                <p className={styles.toastTitle}>{t.title || TOAST_LABELS[t.type]}</p>
                {t.message && <p className={styles.toastMessage}>{t.message}</p>}
              </div>
              {!t.actions && (
                <button
                  className={styles.toastClose}
                  onClick={() => removeToast(t.id)}
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {t.actions && (
              <div className={styles.toastActions}>
                <button
                  className={styles.toastActionConfirm}
                  onClick={() => { removeToast(t.id); t.actions.onConfirm?.(); }}
                >
                  <LogOut size={13} /> Yes, Logout
                </button>
                <button
                  className={styles.toastActionCancel}
                  onClick={() => { removeToast(t.id); t.actions.onCancel?.(); }}
                >
                  Cancel
                </button>
              </div>
            )}

            {!t.actions && (
              <div className={styles.toastProgress}>
                <div
                  className={styles.toastProgressBar}
                  style={{ animationDuration: `${t.duration}ms` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getStatusStyle(status) {
  switch ((status || "").toLowerCase()) {
    case "active":        return { color: "#059669", Icon: CheckCircle };
    case "expired":       return { color: "#DC2626", Icon: AlertCircle };
    case "trial":         return { color: "#D97706", Icon: Clock };
    case "grace_period":  return { color: "#F59E0B", Icon: AlertCircle };
    default:              return { color: "#6B7280", Icon: AlertCircle };
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHT NOTIFICATION MESSAGES (7 days, professional)
   ═══════════════════════════════════════════════════════════════════════════ */
const VISITOR_MSGS = [
  (n) => `${n} visitor${n !== 1 ? "s" : ""} came through on Sunday. Your office never really clocks out.`,
  (n) => `Strong start — ${n} visitor${n !== 1 ? "s" : ""} walked in on Monday. The week is already winning.`,
  (n) => `${n} visitor${n !== 1 ? "s" : ""} checked in yesterday. Mid-week and the momentum is building.`,
  (n) => `Wednesday brought in ${n} visitor${n !== 1 ? "s" : ""}. Halfway through the week, fully on track.`,
  (n) => `${n} visitor${n !== 1 ? "s" : ""} yesterday. The pre-weekend push is real.`,
  (n) => `${n} visitor${n !== 1 ? "s" : ""} came through on Friday. A great way to close the week.`,
  (n) => `${n} visitor${n !== 1 ? "s" : ""} on a Saturday. Some teams just do not wait for Monday.`,
];

const BOOKING_MSGS = [
  (n) => `${n} conference room${n !== 1 ? "s" : ""} booked over the weekend. The week started before Monday did.`,
  (n) => `${n} meeting${n !== 1 ? "s" : ""} scheduled on day one. Your team means business.`,
  (n) => `${n} conference session${n !== 1 ? "s" : ""} wrapped up on Tuesday. Collaboration is alive and well.`,
  (n) => `${n} room${n !== 1 ? "s" : ""} booked yesterday. Ideas were in the air.`,
  (n) => `${n} meeting${n !== 1 ? "s" : ""} locked in on Thursday. Finishing strong before the weekend.`,
  (n) => `${n} conference booking${n !== 1 ? "s" : ""} on the last day of the week. No one slows down around here.`,
  (n) => `${n} conference session${n !== 1 ? "s" : ""} over the weekend. Dedication looks good on your team.`,
];

const VisitorSVG = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const CalendarSVG = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

function InsightPanel({ items }) {
  const [visible, setVisible]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [fading,  setFading]    = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [items]);

  useEffect(() => {
    if (!visible || items.length <= 1) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % items.length);
        setFading(false);
      }, 350);
    }, 5000);
    return () => clearInterval(interval);
  }, [visible, items.length]);

  if (!visible || dismissed || items.length === 0) return null;

  const item = items[current];

  return (
    <div className={`${styles.insightPanel} ${fading ? styles.insightFading : ""}`}>
      <div className={styles.insightCard}>
        <div className={styles.insightIcon} data-type={item.type}>
          {item.type === "visitor" ? <VisitorSVG /> : <CalendarSVG />}
        </div>
        <div className={styles.insightBody}>
          <p className={styles.insightLabel}>{item.type === "visitor" ? "Visitors" : "Conference"}</p>
          <p className={styles.insightText}>{item.message}</p>
          {items.length > 1 && (
            <div className={styles.insightDots}>
              {items.map((_, i) => (
                <span key={i} className={`${styles.insightDot} ${i === current ? styles.insightDotActive : ""}`} />
              ))}
            </div>
          )}
        </div>
        <button className={styles.insightClose} onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const router  = useRouter();
  const { toasts, toast, removeToast } = useToast();

  const [company,     setCompany]     = useState(null);
  const [showMenu,    setShowMenu]    = useState(false);
  const [subData,     setSubData]     = useState(null);
  const [loadingSub,  setLoadingSub]  = useState(false);
  const [subError,    setSubError]    = useState("");
  const [insightItems, setInsightItems] = useState([]);

  const [upgradingPlan, setUpgradingPlan] = useState("");

  /* ── Auth ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token          = localStorage.getItem("token");
    const storedCompany  = localStorage.getItem("company");
    if (!token || !storedCompany) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(storedCompany)); }
    catch { localStorage.clear(); router.replace("/auth/login"); return; }

    const day = new Date().getDay(); // 0=Sun … 6=Sat
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/yesterday-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return;
        const items = [];
        if (data.visitors > 0) items.push({ type: "visitor", message: VISITOR_MSGS[day](data.visitors) });
        if (data.bookings > 0) items.push({ type: "booking", message: BOOKING_MSGS[day](data.bookings) });
        if (items.length > 0) setInsightItems(items);
      })
      .catch(() => {});
  }, [router]);

  /* ── Fetch Subscription ───────────────────────────────────────────── */
  const fetchSubscription = async () => {
    try {
      setLoadingSub(true);
      setSubError("");
      setSubData(null);
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/subscription/details`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.MESSAGE || "Failed to load subscription");
      setSubData(data);
    } catch (err) {
      const msg = err?.message || "Unable to fetch subscription details";
      setSubError(msg);
      toast.error("Subscription Error", msg);
    } finally {
      setLoadingSub(false);
    }
  };

  /* ── Upgrade / Renew ─────────────────────────────────────────────── */
  const handleSelectPlan = async (plan) => {
    if (upgradingPlan) return;
    try {
      setUpgradingPlan(plan);
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upgrade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Request failed");
      if (data.success && data.redirectTo) {
        setShowMenu(false);
        if (plan === "enterprise") router.push(data.redirectTo);
        else window.location.href = data.redirectTo;
      } else {
        throw new Error(data.message || "No redirect URL provided");
      }
    } catch (err) {
      toast.error("Failed", err.message || "Please try again.");
    } finally {
      setUpgradingPlan("");
    }
  };

  /* ── View Handlers ────────────────────────────────────────────────── */
  const handleOpenMenu      = () => { setShowMenu(true); fetchSubscription(); };
  const handleOpenReports   = () => { setShowMenu(false); router.push("/home/reports"); };
  const handleOpenSettings  = () => { setShowMenu(false); router.push("/home/settings"); };
  const handleOpenEmployees = () => { setShowMenu(false); router.push("/visitor/admin"); };
  const handleRenew         = () => { setShowMenu(false); router.push("/auth/subscription"); };

  /* ── Logout ───────────────────────────────────────────────────────── */
  const handleLogout = () => {
    toast.confirm(
      "Confirm Logout",
      "Are you sure you want to log out?",
      () => { localStorage.clear(); router.replace("/auth/login"); },
      () => {}
    );
  };

  /* ── Derived State ────────────────────────────────────────────────── */
  const currentPlan   = subData?.PLAN?.toLowerCase()   || "";
  const currentStatus = subData?.STATUS?.toLowerCase() || "";

  const canUpgradeBusiness   = currentPlan === "trial"                        && ["active", "trial", "grace_period"].includes(currentStatus);
  const canUpgradeEnterprise = ["trial", "business"].includes(currentPlan)    && ["active", "trial", "grace_period"].includes(currentStatus);
  const needsRenewal         = ["expired", "cancelled"].includes(currentStatus);
  const inGracePeriod        = subData?.IN_GRACE_PERIOD === true;

  const { color: statusColor, Icon: StatusIcon } = getStatusStyle(subData?.STATUS);

  if (!company) return null;

  return (
    <div className={styles.container}>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <InsightPanel items={insightItems} />

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <button className={styles.menuBtn} onClick={handleOpenMenu} aria-label="Open menu">
          <div className={styles.menuDots}>
            <span/><span/><span/>
          </div>
        </button>

        <div className={styles.companyInfo}>
          {company.id && (
            <img
              src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`}
              alt={`${company.name} logo`}
              className={styles.companyLogoHeader}
              onError={e => { e.currentTarget.style.display = "none"; }}
            />
          )}
          <h1 className={styles.companyName}>{company.name}</h1>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Logout">
            <span>Logout</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── SCROLL BODY ── */}
      <div className={styles.scrollBody}>
        <main className={styles.main}>

          {/* GRACE PERIOD BANNER */}
          {inGracePeriod && (
            <div className={graceStyles.gracePeriodBanner}>
              <AlertCircle size={24} />
              <div>
                <h3>⚠️ Grace Period Active</h3>
                <p>
                  Your subscription expired. You have{" "}
                  <strong>
                    {subData.GRACE_PERIOD_DAYS_REMAINING} day{subData.GRACE_PERIOD_DAYS_REMAINING !== 1 ? "s" : ""}
                  </strong>{" "}
                  remaining to renew.
                </p>
                <p>Grace period ends: {formatDate(subData.GRACE_PERIOD_ENDS_ON)}</p>
              </div>
              <button onClick={handleOpenMenu}>Renew Now</button>
            </div>
          )}

          {/* HOME VIEW */}
          <>
              <div className={styles.welcomeSection}>
                <div className={styles.heroContent}>
                  <div className={styles.greetingChip}>
                    <span className={styles.greetingDot}/>
                    {getGreeting()}
                  </div>
                  <h2 className={styles.welcomeTitle}>
                    Welcome, <em>{company.name}</em>
                  </h2>
                  <p className={styles.welcomeSubtitle}>
                    Select a module to continue
                  </p>
                </div>
              </div>

              <div className={styles.cardGrid}>
                {/* ── Visitor Management ── */}
                <div
                  className={styles.moduleCard}
                  onClick={() => router.push("/visitor/dashboard")}
                  role="button"
                  tabIndex={0}
                  aria-label="Visitor Management"
                  onKeyDown={(e) => e.key === "Enter" && router.push("/visitor/dashboard")}
                >
                  <div className={styles.cardIcon}><Users size={32}/></div>
                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>Visitor Management</h3>
                    <p className={styles.cardDescription}>
                      Check-ins, ID verification & digital passes
                    </p>
                  </div>
                  <span className={styles.cardArrow}>→</span>
                </div>

                {/* ── Conference Booking ── */}
                <div
                  className={styles.moduleCard}
                  onClick={() => router.push("/conference/dashboard")}
                  role="button"
                  tabIndex={0}
                  aria-label="Conference Booking"
                  onKeyDown={(e) => e.key === "Enter" && router.push("/conference/dashboard")}
                >
                  <div className={styles.cardIcon}><DoorOpen size={32}/></div>
                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>Conference Booking</h3>
                    <p className={styles.cardDescription}>
                      Schedule meetings & manage rooms
                    </p>
                  </div>
                  <span className={styles.cardArrow}>→</span>
                </div>
              </div>
            </>

        </main>
      </div>

      {/* ── SLIDE PANEL ── */}
      {showMenu && (
        <>
          <div className={styles.overlay} onClick={() => setShowMenu(false)} aria-hidden="true"/>

          <aside className={styles.slidePanel} role="dialog" aria-modal="true" aria-labelledby="menu-title">
            <div className={styles.panelHeader}>
              <h3 id="menu-title">Menu</h3>
              <button className={styles.closeBtn} onClick={() => setShowMenu(false)} aria-label="Close">
                <X size={18}/>
              </button>
            </div>

            <div className={styles.panelBody}>
              {loadingSub && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}/>
                  <p>Loading details...</p>
                </div>
              )}

              {subError && !loadingSub && (
                <div className={styles.errorState}>
                  <AlertCircle size={22}/>
                  <p>{subError}</p>
                </div>
              )}

              {subData && (
                <>
                  <div className={styles.currentPlanCard}>
                    <div className={styles.planBadge}><span>Current Plan</span></div>
                    <h4 className={styles.currentPlanName}>{subData.PLAN || "—"}</h4>
                    <div className={styles.statusBadge} style={{ color: statusColor }}>
                      <StatusIcon size={14}/>
                      <span>{subData.STATUS || "—"}</span>
                    </div>
                  </div>

                  <div className={styles.detailsSection}>
                    <h5 className={styles.sectionTitle}>Subscription Details</h5>
                    {subData.ZOHO_CUSTOMER_ID && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Customer ID</span>
                        <span className={styles.detailValue}>{subData.ZOHO_CUSTOMER_ID}</span>
                      </div>
                    )}
                    {subData.TRIAL_ENDS_ON && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Trial Ends</span>
                        <span className={styles.detailValue}>{formatDate(subData.TRIAL_ENDS_ON)}</span>
                      </div>
                    )}
                    {subData.EXPIRES_ON && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Expires On</span>
                        <span className={styles.detailValue}>{formatDate(subData.EXPIRES_ON)}</span>
                      </div>
                    )}
                    {subData.LAST_PAID_ON && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Last Payment</span>
                        <span className={styles.detailValue}>{formatDate(subData.LAST_PAID_ON)}</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.menuSection}>
                    {/* Reports & Analytics */}
                    <button className={styles.menuItem} onClick={handleOpenReports}>
                      <div className={styles.menuItemIcon}><FileSpreadsheet size={18}/></div>
                      <div className={styles.menuItemContent}>
                        <span className={styles.menuItemTitle}>Reports & Analytics</span>
                        <span className={styles.menuItemSubtitle}>Download visitor & booking data</span>
                      </div>
                      <ChevronRight size={16} className={styles.menuItemArrow}/>
                    </button>

                    {/* Employee Directory — NEW */}
                    <button className={styles.menuItem} onClick={handleOpenEmployees}>
                      <div className={styles.menuItemIcon}><UserCog size={18}/></div>
                      <div className={styles.menuItemContent}>
                        <span className={styles.menuItemTitle}>Employee Directory</span>
                        <span className={styles.menuItemSubtitle}>Manage staff visitors can meet</span>
                      </div>
                      <ChevronRight size={16} className={styles.menuItemArrow}/>
                    </button>

                    {/* My Account */}
                    <button className={styles.menuItem} onClick={handleOpenSettings}>
                      <div className={styles.menuItemIcon}><Settings size={18}/></div>
                      <div className={styles.menuItemContent}>
                        <span className={styles.menuItemTitle}>My Account</span>
                        <span className={styles.menuItemSubtitle}>Company & profile settings</span>
                      </div>
                      <ChevronRight size={16} className={styles.menuItemArrow}/>
                    </button>
                  </div>

                  {/* ── RENEW CURRENT PLAN (always shown) ── */}
                  {!needsRenewal && currentPlan && (
                    <div className={styles.upgradeSection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={18}/>
                        <h5>
                          {inGracePeriod ? "⚠️ Renew Before Access Ends" : "Renew Current Plan"}
                        </h5>
                      </div>
                      {inGracePeriod && (
                        <p className={styles.sectionDescription} style={{ color: "#DC2626", fontWeight: 600 }}>
                          Grace period active — renew now to avoid suspension.
                        </p>
                      )}

                      {currentPlan === "trial" && (
                        <div className={styles.upgradePlanCard}>
                          <div className={styles.planIconWrapper}><Clock size={20}/></div>
                          <div className={styles.planInfo}>
                            <h6>Trial Plan</h6>
                            <div className={styles.planPricing}>
                              <span className={styles.price}>₹49</span>
                              <span className={styles.period}> + GST / 15 days</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={13}/> 100 visitor bookings</li>
                            <li><CheckCircle size={13}/> 100 conference bookings</li>
                            <li><CheckCircle size={13}/> 2 conference rooms</li>
                          </ul>
                          <button className={styles.upgradeBtn} onClick={() => handleSelectPlan("trial")} disabled={!!upgradingPlan}>
                            {upgradingPlan === "trial" ? <><div className={styles.btnSpinner}/> Processing...</> : "Renew Trial"}
                          </button>
                        </div>
                      )}

                      {currentPlan === "business" && (
                        <div className={styles.upgradePlanCard}>
                          <div className={styles.planIconWrapper}><Zap size={20}/></div>
                          <div className={styles.planInfo}>
                            <h6>Business Plan</h6>
                            <div className={styles.planPricing}>
                              <span className={styles.price}>₹500</span>
                              <span className={styles.period}> + GST / mo</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={13}/> Unlimited visitors</li>
                            <li><CheckCircle size={13}/> 1,000 conference bookings</li>
                            <li><CheckCircle size={13}/> 6 conference rooms</li>
                            <li><CheckCircle size={13}/> Priority support</li>
                          </ul>
                          <button className={styles.upgradeBtn} onClick={() => handleSelectPlan("business")} disabled={!!upgradingPlan}>
                            {upgradingPlan === "business" ? <><div className={styles.btnSpinner}/> Processing...</> : "Renew Business"}
                          </button>
                        </div>
                      )}

                      {currentPlan === "enterprise" && (
                        <div className={`${styles.upgradePlanCard} ${styles.enterprisePlan}`}>
                          <div className={styles.planIconWrapper}><Crown size={20}/></div>
                          <div className={styles.planInfo}>
                            <h6>Enterprise Plan</h6>
                            <div className={styles.planPricing}>
                              <span className={styles.customPrice}>Custom Pricing</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={13}/> Unlimited everything</li>
                            <li><CheckCircle size={13}/> Dedicated support</li>
                          </ul>
                          <button className={`${styles.upgradeBtn} ${styles.enterpriseBtn}`} onClick={() => handleSelectPlan("enterprise")} disabled={!!upgradingPlan}>
                            {upgradingPlan === "enterprise" ? <><div className={styles.btnSpinner}/> Processing...</> : "Contact Sales"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── UPGRADE TO HIGHER PLAN ── */}
                  {!needsRenewal && (canUpgradeBusiness || canUpgradeEnterprise) && (
                    <div className={styles.upgradeSection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={18}/>
                        <h5>Upgrade Your Plan</h5>
                      </div>
                      <p className={styles.sectionDescription}>Unlock more features and scale with your business.</p>

                      {canUpgradeBusiness && (
                        <div className={styles.upgradePlanCard}>
                          <div className={styles.planIconWrapper}><Zap size={20}/></div>
                          <div className={styles.planInfo}>
                            <h6>Business Plan</h6>
                            <div className={styles.planPricing}>
                              <span className={styles.price}>₹500</span>
                              <span className={styles.period}> + GST / mo</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={13}/> Unlimited visitors</li>
                            <li><CheckCircle size={13}/> 1,000 conference bookings</li>
                            <li><CheckCircle size={13}/> 6 conference rooms</li>
                            <li><CheckCircle size={13}/> Priority support</li>
                          </ul>
                          <button className={styles.upgradeBtn} onClick={() => handleSelectPlan("business")} disabled={!!upgradingPlan}>
                            {upgradingPlan === "business" ? <><div className={styles.btnSpinner}/> Processing...</> : "Upgrade to Business"}
                          </button>
                        </div>
                      )}

                      {canUpgradeEnterprise && (
                        <div className={`${styles.upgradePlanCard} ${styles.enterprisePlan}`}>
                          <div className={styles.planIconWrapper}><Crown size={20}/></div>
                          <div className={styles.planInfo}>
                            <h6>Enterprise Plan</h6>
                            <div className={styles.planPricing}>
                              <span className={styles.customPrice}>Custom Pricing</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={13}/> Everything in Business</li>
                            <li><CheckCircle size={13}/> Custom integrations</li>
                            <li><CheckCircle size={13}/> Dedicated account manager</li>
                          </ul>
                          <button className={`${styles.upgradeBtn} ${styles.enterpriseBtn}`} onClick={() => handleSelectPlan("enterprise")} disabled={!!upgradingPlan}>
                            {upgradingPlan === "enterprise" ? <><div className={styles.btnSpinner}/> Processing...</> : "Contact Sales"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── EXPIRED: go to subscription page ── */}
                  {needsRenewal && (
                    <div className={styles.renewalSection}>
                      <div className={styles.alertBox}>
                        <AlertCircle size={18}/>
                        <div>
                          <p className={styles.alertTitle}>Subscription Expired</p>
                          <p className={styles.alertText}>Renew now to continue accessing all PROMEET features.</p>
                        </div>
                      </div>
                      <button className={styles.primaryBtn} onClick={handleRenew}>
                        Renew Subscription
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
