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
  Download,
  AlertCircle,
  ChevronRight,
  Settings,
  Info,
  LogOut,
  UserCog,
} from "lucide-react";
import styles from "./style.module.css";

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
    case "active":   return { color: "#059669", Icon: CheckCircle };
    case "expired":  return { color: "#DC2626", Icon: AlertCircle };
    case "trial":    return { color: "#D97706", Icon: Clock };
    default:         return { color: "#6B7280", Icon: AlertCircle };
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
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

  const [upgradingBusiness,   setUpgradingBusiness]   = useState(false);
  const [upgradingEnterprise, setUpgradingEnterprise] = useState(false);

  /* ── Auth ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token          = localStorage.getItem("token");
    const storedCompany  = localStorage.getItem("company");
    if (!token || !storedCompany) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(storedCompany)); }
    catch { localStorage.clear(); router.replace("/auth/login"); }
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

  /* ── Upgrade ──────────────────────────────────────────────────────── */
  const handleUpgradeBusiness = async () => {
    try {
      setUpgradingBusiness(true);
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upgrade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "business" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upgrade failed");
      if (data.success && data.redirectTo) { window.location.href = data.redirectTo; }
      else throw new Error(data.message || "No redirect URL provided");
    } catch (err) {
      toast.error("Upgrade Failed", err.message || "Failed to process upgrade. Please try again.");
      setUpgradingBusiness(false);
    }
  };

  const handleUpgradeEnterprise = async () => {
    try {
      setUpgradingEnterprise(true);
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upgrade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "enterprise" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upgrade failed");
      if (data.success && data.redirectTo) { setShowMenu(false); router.push(data.redirectTo); }
      else throw new Error(data.message || "No redirect URL provided");
    } catch (err) {
      toast.error("Contact Sales Failed", err.message || "Please contact support directly.");
      setUpgradingEnterprise(false);
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

  const canUpgradeBusiness   = currentPlan === "trial" && ["active", "trial"].includes(currentStatus);
  const canUpgradeEnterprise = ["trial", "business"].includes(currentPlan) && ["active", "trial"].includes(currentStatus);
  const needsRenewal         = ["expired", "cancelled"].includes(currentStatus);

  const { color: statusColor, Icon: StatusIcon } = getStatusStyle(subData?.STATUS);

  if (!company) return null;

  return (
    <div className={styles.container}>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <button className={styles.menuBtn} onClick={handleOpenMenu} aria-label="Open menu">
          <div className={styles.menuDots}>
            <span/><span/><span/>
          </div>
        </button>

        <div className={styles.companyInfo}>
          {company.logo_url && (
            <img src={company.logo_url} alt={`${company.name} logo`} className={styles.companyLogoHeader}/>
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

          {/* HOME VIEW */}
          {currentView === "home" && (
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
          )}

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
                              <span className={styles.period}>/mo</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={13}/> Unlimited visitors</li>
                            <li><CheckCircle size={13}/> 1,000 conference bookings</li>
                            <li><CheckCircle size={13}/> 6 conference rooms</li>
                            <li><CheckCircle size={13}/> Priority support</li>
                          </ul>
                          <button className={styles.upgradeBtn} onClick={handleUpgradeBusiness} disabled={upgradingBusiness}>
                            {upgradingBusiness ? (<><div className={styles.btnSpinner}/> Processing...</>) : "Upgrade to Business"}
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
                            <li><CheckCircle size={13}/> Custom branding</li>
                          </ul>
                          <button className={`${styles.upgradeBtn} ${styles.enterpriseBtn}`} onClick={handleUpgradeEnterprise} disabled={upgradingEnterprise}>
                            {upgradingEnterprise ? (<><div className={styles.btnSpinner}/> Processing...</>) : "Contact Sales"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {currentPlan === "enterprise" && currentStatus === "active" && (
                    <div className={styles.infoBox}>
                      <Crown size={16}/>
                      <p>You&apos;re on our premium Enterprise plan with full feature access. Contact support for custom requirements.</p>
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
