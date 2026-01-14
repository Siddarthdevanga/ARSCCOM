"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, DoorOpen, FileSpreadsheet, CheckCircle, X, Zap, Crown } from "lucide-react";
import styles from "./style.module.css";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  const [showSub, setShowSub] = useState(false);
  const [subData, setSubData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [subError, setSubError] = useState("");

  // Upgrade states
  const [upgradingBusiness, setUpgradingBusiness] = useState(false);
  const [upgradingEnterprise, setUpgradingEnterprise] = useState(false);

  // Reports panel states
  const [showReports, setShowReports] = useState(false);
  const [exportStats, setExportStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState("");

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

  /* ================= FETCH EXPORT STATISTICS ================= */
  const fetchExportStats = async () => {
    try {
      setLoadingStats(true);
      setDownloadError("");
      setExportStats(null);

      const res = await fetch("/api/exports/stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load stats");

      setExportStats(data);
    } catch (err) {
      setDownloadError(err?.message || "Unable to fetch export statistics");
    } finally {
      setLoadingStats(false);
    }
  };

  /* ================= DOWNLOAD FUNCTIONS ================= */
  const handleDownload = async (type) => {
    try {
      setDownloading(true);
      setDownloadError("");
      setDownloadSuccess(false);

      let endpoint = "";
      switch (type) {
        case "visitors":
          endpoint = "/api/exports/visitors";
          break;
        case "bookings":
          endpoint = "/api/exports/conference-bookings";
          break;
        case "all":
          endpoint = "/api/exports/all";
          break;
        default:
          throw new Error("Invalid download type");
      }

      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.message || "Download failed");
      }

      // Get the blob and filename
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `report-${Date.now()}.xlsx`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success message
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      setDownloadError(err?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  /* ================= UPGRADE FUNCTIONS ================= */
  const handleUpgradeBusiness = async () => {
    try {
      setUpgradingBusiness(true);
      
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan: "business" })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.message || "Upgrade failed");
      }

      if (data.success && data.redirectTo) {
        // Redirect to Zoho payment page
        window.location.href = data.redirectTo;
      } else {
        throw new Error(data.message || "No redirect URL provided");
      }
    } catch (err) {
      console.error("Business upgrade error:", err);
      alert(err.message || "Failed to process Business upgrade");
      setUpgradingBusiness(false);
    }
  };

  const handleUpgradeEnterprise = async () => {
    try {
      setUpgradingEnterprise(true);
      
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan: "enterprise" })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.message || "Upgrade failed");
      }

      if (data.success && data.redirectTo) {
        // Close subscription panel and redirect to contact form
        setShowSub(false);
        router.push(data.redirectTo);
      } else {
        throw new Error(data.message || "No redirect URL provided");
      }
    } catch (err) {
      console.error("Enterprise upgrade error:", err);
      alert(err.message || "Failed to process Enterprise upgrade");
      setUpgradingEnterprise(false);
    }
  };

  const handleOpenReports = () => {
    setShowReports(true);
    fetchExportStats();
  };

  const handleOpenSubscription = () => {
    setShowSub(true);
    fetchSubscription();
  };

  const handleRenew = () => {
    setShowSub(false);
    router.push("/auth/subscription");
  };

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/auth/login");
  };

  // Determine upgrade options based on current plan and status
  const currentPlan = subData?.PLAN?.toLowerCase() || "";
  const currentStatus = subData?.STATUS?.toLowerCase() || "";
  
  const canUpgradeBusiness = currentPlan === "trial" && 
    ["active", "trial"].includes(currentStatus);
  
  const canUpgradeEnterprise = ["trial", "business"].includes(currentPlan) && 
    ["active", "trial"].includes(currentStatus);
  
  const needsRenewal = ["expired", "cancelled"].includes(currentStatus);

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
          {/* Reports Button - Unique Design */}
          <button
            className={styles.reportsBtn}
            onClick={handleOpenReports}
            title="View Reports"
            aria-label="Open Reports"
          >
            <FileSpreadsheet size={18} />
            <span>Reports</span>
          </button>

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
            <div className={styles.subHeader}>
              <h3>Subscription Details</h3>
              <button
                onClick={() => setShowSub(false)}
                aria-label="Close subscription panel"
              >
                ✖
              </button>
            </div>

            {loadingSub && (
              <p className={styles.subLoading}>
                Loading subscription…
              </p>
            )}

            {subError && (
              <p className={styles.subError}>
                {subError}
              </p>
            )}

            {subData && (
              <div className={styles.subContent}>

                <div className={styles.subRow}>
                  <span>Plan</span>
                  <strong>{subData.PLAN || "—"}</strong>
                </div>

                <div className={styles.subRow}>
                  <span>Status</span>
                  <strong 
                    style={{
                      color: 
                        subData.STATUS?.toLowerCase() === "active" ? "#00c853" :
                        subData.STATUS?.toLowerCase() === "expired" ? "#ff1744" :
                        subData.STATUS?.toLowerCase() === "trial" ? "#ff9800" :
                        "inherit"
                    }}
                  >
                    {subData.STATUS || "—"}
                  </strong>
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

                {/* ================= UPGRADE/RENEW SECTION ================= */}
                {needsRenewal && (
                  <div className={styles.upgradeSection}>
                    <div className={styles.renewalAlert}>
                      <p>
                        ⚠️ Your subscription has expired. Renew to continue using PROMEET.
                      </p>
                    </div>
                    <button
                      className={styles.renewBtn}
                      onClick={handleRenew}
                    >
                      Renew Subscription
                    </button>
                  </div>
                )}

                {!needsRenewal && (canUpgradeBusiness || canUpgradeEnterprise) && (
                  <div className={styles.upgradeSection}>
                    <div className={styles.upgradeHeader}>
                      <h4>Upgrade Your Plan</h4>
                      <p>Get more features and unlock your full potential</p>
                    </div>

                    {/* Business Plan Card */}
                    {canUpgradeBusiness && (
                      <div className={styles.planCard}>
                        <div className={styles.planCardHeader}>
                          <div className={styles.planIcon}>
                            <Zap size={20} />
                          </div>
                          <div>
                            <h5>Business Plan</h5>
                            <p className={styles.planPrice}>₹500/month</p>
                          </div>
                        </div>
                        <ul className={styles.planFeatures}>
                          <li>Unlimited visitors</li>
                          <li>1000 Conference Bookings</li>
                          <li>6 Conference Rooms</li>
                          <li>Priority support</li>
                        </ul>
                        <button
                          className={styles.upgradeBusinessBtn}
                          onClick={handleUpgradeBusiness}
                          disabled={upgradingBusiness}
                        >
                          {upgradingBusiness ? "Processing..." : "Upgrade to Business"}
                        </button>
                      </div>
                    )}

                    {/* Enterprise Plan Card */}
                    {canUpgradeEnterprise && (
                      <div className={styles.planCard}>
                        <div className={styles.planCardHeader}>
                          <div className={styles.planIcon} style={{ background: "linear-gradient(135deg, #6a1b9a, #8e24aa)" }}>
                            <Crown size={20} />
                          </div>
                          <div>
                            <h5>Enterprise Plan</h5>
                            <p className={styles.planPrice}>Custom Pricing</p>
                          </div>
                        </div>
                        <ul className={styles.planFeatures}>
                          <li>Everything in Business</li>
                          <li>Custom integrations</li>
                          <li>Dedicated account manager</li>
                          <li>Custom branding</li>
                        </ul>
                        <button
                          className={styles.upgradeEnterpriseBtn}
                          onClick={handleUpgradeEnterprise}
                          disabled={upgradingEnterprise}
                        >
                          {upgradingEnterprise ? "Processing..." : "Contact Sales"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Enterprise Active Status */}
                {currentPlan === "enterprise" && currentStatus === "active" && (
                  <div className={styles.enterpriseActive}>
                    <p>
                      ℹ️ You're on the Enterprise plan with full access to all features. 
                      Contact support for any custom requirements.
                    </p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </>
      )}

      {/* ================= RIGHT SLIDE REPORTS PANEL ================= */}
      {showReports && (
        <>
          <div
            className={styles.overlay}
            onClick={() => setShowReports(false)}
            aria-hidden="true"
          />

          <aside
            className={styles.reportsSlide}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.reportsHeader}>
              <h3>Reports</h3>
              <button
                onClick={() => setShowReports(false)}
                aria-label="Close reports panel"
              >
                ✖
              </button>
            </div>

            {/* Success Message */}
            {downloadSuccess && (
              <div className={styles.successMessage}>
                <CheckCircle size={20} />
                <span>Report downloaded successfully!</span>
              </div>
            )}

            {/* Error Message */}
            {downloadError && (
              <div className={styles.errorMessage}>
                <X size={20} />
                <span>{downloadError}</span>
              </div>
            )}

            {/* Loading Stats */}
            {loadingStats && (
              <p className={styles.reportsLoading}>
                Loading statistics…
              </p>
            )}

            {/* Download Options */}
            {exportStats && (
              <div className={styles.reportsContent}>
                
                {/* Visitors Report */}
                <div className={styles.reportCard}>
                  <div className={styles.reportCardHeader}>
                    <FileSpreadsheet size={24} color="#7a00ff" />
                    <h4>Visitor Records</h4>
                  </div>
                  <div className={styles.reportCardStats}>
                    <div className={styles.statItem}>
                      <span>Total Visitors:</span>
                      <strong>{exportStats.visitors?.total || 0}</strong>
                    </div>
                    <div className={styles.statItem}>
                      <span>Currently Active:</span>
                      <strong style={{ color: "#00c853" }}>
                        {exportStats.visitors?.active || 0}
                      </strong>
                    </div>
                  </div>
                  <button
                    className={styles.reportCardBtn}
                    onClick={() => handleDownload("visitors")}
                    disabled={downloading}
                  >
                    {downloading ? "Downloading..." : "Download Visitors"}
                  </button>
                </div>

                {/* Conference Bookings Report */}
                <div className={styles.reportCard}>
                  <div className={styles.reportCardHeader}>
                    <FileSpreadsheet size={24} color="#7a00ff" />
                    <h4>Conference Bookings</h4>
                  </div>
                  <div className={styles.reportCardStats}>
                    <div className={styles.statItem}>
                      <span>Total Bookings:</span>
                      <strong>{exportStats.bookings?.total || 0}</strong>
                    </div>
                    <div className={styles.statItem}>
                      <span>Upcoming:</span>
                      <strong style={{ color: "#ff9800" }}>
                        {exportStats.bookings?.upcoming || 0}
                      </strong>
                    </div>
                  </div>
                  <button
                    className={styles.reportCardBtn}
                    onClick={() => handleDownload("bookings")}
                    disabled={downloading}
                  >
                    {downloading ? "Downloading..." : "Download Bookings"}
                  </button>
                </div>

                {/* Complete Report */}
                <div className={styles.reportCard} style={{ borderColor: "#6a1b9a" }}>
                  <div className={styles.reportCardHeader}>
                    <FileSpreadsheet size={24} color="#6a1b9a" />
                    <h4>Complete Report</h4>
                  </div>
                  <p style={{ 
                    fontSize: "13px", 
                    color: "#666", 
                    marginBottom: "15px",
                    lineHeight: 1.4
                  }}>
                    Download both visitors and conference bookings data in a single Excel file with multiple sheets.
                  </p>
                  <button
                    className={styles.reportCardBtn}
                    style={{ 
                      background: "linear-gradient(135deg, #6a1b9a, #7a00ff)",
                      fontWeight: 600
                    }}
                    onClick={() => handleDownload("all")}
                    disabled={downloading}
                  >
                    {downloading ? "Downloading..." : "Download Complete Report"}
                  </button>
                </div>

                {/* Info Note */}
                <div className={styles.reportNote}>
                  <p>
                    📊 Reports are generated in Excel format (.xlsx) with professional formatting, 
                    including headers, borders, and color-coded status indicators.
                  </p>
                </div>

              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
