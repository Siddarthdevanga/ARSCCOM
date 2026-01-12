"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function SubscriptionPage() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

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

      let company = {};
      try {
        company = JSON.parse(stored);
      } catch {}

      const status =
        company?.subscription_status?.toLowerCase() || "pending";

      console.log("🔎 SUBSCRIPTION PAGE STATUS:", status);

      // Already subscribed → Go home
      if (["active", "trial"].includes(status)) {
        router.replace("/home");
        return;
      }

      // Expired / cancelled stay on page to renew
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

    // ENTERPRISE → Contact Page (correct absolute route)
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

      // Session expired
      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }

      // Backend denied
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

      /**
       * Expected backend return:
       * success: true
       * reused: true (if old pending payment link used)
       * url: "redirect-payment-url"
       */
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
        UI
  ====================================================== */
  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>PROMEET</div>
      </header>

      <h2 className={styles.title}>Choose Your Subscription Plan</h2>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.planGrid}>
        {/* ================= TRIAL ================= */}
        <div className={styles.card}>
          <h3 className={styles.planName}>TRIAL</h3>
          <p className={styles.price}>₹49</p>
          <p className={styles.subText}>Valid for 15 days</p>

          <ul className={styles.features}>
            <li>• 100 Visitor Bookings</li>
            <li>• 100 Conference Bookings</li>
            <li>•  2 Conference Rooms</li>
            <li>• Email Support</li>
          </ul>

          <button
            className={styles.btn}
            disabled={loadingPlan === "free"}
            onClick={() => choosePlan("free")}
          >
            {loadingPlan === "free"
              ? "Processing..."
              : "Proceed to Payment"}
          </button>
        </div>

        {/* ================= BUSINESS ================= */}
        <div className={`${styles.card} ${styles.cardHighlight}`}>
          <h3 className={styles.planName}>BUSINESS</h3>
          <p className={styles.price}>
            ₹500 <span>/ month</span>
          </p>
          <p className={styles.subText}>Best for growing teams</p>

          <ul className={styles.features}>
            <li>• Unlimited Visitors</li>
            <li>• 1000 Conference Bookings</li>
            <li>• 6 Conference Rooms</li>
            <li>• Priority Support</li>
          </ul>

          <button
            className={styles.btn}
            disabled={loadingPlan === "business"}
            onClick={() => choosePlan("business")}
          >
            {loadingPlan === "business"
              ? "Processing..."
              : "Proceed to Payment"}
          </button>
        </div>

        {/* ================= ENTERPRISE ================= */}
        <div className={styles.card}>
          <h3 className={styles.planName}>ENTERPRISE</h3>
          <p className={styles.price}>Custom Pricing</p>
          <p className={styles.subText}>
            Tailored for large organizations
          </p>

          <ul className={styles.features}>
            <li>• Unlimited Visitors</li>
            <li>• Unlimited Conference Bookings</li>
            <li>• Unmimited Conference Rooms</li>
            <li>• Dedicated Support</li>
          </ul>

          <button
            className={styles.btn}
            disabled={loadingPlan === "enterprise"}
            onClick={() => choosePlan("enterprise")}
          >
            Contact Us
          </button>
        </div>
      </div>
    </div>
  );
}

