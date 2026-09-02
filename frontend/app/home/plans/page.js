"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Crown, TrendingUp, CheckCircle, AlertCircle, Clock, X, Check,
  ShieldCheck, Loader2,
} from "lucide-react";
import styles from "./style.module.css";

const PLAN_LABELS = { business: "Business", enterprise: "Enterprise", trial: "Trial" };

function getStatusStyle(status) {
  switch ((status || "").toLowerCase()) {
    case "active":       return { bg: "rgba(5,150,105,0.18)",  color: "#d1fae5", Icon: CheckCircle };
    case "expired":      return { bg: "rgba(220,38,38,0.2)",   color: "#fee2e2", Icon: AlertCircle };
    case "cancelled":    return { bg: "rgba(220,38,38,0.2)",   color: "#fee2e2", Icon: AlertCircle };
    case "trial":        return { bg: "rgba(217,119,6,0.2)",   color: "#fef3c7", Icon: Clock };
    case "grace_period": return { bg: "rgba(245,158,11,0.2)",  color: "#fef3c7", Icon: AlertCircle };
    default:             return { bg: "rgba(255,255,255,0.15)", color: "#fff", Icon: AlertCircle };
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PLAN_CARD_META = {
  business: {
    name: "Business Plan",
    Icon: Zap,
    pricing: { monthly: { price: "₹500", period: "+ GST / mo" }, annual: { price: "₹5,500", period: "+ GST / yr" } },
    features: ["Unlimited visitors", "Custom registration fields", "Priority support"],
  },
  enterprise: {
    name: "Enterprise Plan",
    Icon: Crown,
    pricing: { monthly: { price: "₹1,000", period: "+ GST / mo" }, annual: { price: "₹10,000", period: "+ GST / yr" } },
    features: ["Unlimited visitors", "Unlimited conference bookings", "Unlimited conference rooms", "Dedicated support"],
  },
};

export default function PlansPage() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [subData, setSubData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [subError, setSubError] = useState("");

  const [upgradingPlan, setUpgradingPlan] = useState("");
  const [activating, setActivating] = useState(false);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const showSuccess = (msg) => { setSuccessMsg(msg); setErrorMsg(""); setTimeout(() => setSuccessMsg(""), 5000); };
  const showError   = (msg) => { setErrorMsg(msg); setSuccessMsg(""); setTimeout(() => setErrorMsg(""), 6000); };

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [addingMandate, setAddingMandate] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  /* ── Razorpay Checkout.js ── */
  useEffect(() => {
    if (document.getElementById("razorpay-checkout-js")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.head.appendChild(script);
  }, []);

  /* ── Auth + fetch ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/login"); return; }
    fetchSubscription();
  }, [router]);

  const fetchSubscription = async () => {
    try {
      setLoadingSub(true);
      setSubError("");
      const res = await fetch(`${API_BASE}/api/subscription/details`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.MESSAGE || "Failed to load subscription");
      setSubData(data);
    } catch (err) {
      setSubError(err?.message || "Unable to fetch subscription details");
    } finally {
      setLoadingSub(false);
    }
  };

  const handleSelectPlan = async (plan, selectedInterval) => {
    if (upgradingPlan) return;
    try {
      setUpgradingPlan(plan + selectedInterval);
      const res = await fetch(`${API_BASE}/api/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan, interval: selectedInterval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Request failed");

      if (data.mode === "scheduled") {
        showSuccess(data.message);
        fetchSubscription();
        return;
      }

      if (data.mode === "subscription" && data.subscriptionId && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: "Hai Visitor",
          description: `${PLAN_LABELS[plan]} Plan (${selectedInterval})`,
          prefill: { email: company?.email || "", contact: company?.phone || "" },
          handler: () => {
            setActivating(true);
            setTimeout(() => { setActivating(false); fetchSubscription(); }, 3000);
          },
          modal: { ondismiss: () => setUpgradingPlan("") },
        });
        rzp.on("payment.failed", () => showError("Payment failed. Please try again."));
        rzp.open();
        return;
      }

      throw new Error(data.message || "Unexpected server response");
    } catch (err) {
      showError(err?.message || "Please try again.");
    } finally {
      setUpgradingPlan("");
    }
  };

  const handleAddMandate = async () => {
    if (addingMandate) return;
    try {
      setAddingMandate(true);
      const res = await fetch(`${API_BASE}/api/subscription/add-mandate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add auto-pay");

      if (data.mode === "subscription" && data.subscriptionId && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: "Hai Visitor",
          description: "Add Auto-Pay — continue your trial into Business automatically",
          prefill: { email: company?.email || "", contact: company?.phone || "" },
          handler: () => {
            setActivating(true);
            setTimeout(() => { setActivating(false); fetchSubscription(); }, 3000);
          },
          modal: { ondismiss: () => setAddingMandate(false) },
        });
        rzp.on("payment.failed", () => showError("Could not authorize auto-pay. Please try again."));
        rzp.open();
        return;
      }

      throw new Error(data.message || "Unexpected server response");
    } catch (err) {
      showError(err?.message || "Please try again.");
    } finally {
      setAddingMandate(false);
    }
  };

  const confirmCancelSubscription = async () => {
    try {
      setCancelling(true);
      const res = await fetch(`${API_BASE}/api/upgrade/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to cancel subscription");
      showSuccess(data.message || "Subscription cancelled — access continues until your current billing period ends.");
      fetchSubscription();
    } catch (err) {
      showError(err?.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  if (!company) return null;

  const currentPlan    = subData?.PLAN?.toLowerCase() || "";
  const currentStatus  = subData?.STATUS?.toLowerCase() || "";
  const currentInterval = subData?.BILLING_INTERVAL || "monthly";
  const hasAutoDebit   = subData?.HAS_AUTO_DEBIT === true;
  const hasTrialMandate = subData?.HAS_TRIAL_MANDATE === true;
  const needsMandate    = subData?.NEEDS_MANDATE === true;
  const inGracePeriod  = subData?.IN_GRACE_PERIOD === true;
  const needsRenewal   = ["expired", "cancelled"].includes(currentStatus);
  const planHasLapsed  = ["grace_period", "expired", "cancelled"].includes(currentStatus);

  const canUpgradeBusiness   = currentPlan === "trial" && !needsRenewal;
  const canUpgradeEnterprise = ["trial", "business"].includes(currentPlan) && !needsRenewal;
  const canSwitchToBusiness  = currentPlan === "enterprise" && planHasLapsed;

  const { bg: statusBg, color: statusColor, Icon: StatusIcon } = getStatusStyle(subData?.STATUS);

  // Every card now stands for one fixed plan+interval combination — no
  // shared toggle. The card matching what the company is actually on
  // (and not lapsed) gets a "Current Plan" badge.
  const PlanCard = ({ plan, interval, ctaLabel }) => {
    const meta = PLAN_CARD_META[plan];
    const pricing = meta.pricing[interval];
    const { Icon } = meta;
    const busyKey = plan + interval;
    const isCurrent = !needsRenewal && plan === currentPlan && interval === currentInterval;
    return (
      <div className={`${styles.planCard} ${plan === "enterprise" ? styles.enterpriseCard : ""} ${isCurrent ? styles.currentCard : ""}`}>
        {isCurrent && <span className={styles.currentBadge}>Current Plan</span>}
        <div className={styles.planIconWrapper}><Icon size={20}/></div>
        <div className={styles.planCardInfo}>
          <h6>{meta.name}</h6>
          <span className={styles.intervalTag}>{interval === "annual" ? "Annual" : "Monthly"}</span>
        </div>
        <div className={styles.planPricing}>
          <span className={styles.price}>{pricing.price}</span>
          <span className={styles.period}> {pricing.period}</span>
        </div>
        <ul className={styles.featureList}>
          {meta.features.map((f, i) => <li key={i}><CheckCircle size={13}/> {f}</li>)}
        </ul>
        <button
          className={`${styles.upgradeBtn} ${plan === "enterprise" ? styles.enterpriseBtn : ""}`}
          onClick={() => handleSelectPlan(plan, interval)}
          disabled={!!upgradingPlan}
        >
          {upgradingPlan === busyKey ? <><div className={styles.btnSpinner}/> Processing…</> : ctaLabel}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.container}>

      {activating && (
        <div className={styles.activatingOverlay}>
          <div className={styles.activatingSpinner}/>
          <p style={{ fontSize: "1rem", fontWeight: 600 }}>Activating your subscription…</p>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company?.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Back</button>
        </div>
      </header>

      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <h1 className={styles.heroTitle}>Plans <span>&amp; Billing</span></h1>
              <p className={styles.heroSub}>Manage your subscription, upgrade, or switch plans</p>
            </div>
            {subData && (
              <div className={styles.currentPlanPill}>
                <span className={styles.planLabel}>Current Plan</span>
                <span className={styles.planName}>{subData.PLAN || "—"}</span>
                <span className={styles.statusBadge} style={{ background: statusBg, color: statusColor }}>
                  <StatusIcon size={12}/> {subData.STATUS}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ===== TOASTS ===== */}
        {successMsg && <div className={`${styles.toast} ${styles.toastSuccess}`}><Check size={15}/> {successMsg}</div>}
        {errorMsg && <div className={`${styles.toast} ${styles.toastError}`}><X size={15}/> {errorMsg}</div>}
        {subError && !loadingSub && <div className={`${styles.toast} ${styles.toastError}`}><AlertCircle size={15}/> {subError}</div>}

        <main className={styles.mainContent}>
          {loadingSub && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}/>
              <p>Loading subscription details…</p>
            </div>
          )}

          {subData && (
            <>
              {/* ===== SUBSCRIPTION DETAILS ===== */}
              <div className={styles.detailsCard}>
                <div className={styles.detailsGrid}>
                  {subData.CUSTOMER_ID && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Customer ID</span>
                      <span className={styles.detailValue}>{subData.CUSTOMER_ID}</span>
                    </div>
                  )}
                  {subData.TRIAL_ENDS_ON && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Trial Ends</span>
                      <span className={styles.detailValue}>{formatDate(subData.TRIAL_ENDS_ON)}</span>
                    </div>
                  )}
                  {subData.EXPIRES_ON && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>{needsRenewal ? "Expired On" : "Next Billing Date"}</span>
                      <span className={styles.detailValue}>{formatDate(subData.EXPIRES_ON)}</span>
                    </div>
                  )}
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Billing Cycle</span>
                    <span className={styles.detailValue}>{currentInterval === "annual" ? "Annual" : "Monthly"}</span>
                  </div>
                  {subData.PENDING_UPGRADE_PLAN && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Scheduled Change</span>
                      <span className={styles.detailValue}>
                        {PLAN_LABELS[subData.PENDING_UPGRADE_PLAN]} ({subData.PENDING_BILLING_INTERVAL === "annual" ? "Annual" : "Monthly"}) — next cycle
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== EXPIRED/CANCELLED — free choice of any plan+interval ===== */}
              {needsRenewal && (
                <section className={styles.planSection}>
                  <div className={styles.warningNote}>
                    <AlertCircle size={16}/>
                    <span>Your subscription has {currentStatus === "cancelled" ? "been cancelled" : "expired"}. Choose a plan below to restore access.</span>
                  </div>
                  <div className={styles.planGrid}>
                    {currentPlan === "trial" && (
                      <>
                        <PlanCard plan="business" interval="monthly" ctaLabel="Upgrade to Business" />
                        <PlanCard plan="business" interval="annual" ctaLabel="Upgrade to Business" />
                        <PlanCard plan="enterprise" interval="monthly" ctaLabel="Upgrade to Enterprise" />
                        <PlanCard plan="enterprise" interval="annual" ctaLabel="Upgrade to Enterprise" />
                      </>
                    )}
                    {currentPlan === "business" && (
                      <>
                        <PlanCard plan="business" interval="monthly" ctaLabel="Renew Business" />
                        <PlanCard plan="business" interval="annual" ctaLabel="Renew Business" />
                        <PlanCard plan="enterprise" interval="monthly" ctaLabel="Upgrade to Enterprise" />
                        <PlanCard plan="enterprise" interval="annual" ctaLabel="Upgrade to Enterprise" />
                      </>
                    )}
                    {currentPlan === "enterprise" && (
                      <>
                        <PlanCard plan="business" interval="monthly" ctaLabel="Switch to Business" />
                        <PlanCard plan="business" interval="annual" ctaLabel="Switch to Business" />
                        <PlanCard plan="enterprise" interval="monthly" ctaLabel="Renew Enterprise" />
                        <PlanCard plan="enterprise" interval="annual" ctaLabel="Renew Enterprise" />
                      </>
                    )}
                    <p className={styles.customBuildNote}>
                      Need something beyond these plans? We build custom Visitor Management as per your needs —{" "}
                      <a href="/contact-us">Contact Support</a>
                    </p>
                  </div>
                </section>
              )}

              {!needsRenewal && (
                <>
                  {/* ===== ADD AUTO-PAY — trial companies from the old one-time
                      -Order flow with no mandate on file at all. Without this,
                      they can only ever expire; this lets them opt into the
                      same auto-convert-to-Business path newer signups get. ===== */}
                  {needsMandate && (
                    <section className={styles.planSection}>
                      <div className={styles.autoRenewNote} style={{ background: "rgba(124,58,237,0.12)", borderColor: "rgba(124,58,237,0.3)" }}>
                        <ShieldCheck size={18}/>
                        <span>
                          {currentStatus === "grace_period"
                            ? "Your trial has ended. Add auto-pay to reactivate instantly — your Business Plan (₹500/mo + GST) starts right away."
                            : `Add auto-pay so your Business Plan (₹500/mo + GST) continues automatically on ${formatDate(subData.TRIAL_ENDS_ON)} — no gap in access, no re-registering.`}
                        </span>
                      </div>
                      <button
                        className={styles.upgradeBtn}
                        style={{ marginTop: "14px" }}
                        onClick={handleAddMandate}
                        disabled={addingMandate}
                      >
                        {addingMandate ? <><div className={styles.btnSpinner}/> Processing…</> : "Add Auto-Pay"}
                      </button>
                    </section>
                  )}

                  {/* ===== RENEW (manual, no live auto-debit) — both intervals,
                      the one matching what's already running is badged ===== */}
                  {currentPlan !== "trial" && !hasAutoDebit && (
                    <section className={styles.planSection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={18}/>
                        <h5>{inGracePeriod ? "⚠️ Renew Before Access Ends" : "Renew Current Plan"}</h5>
                      </div>
                      {inGracePeriod && (
                        <p className={styles.sectionDescription} style={{ color: "#DC2626", fontWeight: 600 }}>
                          Grace period active — renew now to avoid suspension.
                        </p>
                      )}
                      <div className={styles.planGrid}>
                        {currentPlan === "business" && (
                          <>
                            <PlanCard plan="business" interval="monthly" ctaLabel="Renew Business" />
                            <PlanCard plan="business" interval="annual" ctaLabel="Switch to Annual" />
                          </>
                        )}
                        {currentPlan === "enterprise" && (
                          <>
                            <PlanCard plan="enterprise" interval="monthly" ctaLabel="Renew Enterprise" />
                            <PlanCard plan="enterprise" interval="annual" ctaLabel="Switch to Annual" />
                          </>
                        )}
                      </div>
                    </section>
                  )}

                  {/* ===== AUTO-DEBIT LIVE — nothing to renew, but still offer
                      switching to annual since that's a real plan change ===== */}
                  {currentPlan !== "trial" && hasAutoDebit && (
                    <section className={styles.planSection}>
                      <div className={styles.autoRenewNote}>
                        <ShieldCheck size={18}/>
                        <span>
                          Auto-renews on {formatDate(subData.EXPIRES_ON)} — your card/UPI mandate handles this automatically, no action needed.
                        </span>
                      </div>
                      {currentInterval === "monthly" && (
                        <div className={styles.planGrid} style={{ marginTop: "16px" }}>
                          <PlanCard plan={currentPlan} interval="annual" ctaLabel={`Switch ${PLAN_LABELS[currentPlan]} to Annual`} />
                        </div>
                      )}
                    </section>
                  )}

                  {/* ===== UPGRADE TO HIGHER TIER — both intervals ===== */}
                  {(canUpgradeBusiness || canUpgradeEnterprise) && (
                    <section className={styles.planSection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={18}/>
                        <h5>Upgrade Your Plan</h5>
                      </div>
                      <p className={styles.sectionDescription}>Unlock more features and scale with your business.</p>
                      <div className={styles.planGrid}>
                        {canUpgradeBusiness && (
                          <>
                            <PlanCard plan="business" interval="monthly" ctaLabel="Upgrade to Business" />
                            <PlanCard plan="business" interval="annual" ctaLabel="Upgrade to Business" />
                          </>
                        )}
                        {canUpgradeEnterprise && (
                          <>
                            <PlanCard plan="enterprise" interval="monthly" ctaLabel="Upgrade to Enterprise" />
                            <PlanCard plan="enterprise" interval="annual" ctaLabel="Upgrade to Enterprise" />
                          </>
                        )}
                        <p className={styles.customBuildNote}>
                          Need something beyond these plans? We build custom Visitor Management as per your needs —{" "}
                          <a href="/contact-us">Contact Support</a>
                        </p>
                      </div>
                    </section>
                  )}

                  {/* ===== SWITCH DOWN — only once lapsed (grace period), both intervals ===== */}
                  {canSwitchToBusiness && (
                    <section className={styles.planSection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={18}/>
                        <h5>Switch Plan</h5>
                      </div>
                      <p className={styles.sectionDescription}>Only need visitor management? Switch down to Business.</p>
                      <div className={styles.planGrid}>
                        <PlanCard plan="business" interval="monthly" ctaLabel="Switch to Business" />
                        <PlanCard plan="business" interval="annual" ctaLabel="Switch to Business" />
                      </div>
                    </section>
                  )}

                  {/* ===== CANCEL SUBSCRIPTION (Business/Enterprise) ===== */}
                  {["business", "enterprise"].includes(currentPlan) && currentStatus === "active" && (
                    <section className={styles.planSection}>
                      <div className={styles.dangerCard}>
                        <div className={styles.sectionHeader}>
                          <h5>Cancel Subscription</h5>
                        </div>
                        <p className={styles.sectionDescription}>
                          Your {PLAN_LABELS[currentPlan]} plan renews automatically. Cancelling stops future charges — you'll keep access until your current billing period ends.
                        </p>
                        <button className={styles.dangerBtn} onClick={() => setShowCancelConfirm(true)}>
                          Cancel Subscription
                        </button>
                      </div>
                    </section>
                  )}

                  {/* ===== CANCEL TRIAL AUTO-CONVERSION — mandate authorized at
                      signup, real Business billing hasn't started yet ===== */}
                  {currentPlan === "trial" && currentStatus === "active" && hasTrialMandate && (
                    <section className={styles.planSection}>
                      <div className={styles.dangerCard}>
                        <div className={styles.sectionHeader}>
                          <h5>Cancel Auto-Continue</h5>
                        </div>
                        <p className={styles.sectionDescription}>
                          Your trial is set to automatically continue as Business (₹500/mo + GST) on {formatDate(subData.TRIAL_ENDS_ON)}. Cancelling stops that — you'll keep full trial access until then, with no further charges after.
                        </p>
                        <button className={styles.dangerBtn} onClick={() => setShowCancelConfirm(true)}>
                          Cancel Auto-Continue
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* ===== CANCEL CONFIRM MODAL ===== */}
      {showCancelConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setShowCancelConfirm(false)} role="presentation">
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={styles.confirmTitle}>Cancel your subscription?</h3>
            <p className={styles.confirmText}>
              Future auto-debit charges will stop. You'll keep full access until the end of your current billing period — after that your account moves into the standard grace period, same as any other expiry.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancelBtn} onClick={() => setShowCancelConfirm(false)} disabled={cancelling}>
                Keep Subscription
              </button>
              <button className={styles.confirmSaveBtn} onClick={confirmCancelSubscription} disabled={cancelling}>
                {cancelling ? <><Loader2 size={13} className={styles.spinning}/> Cancelling…</> : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
