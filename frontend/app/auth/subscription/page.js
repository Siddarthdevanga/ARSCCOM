"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");
  const [company, setCompany] = useState(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.promeet.zodopt.com";

  /* ======================================================
        VALIDATE LOGIN + SUBSCRIPTION STATUS
  ====================================================== */
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.replace("/auth/login");
        return;
      }

      const stored = localStorage.getItem("company");
      if (!stored) return;

      let comp = {};
      try {
        comp = JSON.parse(stored);
        setCompany(comp);
      } catch {}

      const status =
        comp?.subscription_status?.toLowerCase() || "pending";

      console.log("🔎 SUBSCRIPTION PAGE STATUS:", status);

      if (["active", "trial"].includes(status)) {
        router.replace("/home");
        return;
      }
    } catch {
      router.replace("/auth/login");
    }
  }, [router]);

  /* ======================================================
        HANDLE PLAN SELECTION
  ====================================================== */
  const choosePlan = async (plan) => {
    if (loadingPlan) return;

    setError("");
    setLoadingPlan(plan);

    if (plan === "enterprise") {
      router.push("/auth/contact-us");
      setLoadingPlan("");
      return;
    }

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        router.replace("/auth/login");
        return;
      }

      const res = await fetch(`${API_BASE}/api/payment/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (res.status === 401) {
        router.replace("/auth/login");
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

      if (data?.url) {
        window.location.href = data.url;
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
      price: "₹500",
      period: "/ month",
      sub: "Best for growing teams",
      color: "green",
      features: [
        "Unlimited Visitors",
        "1000 Conference Bookings",
        "6 Conference Rooms",
        "Priority Support",
      ],
      btnText: "Proceed to Payment",
      highlight: true,
    },
    {
      key: "enterprise",
      name: "ENTERPRISE",
      price: "Custom",
      period: "Pricing",
      sub: "Tailored for large organizations",
      color: "gold",
      features: [
        "Unlimited Visitors",
        "Unlimited Conference Bookings",
        "Unlimited Conference Rooms",
        "Dedicated Support",
      ],
      btnText: "Contact Us",
      highlight: false,
    },
  ];

  /* ======================================================
        UI
  ====================================================== */
  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company?.name || "PROMEET"}</div>
        </div>
        <div className={styles.rightHeader}>
          {company?.logo_url && (
            <img src={company.logo_url} alt="Logo" className={styles.companyLogo} />
          )}
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Choose Your <span>Plan</span></h1>
          <p className={styles.heroSub}>Select the subscription that fits your team</p>
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
