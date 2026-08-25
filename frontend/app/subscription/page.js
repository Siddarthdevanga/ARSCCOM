"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");
  const [company, setCompany] = useState(null);
  const [billingInterval, setBillingInterval] = useState("monthly"); // "monthly" | "annual" — affects Business and Enterprise
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (document.getElementById("razorpay-checkout-js")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.head.appendChild(script);
  }, []);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.promeet.zodopt.com";

  /* ======================================================
        VALIDATE LOGIN + SUBSCRIPTION STATUS
  ====================================================== */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("company");
      if (!stored) {
        router.replace("/login");
        return;
      }


      let comp = {};
      try {
        comp = JSON.parse(stored);
        setCompany(comp);
      } catch {}

      const status =
        comp?.subscription_status?.toLowerCase() || "pending";

      console.log("🔎 SUBSCRIPTION PAGE STATUS:", status);

      // Subscription page is only for first-time plan selection (pending/no plan).
      // Expired, active, trial, and grace_period users manage plans from the home nav panel.
      if (status !== "pending") {
        router.replace("/home");
        return;
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  /* ======================================================
        HANDLE PLAN SELECTION
  ====================================================== */
  const PLAN_VALUES = {
    free: 49,
    business: billingInterval === "annual" ? 5500 : 500,
    enterprise: billingInterval === "annual" ? 10000 : 1000,
  };

  const gaLead = (planKey) => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "generate_lead", {
        value:    PLAN_VALUES[planKey] || 0,
        currency: "INR",
        plan:     planKey,
        interval: planKey === "free" ? undefined : billingInterval,
      });
    }
  };

  const choosePlan = async (plan) => {
    if (loadingPlan) return;

    setError("");
    setLoadingPlan(plan);

    gaLead(plan);

    try {
      const res = await fetch(`${API_BASE}/api/payment/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan, interval: plan === "free" ? "monthly" : billingInterval }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (res.status === 401) {
        router.replace("/login");
        return;
      }

      if (res.status === 403) {
        setError(
          data?.message || "Subscription already active or not allowed."
        );
        return;
      }

      if (!res.ok) {
        setError(
          data?.message || "Subscription failed. Please try again."
        );
        return;
      }

      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", "begin_checkout", { value: PLAN_VALUES[plan] || 0, currency: "INR", plan });
      }

      if ((data?.mode === "order" || data?.mode === "subscription") && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: data.keyId,
          ...(data.mode === "order"
            ? { order_id: data.orderId, amount: data.amount, currency: data.currency }
            : { subscription_id: data.subscriptionId }),
          name: "Hai Visitor",
          description: plan === "free" ? "15-Day Trial" : `${plan[0].toUpperCase()}${plan.slice(1)} Plan (${billingInterval})`,
          prefill: { email: company?.email || "", contact: company?.phone || "" },
          handler: () => {
            setActivating(true);
            setTimeout(() => router.push("/home"), 2500);
          },
          modal: { ondismiss: () => setLoadingPlan("") },
        });
        rzp.on("payment.failed", () => {
          setError("Payment failed. Please try again.");
          setLoadingPlan("");
        });
        rzp.open();
        return;
      }

      setError("Unexpected server response. Please retry.");
    } catch (err) {
      console.error("SUBSCRIPTION ERROR:", err);
      setError("Unable to connect to server. Try again later.");
    } finally {
      setLoadingPlan("");
    }
  };

  /* ======================================================
        PLAN DATA
  ====================================================== */
  const plans = [
    {
      key: "free",
      name: "TRIAL",
      price: "₹49",
      period: "",
      sub: "Valid for 15 days",
      color: "purple",
      features: [
        "100 Visitor Bookings",
        "100 Conference Bookings",
        "2 Conference Rooms",
        "Email Support",
      ],
      btnText: "Proceed to Payment",
      highlight: false,
    },
    {
      key: "business",
      name: "BUSINESS",
      price: billingInterval === "annual" ? "₹5,500" : "₹500",
      period: billingInterval === "annual" ? "/ year" : "/ month",
      sub: billingInterval === "annual" ? "Visitor management — billed once a year" : "Visitor management for growing teams",
      color: "green",
      features: [
        "Unlimited Visitors",
        "Custom Registration Fields",
        "Priority Support",
      ],
      btnText: "Proceed to Payment",
      highlight: true,
    },
    {
      key: "enterprise",
      name: "ENTERPRISE",
      price: billingInterval === "annual" ? "₹10,000" : "₹1,000",
      period: billingInterval === "annual" ? "/ year" : "/ month",
      sub: billingInterval === "annual" ? "Visitor management + conference booking — billed once a year" : "Visitor management + conference booking",
      color: "gold",
      features: [
        "Unlimited Visitors",
        "Unlimited Conference Bookings",
        "Unlimited Conference Rooms",
        "Dedicated Support",
      ],
      btnText: "Proceed to Payment",
      highlight: false,
    },
  ];

  /* ======================================================
        UI
  ====================================================== */
  return (
    <div className={styles.container}>

      {activating && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999, background: "rgba(34,28,83,.85)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: "1rem",
        }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: "1rem", fontWeight: 600 }}>Activating your subscription…</p>
          <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company?.name || "Hai Visitor"}</div>
        </div>
        <div className={styles.rightHeader}>
          {company?.id && (
            <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`} alt="Logo" className={styles.companyLogo} onError={e => { e.currentTarget.style.display = "none"; }} />
          )}
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Choose Your <span>Plan</span></h1>
          <p className={styles.heroSub}>Select the subscription that fits your team</p>

          <div className={styles.intervalToggle} role="tablist" aria-label="Billing interval">
            <button
              type="button"
              role="tab"
              aria-selected={billingInterval === "monthly"}
              className={`${styles.intervalBtn} ${billingInterval === "monthly" ? styles.intervalBtnActive : ""}`}
              onClick={() => setBillingInterval("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billingInterval === "annual"}
              className={`${styles.intervalBtn} ${billingInterval === "annual" ? styles.intervalBtnActive : ""}`}
              onClick={() => setBillingInterval("annual")}
            >
              Annual
            </button>
          </div>
        </section>

        {/* ===== ERROR ===== */}
        {error && <div className={styles.errorBox}>{error}</div>}

        {/* ===== PLAN CARDS ===== */}
        <main className={styles.mainContent}>
          <div className={styles.planGrid}>
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ""}`}
              >
                {/* Badge for highlighted */}
                {plan.highlight && <div className={styles.badge}>Most Popular</div>}

                {/* Plan dot + name */}
                <div className={styles.planHeader}>
                  <span className={`${styles.planDot} ${styles[`dot${plan.color.charAt(0).toUpperCase() + plan.color.slice(1)}`]}`} />
                  <h3 className={styles.planName}>{plan.name}</h3>
                </div>

                {/* Price */}
                <div className={styles.priceBlock}>
                  <span className={styles.priceValue}>{plan.price}</span>
                  {plan.period && <span className={styles.pricePeriod}>{plan.period}</span>}
                </div>
                <p className={styles.planSub}>{plan.sub}</p>

                {/* Divider */}
                <div className={styles.divider} />

                {/* Features */}
                <ul className={styles.features}>
                  {plan.features.map((f, i) => (
                    <li key={i} className={styles.featureItem}>
                      <span className={styles.featureCheck}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  className={`${styles.planBtn} ${plan.highlight ? styles.planBtnHighlight : ""}`}
                  disabled={loadingPlan === plan.key}
                  onClick={() => choosePlan(plan.key)}
                >
                  {loadingPlan === plan.key ? (
                    <><span className={styles.btnSpinner} /> Processing…</>
                  ) : (
                    plan.btnText
                  )}
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
