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
  Lock,
  ListChecks,
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
   EXPIRY / RENEWAL MODAL — plan-specific copy, features & pricing
   ═══════════════════════════════════════════════════════════════════════════ */
const PLAN_RENEWAL_COPY = {
  trial: {
    label: "Trial",
    // Trial is one-time-only — every CTA here points at upgrading, never renewing.
    expiredTitle: "Your trial has ended",
    expiredSubtitle: "Your 15-day trial has ended. Since a trial can only be used once, upgrade to Business to keep everything running.",
    expiringSubtitle: (dateLabel) => `Upgrade to Business before ${dateLabel} — trials can't be renewed, so this is the way to keep your access.`,
    ctaLabel: "Upgrade to Business",
    priceLabel: "₹500",
    priceNote: "+ GST",
    pricePeriod: "/ month",
    features: ["Unlimited visitors", "1,000 conference bookings", "6 conference rooms", "Priority support"],
  },
  business: {
    label: "Business",
    expiredTitle: "Your Business plan has expired",
    expiredSubtitle: "Renew now to restore unlimited visitor management for your whole team.",
    expiringSubtitle: (dateLabel) => `Renew before ${dateLabel} to keep unlimited visitor management running without interruption.`,
    ctaLabel: "Renew Business",
    priceLabel: "₹590",
    priceNote: "incl. GST",
    pricePeriod: "/ month",
    features: ["Unlimited visitors", "Custom registration fields", "Priority support"],
  },
  enterprise: {
    label: "Enterprise",
    expiredTitle: "Your Enterprise plan has expired",
    expiredSubtitle: "Renew now to restore unlimited visitor management and conference booking for your whole team.",
    expiringSubtitle: (dateLabel) => `Renew before ${dateLabel} to keep visitor management and conference booking running without interruption.`,
    ctaLabel: "Renew Enterprise",
    priceLabel: "₹826",
    priceNote: "incl. GST",
    pricePeriod: "/ month",
    features: ["Unlimited visitors", "Unlimited conference bookings", "Unlimited conference rooms", "Dedicated support"],
  },
};

function ExpiryModal({ plan, isExpired, daysLeft, expiryDateLabel, onRenew, onDismiss }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onDismiss(); };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onDismiss]);

  const copy = PLAN_RENEWAL_COPY[plan] || PLAN_RENEWAL_COPY.business;

  const title = isExpired
    ? copy.expiredTitle
    : daysLeft === 0
    ? `Your ${copy.label} plan expires today`
    : `Your ${copy.label} plan expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;

  const subtitle = isExpired ? copy.expiredSubtitle : copy.expiringSubtitle(expiryDateLabel);

  return (
    <div
      className={graceStyles.expiryModalOverlay}
      onClick={onDismiss}
      role="presentation"
    >
      <div
        className={graceStyles.expiryModalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expiryModalTitle"
      >
        <div className={`${graceStyles.expiryModalHeader} ${isExpired ? graceStyles.expired : ""}`}>
          <button className={graceStyles.expiryModalClose} onClick={onDismiss} aria-label="Close">
            <X size={16} />
          </button>
          <div className={graceStyles.expiryModalIconCircle}>
            <AlertCircle size={26} />
          </div>
          <h3 id="expiryModalTitle" className={graceStyles.expiryModalTitle}>{title}</h3>
          <p className={graceStyles.expiryModalSubtitle}>{subtitle}</p>
        </div>

        <div className={graceStyles.expiryModalBody}>
          <div className={graceStyles.expiryModalPlanRow}>
            <div className={graceStyles.expiryModalPlanIcon}>
              <Zap size={18} />
            </div>
            <div className={graceStyles.expiryModalPlanInfo}>
              <h4>{copy.label} Plan</h4>
              <p>{isExpired ? "Expired" : `Ends ${expiryDateLabel}`}</p>
            </div>
            {!isExpired && (
              <div className={graceStyles.expiryModalCountdown}>
                <span className={graceStyles.countdownNum}>{daysLeft}</span>
                <span className={graceStyles.countdownLabel}>day{daysLeft !== 1 ? "s" : ""} left</span>
              </div>
            )}
          </div>

          <ul className={graceStyles.expiryModalFeatures}>
            {copy.features.map((f, i) => (
              <li key={i}><CheckCircle size={14} /> {f}</li>
            ))}
          </ul>

          <div className={graceStyles.expiryModalPriceRow}>
            <span className={graceStyles.priceValue}>{copy.priceLabel}</span>
            {copy.priceNote && <span className={graceStyles.priceNote}>{copy.priceNote}</span>}
            <span className={graceStyles.pricePeriod}>{copy.pricePeriod}</span>
          </div>

          <div className={graceStyles.expiryModalActions}>
            <button className={graceStyles.expiryModalPrimaryBtn} onClick={onRenew}>
              {copy.ctaLabel}
            </button>
            <button className={graceStyles.expiryModalSecondaryBtn} onClick={onDismiss}>
              {isExpired ? "Not Now" : "Remind Me Later"}
            </button>
          </div>
        </div>
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
  const [renewalModalDismissed, setRenewalModalDismissed] = useState(false);
  const [billingInterval, setBillingInterval] = useState("monthly"); // "monthly" | "annual" — affects Business and Enterprise

  /* ── Auth ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedCompany  = localStorage.getItem("company");
    if (!storedCompany) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(storedCompany)); }
    catch { localStorage.clear(); router.replace("/auth/login"); return; }

    // Fetch subscription details up front so the home-screen renewal
    // banner can render without the user having to open the menu.
    fetchSubscription();

    const day = new Date().getDay(); // 0=Sun … 6=Sat
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/yesterday-summary`, {
      credentials: "include",
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
        credentials: "include",
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
  const handleSelectPlan = async (plan, selectedInterval) => {
    if (upgradingPlan) return;
    try {
      setUpgradingPlan(plan);
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan, interval: (plan === "business" || plan === "enterprise") ? (selectedInterval || "monthly") : "monthly" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Request failed");
      if (data.success && data.redirectTo) {
        setShowMenu(false);
        window.location.href = data.redirectTo;
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
  const handleOpenReports     = () => { setShowMenu(false); router.push("/home/reports"); };
  const handleOpenSettings    = () => { setShowMenu(false); router.push("/home/settings"); };
  const handleOpenEmployees   = () => { setShowMenu(false); router.push("/visitor/admin"); };
  const handleOpenFormBuilder = () => { setShowMenu(false); router.push("/home/form-builder"); };
  const handleRenew         = () => { setShowMenu(false); router.push("/auth/subscription"); };

  // Clicking a locked module card should never navigate through — it
  // re-surfaces the renewal popup instead (in case it was dismissed).
  const handleModuleClick = (path) => {
    if (needsRenewal) { setRenewalModalDismissed(false); return; }
    router.push(path);
  };

  /* ── Logout ───────────────────────────────────────────────────────── */
  const handleLogout = () => {
    toast.confirm(
      "Confirm Logout",
      "Are you sure you want to log out?",
      async () => {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/logout`, {
            method: "POST",
            credentials: "include",
          });
        } catch { /* ignore — always clear local state */ }
        localStorage.clear();
        router.replace("/auth/login");
      },
      () => {}
    );
  };

  /* ── Derived State ────────────────────────────────────────────────── */
  const currentPlan   = subData?.PLAN?.toLowerCase()   || "";
  const currentStatus = subData?.STATUS?.toLowerCase() || "";

  const canUpgradeBusiness   = currentPlan === "trial"                        && ["active", "trial", "grace_period"].includes(currentStatus);
  const canUpgradeEnterprise = ["trial", "business"].includes(currentPlan)    && ["active", "trial", "grace_period"].includes(currentStatus);
  const canDowngradeToBusiness = currentPlan === "enterprise"                 && ["active", "trial", "grace_period"].includes(currentStatus);
  const needsRenewal         = ["expired", "cancelled"].includes(currentStatus);
  const inGracePeriod        = subData?.IN_GRACE_PERIOD === true;

  // Days remaining until the active plan expires (trial or paid), used to
  // surface a "renew soon" nudge on the main dashboard before it lapses.
  const expiryDateRaw   = currentPlan === "trial" ? subData?.TRIAL_ENDS_ON : subData?.EXPIRES_ON;
  const daysUntilExpiry = expiryDateRaw
    ? Math.ceil((new Date(expiryDateRaw) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon =
    !inGracePeriod &&
    ["active", "trial"].includes(currentStatus) &&
    daysUntilExpiry !== null &&
    daysUntilExpiry >= 0 &&
    daysUntilExpiry <= 7;

  const { color: statusColor, Icon: StatusIcon } = getStatusStyle(subData?.STATUS);

  if (!company) return null;

  /* ── Menu items (Reports & Analytics / Employee Directory lock when
     the subscription has lapsed — My Account stays reachable so the
     company can always get to settings/support) ─────────────────── */
  const menuItemsBlock = (
    <div className={styles.menuSection}>
      {/* Reports & Analytics */}
      <button
        className={`${styles.menuItem} ${needsRenewal ? styles.menuItemLocked : ""}`}
        onClick={needsRenewal ? undefined : handleOpenReports}
        disabled={needsRenewal}
        aria-disabled={needsRenewal}
      >
        <div className={styles.menuItemIcon}>
          {needsRenewal ? <Lock size={16}/> : <FileSpreadsheet size={18}/>}
        </div>
        <div className={styles.menuItemContent}>
          <span className={styles.menuItemTitle}>Reports & Analytics</span>
          <span className={styles.menuItemSubtitle}>
            {needsRenewal ? "Renew to unlock" : "Download visitor & booking data"}
          </span>
        </div>
        {!needsRenewal && <ChevronRight size={16} className={styles.menuItemArrow}/>}
      </button>

      {/* Employee Directory */}
      <button
        className={`${styles.menuItem} ${needsRenewal ? styles.menuItemLocked : ""}`}
        onClick={needsRenewal ? undefined : handleOpenEmployees}
        disabled={needsRenewal}
        aria-disabled={needsRenewal}
      >
        <div className={styles.menuItemIcon}>
          {needsRenewal ? <Lock size={16}/> : <UserCog size={18}/>}
        </div>
        <div className={styles.menuItemContent}>
          <span className={styles.menuItemTitle}>Employee Directory</span>
          <span className={styles.menuItemSubtitle}>
            {needsRenewal ? "Renew to unlock" : "Manage staff visitors can meet"}
          </span>
        </div>
        {!needsRenewal && <ChevronRight size={16} className={styles.menuItemArrow}/>}
      </button>

      {/* Form Builder */}
      <button
        className={`${styles.menuItem} ${needsRenewal ? styles.menuItemLocked : ""}`}
        onClick={needsRenewal ? undefined : handleOpenFormBuilder}
        disabled={needsRenewal}
        aria-disabled={needsRenewal}
      >
        <div className={styles.menuItemIcon}>
          {needsRenewal ? <Lock size={16}/> : <ListChecks size={18}/>}
        </div>
        <div className={styles.menuItemContent}>
          <span className={styles.menuItemTitle}>Form Builder</span>
          <span className={styles.menuItemSubtitle}>
            {needsRenewal ? "Renew to unlock" : "Customize visitor registration fields"}
          </span>
        </div>
        {!needsRenewal && <ChevronRight size={16} className={styles.menuItemArrow}/>}
      </button>

      {/* My Account — always reachable, even when expired */}
      <button className={styles.menuItem} onClick={handleOpenSettings}>
        <div className={styles.menuItemIcon}><Settings size={18}/></div>
        <div className={styles.menuItemContent}>
          <span className={styles.menuItemTitle}>My Account</span>
          <span className={styles.menuItemSubtitle}>Company & profile settings</span>
        </div>
        <ChevronRight size={16} className={styles.menuItemArrow}/>
      </button>
    </div>
  );

  /* ── Billing interval — shared by every plan card in this menu, so
     switching it in one place updates all of them consistently ── */
  const PLAN_CARD_META = {
    business: {
      name: "Business Plan",
      Icon: Zap,
      pricing: {
        monthly: { price: "₹500",   period: "+ GST / mo" },
        annual:  { price: "₹6,000", period: "+ GST / yr" },
      },
      features: ["Unlimited visitors", "Custom registration fields", "Priority support"],
    },
    enterprise: {
      name: "Enterprise Plan",
      Icon: Crown,
      pricing: {
        monthly: { price: "₹700",   period: "+ GST / mo" },
        annual:  { price: "₹7,000", period: "+ GST / yr" },
      },
      features: ["Unlimited visitors", "Unlimited conference bookings", "Unlimited conference rooms", "Dedicated support"],
    },
  };

  const IntervalToggleSmall = () => (
    <div className={styles.intervalToggleSmall} role="tablist" aria-label="Billing interval">
      <button
        type="button" role="tab" aria-selected={billingInterval === "monthly"}
        className={`${styles.intervalBtnSmall} ${billingInterval === "monthly" ? styles.intervalBtnSmallActive : ""}`}
        onClick={() => setBillingInterval("monthly")}
      >Monthly</button>
      <button
        type="button" role="tab" aria-selected={billingInterval === "annual"}
        className={`${styles.intervalBtnSmall} ${billingInterval === "annual" ? styles.intervalBtnSmallActive : ""}`}
        onClick={() => setBillingInterval("annual")}
      >Annual</button>
    </div>
  );

  const PlanCard = ({ plan, ctaLabel }) => {
    const meta = PLAN_CARD_META[plan];
    const pricing = meta.pricing[billingInterval];
    const { Icon } = meta;
    return (
      <div className={`${styles.upgradePlanCard} ${plan === "enterprise" ? styles.enterprisePlan : ""}`}>
        <div className={styles.planIconWrapper}><Icon size={20}/></div>
        <div className={styles.planInfo}>
          <h6>{meta.name}</h6>
          <div className={styles.planPricing}>
            <span className={styles.price}>{pricing.price}</span>
            <span className={styles.period}> {pricing.period}</span>
          </div>
        </div>
        <IntervalToggleSmall />
        <ul className={styles.featureList}>
          {meta.features.map((f, i) => <li key={i}><CheckCircle size={13}/> {f}</li>)}
        </ul>
        <button
          className={`${styles.upgradeBtn} ${plan === "enterprise" ? styles.enterpriseBtn : ""}`}
          onClick={() => handleSelectPlan(plan, billingInterval)}
          disabled={!!upgradingPlan}
        >
          {upgradingPlan === plan ? <><div className={styles.btnSpinner}/> Processing...</> : ctaLabel}
        </button>
      </div>
    );
  };

  const CustomBuildNote = () => (
    <p className={styles.customBuildNote}>
      Need something beyond these plans? We build custom Visitor Management as per your needs —{" "}
      <a href="/auth/contact-us" onClick={() => setShowMenu(false)}>Contact Support</a>
    </p>
  );

  /* ── Renew current plan (active/trial/grace_period, not trial-renewal) ── */
  const renewCurrentPlanBlock = (!needsRenewal && currentPlan && currentPlan !== "trial") ? (
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

      {currentPlan === "business" && <PlanCard plan="business" ctaLabel="Renew Business" />}

      {currentPlan === "enterprise" && <PlanCard plan="enterprise" ctaLabel="Renew Enterprise" />}
    </div>
  ) : null;

  /* ── Upgrade to a higher plan (active/trial/grace_period) ── */
  const upgradeHigherBlock = (!needsRenewal && (canUpgradeBusiness || canUpgradeEnterprise)) ? (
    <div className={styles.upgradeSection}>
      <div className={styles.sectionHeader}>
        <TrendingUp size={18}/>
        <h5>Upgrade Your Plan</h5>
      </div>
      <p className={styles.sectionDescription}>Unlock more features and scale with your business.</p>

      {canUpgradeBusiness && <PlanCard plan="business" ctaLabel="Upgrade to Business" />}

      {canUpgradeEnterprise && <PlanCard plan="enterprise" ctaLabel="Upgrade to Enterprise" />}

      <CustomBuildNote />
    </div>
  ) : null;

  /* ── Downgrade Enterprise → Business (active/trial/grace_period) ── */
  const downgradeBlock = (!needsRenewal && canDowngradeToBusiness) ? (
    <div className={styles.upgradeSection}>
      <div className={styles.sectionHeader}>
        <TrendingUp size={18}/>
        <h5>Switch Plan</h5>
      </div>
      <p className={styles.sectionDescription}>Only need visitor management? Switch down to Business.</p>

      <PlanCard plan="business" ctaLabel="Downgrade to Business" />
    </div>
  ) : null;

  /* ── Expired: plan cards filtered by previous plan — shown ABOVE the
     (now-locked) menu items, since renewing is the priority action ── */
  const expiredUpgradeBlock = needsRenewal ? (
    <div className={styles.upgradeSection}>
      <div className={styles.alertBox} style={{ marginBottom: "12px" }}>
        <AlertCircle size={18}/>
        <div>
          <p className={styles.alertTitle}>Subscription Expired</p>
          <p className={styles.alertText}>Choose a plan below to restore access.</p>
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <TrendingUp size={18}/>
        <h5>{currentPlan === "trial" ? "Upgrade Your Plan" : "Renew Your Plan"}</h5>
      </div>

      {/* Trial expired → Business + Enterprise (no trial re-select) */}
      {currentPlan === "trial" && (
        <>
          <PlanCard plan="business" ctaLabel="Upgrade to Business" />
          <PlanCard plan="enterprise" ctaLabel="Upgrade to Enterprise" />
          <CustomBuildNote />
        </>
      )}

      {/* Business expired → Business renewal */}
      {currentPlan === "business" && <PlanCard plan="business" ctaLabel="Renew Business" />}

      {/* Enterprise expired → Enterprise renewal */}
      {currentPlan === "enterprise" && <PlanCard plan="enterprise" ctaLabel="Renew Enterprise" />}
    </div>
  ) : null;

  return (
    <div className={styles.container}>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <InsightPanel items={insightItems} />

      {/* ── RENEWAL POPUP — expiring soon or already expired ── */}
      {(isExpiringSoon || needsRenewal) && !renewalModalDismissed && (
        <ExpiryModal
          isExpired={needsRenewal}
          plan={["trial", "business", "enterprise"].includes(currentPlan) ? currentPlan : "business"}
          daysLeft={daysUntilExpiry}
          expiryDateLabel={formatDate(expiryDateRaw)}
          onRenew={() => { setRenewalModalDismissed(true); handleOpenMenu(); }}
          onDismiss={() => setRenewalModalDismissed(true)}
        />
      )}

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

              {(() => {
                const modules = [
                  {
                    key: "visitor",
                    title: "Visitor Management",
                    description: "Check-ins, ID verification & digital passes",
                    features: ["Check-ins", "ID Verification", "Digital Passes"],
                    icon: <Users size={32}/>,
                    path: "/visitor/dashboard",
                  },
                  ...(currentPlan === "enterprise" ? [{
                    key: "conference",
                    title: "Conference Booking",
                    description: "Schedule meetings & manage rooms",
                    features: ["Room Booking", "Scheduling", "Availability"],
                    icon: <DoorOpen size={32}/>,
                    path: "/conference/dashboard",
                  }] : []),
                ];
                const isSingle = modules.length === 1;

                return (
                  <div className={`${styles.cardGrid} ${isSingle ? styles.cardGridSingle : ""}`}>
                    {modules.map((m) => (
                      <div
                        key={m.key}
                        className={`${styles.moduleCard} ${isSingle ? styles.moduleCardFeatured : ""} ${needsRenewal ? styles.moduleCardLocked : ""}`}
                        onClick={() => handleModuleClick(m.path)}
                        role="button"
                        tabIndex={0}
                        aria-label={needsRenewal ? `${m.title} — locked, renew to unlock` : m.title}
                        onKeyDown={(e) => e.key === "Enter" && handleModuleClick(m.path)}
                      >
                        <div className={styles.cardIcon}>{m.icon}</div>
                        <div className={styles.cardContent}>
                          <h3 className={styles.cardTitle}>{m.title}</h3>
                          <p className={styles.cardDescription}>
                            {needsRenewal ? "Renew your plan to unlock this module" : m.description}
                          </p>
                          {isSingle && !needsRenewal && (
                            <div className={styles.cardFeatureChips}>
                              {m.features.map((f) => <span key={f} className={styles.featureChip}>{f}</span>)}
                            </div>
                          )}
                        </div>
                        {needsRenewal ? (
                          <span className={styles.cardLockBadge}><Lock size={16}/></span>
                        ) : isSingle ? (
                          <span className={styles.cardCtaBtn}>Open <span className={styles.cardCtaArrow}>→</span></span>
                        ) : (
                          <span className={styles.cardArrow}>→</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
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

                  {/* Expired → upgrade/renew section comes first (priority action),
                      then the now-locked menu items. Otherwise, menu items first,
                      followed by the usual renew/upgrade sections. */}
                  {needsRenewal ? (
                    <>
                      {expiredUpgradeBlock}
                      {menuItemsBlock}
                    </>
                  ) : (
                    <>
                      {menuItemsBlock}
                      {renewCurrentPlanBlock}
                      {upgradeHigherBlock}
                      {downgradeBlock}
                    </>
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
