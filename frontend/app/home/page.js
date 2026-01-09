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
          title="Subscription"
        >
          ⋮
        </div>

        <div className={styles.logoText}>{company.name}</div>

        <div className={styles.rightSection}>
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt="Company Logo"
              className={styles.companyLogo}
            />
          )}

          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Logout"
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
        >
          <div className={styles.iconBox}>
            <Users size={40} />
          </div>
          <h2>Visitor Management</h2>
          <p>Manage visitor entries, ID verification & passes.</p>
          <span className={styles.cardCTA}>Open →</span>
        </div>

        {/* CONFERENCE BOOKING */}
        <div
          className={styles.card}
          onClick={() => router.push("/conference/dashboard")}
        >
          <div className={styles.iconBox}>
            <DoorOpen size={40} />
          </div>
          <h2>Conference Booking</h2>
          <p>Manage conference rooms & meetings.</p>
          <span className={styles.cardCTA}>Open →</span>
        </div>

      </div>

      {/* ================= SUBSCRIPTION SLIDE ================= */}
      {showSub && (
        <>
          <div className={styles.overlay} onClick={() => setShowSub(false)} />

          <div className={styles.subSlide}>
            <div className={styles.subHeader}>
              <h3>Subscription Details</h3>
              <button onClick={() => setShowSub(false)}>✖</button>
            </div>

            {loadingSub && <p>Loading subscription...</p>}
            {subError && <p className={styles.error}>{subError}</p>}

            {subData && (
              <div className={styles.subContent}>
                <p><b>PLAN:</b> {subData.PLAN || "—"}</p>
                <p><b>STATUS:</b> {subData.STATUS || "—"}</p>

                {subData.ZOHO_CUSTOMER_ID && (
                  <p><b>CUSTOMER NO:</b> {subData.ZOHO_CUSTOMER_ID}</p>
                )}

                {subData.EXPIRES_ON && (
                  <p><b>EXPIRES:</b> {new Date(subData.EXPIRES_ON).toLocaleDateString()}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
