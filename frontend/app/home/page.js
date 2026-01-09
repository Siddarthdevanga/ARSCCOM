"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, DoorOpen } from "lucide-react";
import styles from "./style.module.css";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  const [showSub, setShowSub] = useState(false);
  const [subData, setSubData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [subError, setSubError] = useState("");

  /* ================= AUTH CHECK ================= */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    try {
      setCompany(JSON.parse(storedCompany));
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router]);

  /* ================= FETCH SUBSCRIPTION ================= */
  const fetchSubscription = async () => {
    try {
      setLoadingSub(true);
      setSubError("");
      setSubData(null);

      const res = await fetch("/api/subscription/details", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.MESSAGE || "Failed to load");

      setSubData(data);
    } catch (err) {
      setSubError(err?.message || "Unable to fetch subscription");
    } finally {
      setLoadingSub(false);
    }
  };

  const handleOpenSubscription = () => {
    setShowSub(true);
    fetchSubscription();
  };

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/auth/login");
  };

  if (!company) return null;

  return (
    <div className={styles.container}>

      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div
          className={styles.menuDots}
          onClick={handleOpenSubscription}
          title="View subscription details"
          role="button"
          aria-label="Open subscription panel"
        >
          ⋮
        </div>

        <div className={styles.logoText}>{company.name}</div>

        <div className={styles.rightSection}>
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt={`${company.name} logo`}
              className={styles.companyLogo}
            />
          )}

          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            ⏻
          </button>
        </div>
      </header>

      {/* ================= MODULE CARDS ================= */}
      <div className={styles.cardWrapper}>

        {/* VISITOR MANAGEMENT */}
        <div
          className={styles.card}
          onClick={() => router.push("/visitor/dashboard")}
          role="button"
          aria-label="Open Visitor Management"
        >
          <div className={styles.iconCircle}>
            <Users size={40} />
          </div>
          <h2>Visitor Management</h2>
          <p>Manage visitor entries, ID verification & passes.</p>
        </div>

        {/* CONFERENCE BOOKING */}
        <div
          className={styles.card}
          onClick={() => router.push("/conference/dashboard")}
          role="button"
          aria-label="Open Conference Booking"
        >
          <div className={styles.iconCircle}>
            <DoorOpen size={40} />
          </div>
          <h2>Conference Booking</h2>
          <p>Manage conference rooms & meetings.</p>
        </div>

      </div>

      {/* ================= LEFT SLIDE SUBSCRIPTION PANEL ================= */}
      {showSub && (
        <>
          <div
            className={styles.overlay}
            onClick={() => setShowSub(false)}
            aria-hidden="true"
          />

          <aside
            className={styles.subSlide}
            role="dialog"
            aria-modal="true"
          >
            {/* HEADER */}
            <div className={styles.subHeader}>
              <h3>Subscription Details</h3>
              <button
                onClick={() => setShowSub(false)}
                aria-label="Close subscription panel"
              >
                ✖
              </button>
            </div>

            {/* LOADING */}
            {loadingSub && (
              <p className={styles.subLoading}>
                Loading subscription…
              </p>
            )}

            {/* ERROR */}
            {subError && (
              <p className={styles.subError}>
                {subError}
              </p>
            )}

            {/* CONTENT */}
            {subData && (
              <div className={styles.subContent}>

                <div className={styles.subRow}>
                  <span>Plan</span>
                  <strong>{subData.PLAN || "—"}</strong>
                </div>

                <div className={styles.subRow}>
                  <span>Status</span>
                  <strong>{subData.STATUS || "—"}</strong>
                </div>

                {subData.ZOHO_CUSTOMER_ID && (
                  <div className={styles.subRow}>
                    <span>Customer No</span>
                    <strong>{subData.ZOHO_CUSTOMER_ID}</strong>
                  </div>
                )}

                {subData.TRIAL_ENDS_ON && (
                  <div className={styles.subRow}>
                    <span>Trial Ends</span>
                    <strong>
                      {new Date(subData.TRIAL_ENDS_ON).toLocaleDateString()}
                    </strong>
                  </div>
                )}

                {subData.EXPIRES_ON && (
                  <div className={styles.subRow}>
                    <span>Subscription Expires</span>
                    <strong>
                      {new Date(subData.EXPIRES_ON).toLocaleDateString()}
                    </strong>
                  </div>
                )}

                {subData.LAST_PAID_ON && (
                  <div className={styles.subRow}>
                    <span>Last Paid</span>
                    <strong>
                      {new Date(subData.LAST_PAID_ON).toLocaleString()}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
