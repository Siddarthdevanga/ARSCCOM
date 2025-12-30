"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

      if (!res.ok) throw new Error(data?.message || "Failed to load");

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

        {/* LEFT — 3 DOT MENU */}
        <div
          className={styles.menuDots}
          onClick={handleOpenSubscription}
          title="View Subscription Details"
        >
          ⋮
        </div>

        {/* COMPANY NAME */}
        <div className={styles.logoText}>
          {company.name}
        </div>

        {/* RIGHT SECTION */}
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
        <div
          className={styles.card}
          onClick={() => router.push("/visitor/dashboard")}
        >
          <h2>Visitor Management</h2>
          <p>Manage visitor entries, ID verification & passes.</p>
        </div>

        <div
          className={styles.card}
          onClick={() => router.push("/conference/dashboard")}
        >
          <h2>Conference Booking</h2>
          <p>Manage conference rooms & meetings.</p>
        </div>
      </div>


      {/* ================= SUBSCRIPTION POPUP ================= */}
      {showSub && (
        <div className={styles.overlay}>
          <div className={styles.subBox}>
            <div className={styles.subHeader}>
              <h3>Subscription Details</h3>
              <button onClick={() => setShowSub(false)}>✖</button>
            </div>

            {loadingSub && <p>Loading subscription...</p>}

            {subError && (
              <p style={{ color: "red" }}>{subError}</p>
            )}

            {subData && (
              <div className={styles.subContent}>
                <p><b>Plan:</b> {subData.plan || "—"}</p>
                <p><b>Status:</b> {subData.status || "—"}</p>

                {subData.zohoCustomerId && (
                  <p><b>Zoho Customer No:</b> {subData.zohoCustomerId}</p>
                )}

                {subData.expiresOn && (
                  <p>
                    <b>Expires On:</b>{" "}
                    {new Date(subData.expiresOn).toLocaleDateString()}
                  </p>
                )}

                {subData.lastPaidOn && (
                  <p>
                    <b>Last Paid:</b>{" "}
                    {new Date(subData.lastPaidOn).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
