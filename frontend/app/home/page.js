"use client";

import { useEffect, useState } from "react";
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
  ArrowLeft
} from "lucide-react";
import styles from "./style.module.css";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  // View state
  const [currentView, setCurrentView] = useState("home"); // "home" | "reports"

  // Subscription panel states
  const [showSub, setShowSub] = useState(false);
  const [subData, setSubData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [subError, setSubError] = useState("");

  // Upgrade states
  const [upgradingBusiness, setUpgradingBusiness] = useState(false);
  const [upgradingEnterprise, setUpgradingEnterprise] = useState(false);

  // Reports states
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
      if (!res.ok) throw new Error(data?.MESSAGE || "Failed to load subscription details");

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
      if (!res.ok) throw new Error(data?.message || "Failed to load statistics");

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
      let reportName = "";
      
      switch (type) {
        case "visitors":
          endpoint = "/api/exports/visitors";
          reportName = "Visitor Records";
          break;
        case "bookings":
          endpoint = "/api/exports/conference-bookings";
          reportName = "Conference Bookings";
          break;
        case "all":
          endpoint = "/api/exports/all";
          reportName = "Complete Report";
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
      let filename = `${reportName.replace(/\s+/g, '-')}-${Date.now()}.xlsx`;
      
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
      setTimeout(() => setDownloadSuccess(false), 4000);
      
      // Refresh stats after download
      fetchExportStats();
    } catch (err) {
      setDownloadError(err?.message || "Download failed");
      setTimeout(() => setDownloadError(""), 5000);
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
        window.location.href = data.redirectTo;
      } else {
        throw new Error(data.message || "No redirect URL provided");
      }
    } catch (err) {
      console.error("Business upgrade error:", err);
      alert(err.message || "Failed to process Business upgrade. Please try again.");
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
        setShowSub(false);
        router.push(data.redirectTo);
      } else {
        throw new Error(data.message || "No redirect URL provided");
      }
    } catch (err) {
      console.error("Enterprise upgrade error:", err);
      alert(err.message || "Failed to process Enterprise upgrade. Please contact support.");
      setUpgradingEnterprise(false);
    }
  };

  const handleOpenSubscription = () => {
    setShowSub(true);
    fetchSubscription();
  };

  const handleOpenReports = () => {
    setShowSub(false);
    setCurrentView("reports");
    fetchExportStats();
  };

  const handleBackToHome = () => {
    setCurrentView("home");
  };

  const handleRenew = () => {
    setShowSub(false);
    router.push("/auth/subscription");
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.clear();
      router.replace("/auth/login");
    }
  };

  // Determine upgrade options based on current plan and status
  const currentPlan = subData?.PLAN?.toLowerCase() || "";
  const currentStatus = subData?.STATUS?.toLowerCase() || "";
  
  const canUpgradeBusiness = currentPlan === "trial" && 
    ["active", "trial"].includes(currentStatus);
  
  const canUpgradeEnterprise = ["trial", "business"].includes(currentPlan) && 
    ["active", "trial"].includes(currentStatus);
  
  const needsRenewal = ["expired", "cancelled"].includes(currentStatus);

  // Get status badge style
  const getStatusStyle = (status) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "active":
        return { color: "#00c853", icon: CheckCircle };
      case "expired":
        return { color: "#ff1744", icon: AlertCircle };
      case "trial":
        return { color: "#ff9800", icon: Clock };
      default:
        return { color: "#666", icon: AlertCircle };
    }
  };

  if (!company) return null;

  const statusStyle = getStatusStyle(subData?.STATUS);
  const StatusIcon = statusStyle.icon;

  return (
    <div className={styles.container}>

      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        {currentView === "reports" ? (
          <button
            className={styles.backBtn}
            onClick={handleBackToHome}
            aria-label="Back to home"
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
        ) : (
          <button
            className={styles.menuBtn}
            onClick={handleOpenSubscription}
            title="View subscription details"
            aria-label="Open subscription panel"
          >
            <div className={styles.menuDots}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        )}

        <div className={styles.companyInfo}>
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt={`${company.name} logo`}
              className={styles.companyLogoHeader}
            />
          )}
          <h1 className={styles.companyName}>{company.name}</h1>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <span>Logout</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className={styles.main}>
        
        {/* HOME VIEW */}
        {currentView === "home" && (
          <>
            <div className={styles.welcomeSection}>
              <h2 className={styles.welcomeTitle}>Welcome back!</h2>
              <p className={styles.welcomeSubtitle}>Choose a module to get started</p>
            </div>

            <div className={styles.cardGrid}>
              <div
                className={styles.moduleCard}
                onClick={() => router.push("/visitor/dashboard")}
                role="button"
                tabIndex={0}
                aria-label="Open Visitor Management"
                onKeyDown={(e) => e.key === 'Enter' && router.push("/visitor/dashboard")}
              >
                <div className={styles.cardIcon}>
                  <Users size={32} />
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>Visitor Management</h3>
                  <p className={styles.cardDescription}>
                    Manage visitor entries, ID verification & digital passes
                  </p>
                </div>
                <div className={styles.cardArrow}>→</div>
              </div>

              <div
                className={styles.moduleCard}
                onClick={() => router.push("/conference/dashboard")}
                role="button"
                tabIndex={0}
                aria-label="Open Conference Booking"
                onKeyDown={(e) => e.key === 'Enter' && router.push("/conference/dashboard")}
              >
                <div className={styles.cardIcon}>
                  <DoorOpen size={32} />
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>Conference Booking</h3>
                  <p className={styles.cardDescription}>
                    Schedule meetings & manage conference rooms
                  </p>
                </div>
                <div className={styles.cardArrow}>→</div>
              </div>
            </div>
          </>
        )}

        {/* REPORTS VIEW */}
        {currentView === "reports" && (
          <div className={styles.reportsView}>
            <div className={styles.reportsHeader}>
              <div className={styles.reportsHeaderIcon}>
                <FileSpreadsheet size={32} />
              </div>
              <div>
                <h2 className={styles.reportsTitle}>Reports & Analytics</h2>
                <p className={styles.reportsSubtitle}>Download and export your data</p>
              </div>
            </div>

            {/* Success Notification */}
            {downloadSuccess && (
              <div className={styles.notification} data-type="success">
                <CheckCircle size={18} />
                <span>Report downloaded successfully!</span>
              </div>
            )}

            {/* Error Notification */}
            {downloadError && (
              <div className={styles.notification} data-type="error">
                <AlertCircle size={18} />
                <span>{downloadError}</span>
              </div>
            )}

            {/* Loading Stats */}
            {loadingStats && (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Loading statistics...</p>
              </div>
            )}

            {/* Export Content */}
            {exportStats && (
              <>
                <div className={styles.statsOverview}>
                  <div className={styles.statCard}>
                    <Users size={24} />
                    <div>
                      <p className={styles.statLabel}>Total Visitors</p>
                      <p className={styles.statValue}>{exportStats.visitors?.total || 0}</p>
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <DoorOpen size={24} />
                    <div>
                      <p className={styles.statLabel}>Total Bookings</p>
                      <p className={styles.statValue}>{exportStats.bookings?.total || 0}</p>
                    </div>
                  </div>
                </div>

                <div className={styles.reportsGrid}>
                  {/* Visitor Records */}
                  <div className={styles.reportCard}>
                    <div className={styles.reportHeader}>
                      <div className={styles.reportIcon}>
                        <Users size={24} />
                      </div>
                      <div>
                        <h6>Visitor Records</h6>
                        <p className={styles.reportMeta}>
                          {exportStats.visitors?.active || 0} active • {exportStats.visitors?.total || 0} total
                        </p>
                      </div>
                    </div>
                    <button
                      className={styles.downloadBtn}
                      onClick={() => handleDownload("visitors")}
                      disabled={downloading}
                    >
                      <Download size={16} />
                      {downloading ? "Downloading..." : "Download"}
                    </button>
                  </div>

                  {/* Conference Bookings */}
                  <div className={styles.reportCard}>
                    <div className={styles.reportHeader}>
                      <div className={styles.reportIcon}>
                        <DoorOpen size={24} />
                      </div>
                      <div>
                        <h6>Conference Bookings</h6>
                        <p className={styles.reportMeta}>
                          {exportStats.bookings?.upcoming || 0} upcoming • {exportStats.bookings?.total || 0} total
                        </p>
                      </div>
                    </div>
                    <button
                      className={styles.downloadBtn}
                      onClick={() => handleDownload("bookings")}
                      disabled={downloading}
                    >
                      <Download size={16} />
                      {downloading ? "Downloading..." : "Download"}
                    </button>
                  </div>

                  {/* Complete Report */}
                  <div className={`${styles.reportCard} ${styles.premiumReport}`}>
                    <div className={styles.reportHeader}>
                      <div className={styles.reportIcon}>
                        <FileSpreadsheet size={24} />
                      </div>
                      <div>
                        <h6>Complete Report</h6>
                        <p className={styles.reportMeta}>
                          All data in one Excel file with multiple sheets
                        </p>
                      </div>
                    </div>
                    <button
                      className={`${styles.downloadBtn} ${styles.primaryDownloadBtn}`}
                      onClick={() => handleDownload("all")}
                      disabled={downloading}
                    >
                      <Download size={16} />
                      {downloading ? "Downloading..." : "Download All"}
                    </button>
                  </div>
                </div>

                <div className={styles.infoBox}>
                  <FileSpreadsheet size={16} />
                  <p>
                    Reports are exported in Excel format (.xlsx) with professional formatting, 
                    headers, and color-coded status indicators.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* ================= SUBSCRIPTION PANEL (LEFT) ================= */}
      {showSub && (
        <>
          <div
            className={styles.overlay}
            onClick={() => setShowSub(false)}
            aria-hidden="true"
          />

          <aside
            className={styles.slidePanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-title"
          >
            <div className={styles.panelHeader}>
              <h3 id="subscription-title">Menu</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowSub(false)}
                aria-label="Close panel"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.panelBody}>
              {loadingSub && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading subscription details...</p>
                </div>
              )}

              {subError && (
                <div className={styles.errorState}>
                  <AlertCircle size={24} />
                  <p>{subError}</p>
                </div>
              )}

              {subData && (
                <>
                  {/* Current Plan Card */}
                  <div className={styles.currentPlanCard}>
                    <div className={styles.planBadge}>
                      <span>Current Plan</span>
                    </div>
                    <h4 className={styles.currentPlanName}>
                      {subData.PLAN || "—"}
                    </h4>
                    <div className={styles.statusBadge} style={{ color: statusStyle.color }}>
                      <StatusIcon size={16} />
                      <span>{subData.STATUS || "—"}</span>
                    </div>
                  </div>

                  {/* Subscription Details */}
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
                        <span className={styles.detailValue}>
                          {new Date(subData.TRIAL_ENDS_ON).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}

                    {subData.EXPIRES_ON && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Expires On</span>
                        <span className={styles.detailValue}>
                          {new Date(subData.EXPIRES_ON).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}

                    {subData.LAST_PAID_ON && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Last Payment</span>
                        <span className={styles.detailValue}>
                          {new Date(subData.LAST_PAID_ON).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ================= REPORTS MENU ITEM ================= */}
                  <div className={styles.menuSection}>
                    <button
                      className={styles.menuItem}
                      onClick={handleOpenReports}
                    >
                      <div className={styles.menuItemIcon}>
                        <FileSpreadsheet size={20} />
                      </div>
                      <div className={styles.menuItemContent}>
                        <span className={styles.menuItemTitle}>Reports & Analytics</span>
                        <span className={styles.menuItemSubtitle}>Download visitor & booking data</span>
                      </div>
                      <ChevronRight size={18} className={styles.menuItemArrow} />
                    </button>
                  </div>

                  {/* ================= RENEWAL SECTION ================= */}
                  {needsRenewal && (
                    <div className={styles.renewalSection}>
                      <div className={styles.alertBox}>
                        <AlertCircle size={20} />
                        <div>
                          <p className={styles.alertTitle}>Subscription Expired</p>
                          <p className={styles.alertText}>
                            Renew now to continue accessing all PROMEET features
                          </p>
                        </div>
                      </div>
                      <button
                        className={styles.primaryBtn}
                        onClick={handleRenew}
                      >
                        Renew Subscription
                      </button>
                    </div>
                  )}

                  {/* ================= UPGRADE SECTION ================= */}
                  {!needsRenewal && (canUpgradeBusiness || canUpgradeEnterprise) && (
                    <div className={styles.upgradeSection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={20} />
                        <h5>Upgrade Your Plan</h5>
                      </div>
                      <p className={styles.sectionDescription}>
                        Unlock more features and grow your business
                      </p>

                      {/* Business Plan */}
                      {canUpgradeBusiness && (
                        <div className={styles.upgradePlanCard}>
                          <div className={styles.planIconWrapper}>
                            <Zap size={22} />
                          </div>
                          <div className={styles.planInfo}>
                            <h6>Business Plan</h6>
                            <div className={styles.planPricing}>
                              <span className={styles.price}>₹500</span>
                              <span className={styles.period}>/month</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={14} /> Unlimited visitors</li>
                            <li><CheckCircle size={14} /> 1000 Conference bookings</li>
                            <li><CheckCircle size={14} /> 6 Conference rooms</li>
                            <li><CheckCircle size={14} /> Priority support</li>
                          </ul>
                          <button
                            className={styles.upgradeBtn}
                            onClick={handleUpgradeBusiness}
                            disabled={upgradingBusiness}
                          >
                            {upgradingBusiness ? (
                              <>
                                <div className={styles.btnSpinner}></div>
                                Processing...
                              </>
                            ) : (
                              "Upgrade to Business"
                            )}
                          </button>
                        </div>
                      )}

                      {/* Enterprise Plan */}
                      {canUpgradeEnterprise && (
                        <div className={`${styles.upgradePlanCard} ${styles.enterprisePlan}`}>
                          <div className={styles.planIconWrapper}>
                            <Crown size={22} />
                          </div>
                          <div className={styles.planInfo}>
                            <h6>Enterprise Plan</h6>
                            <div className={styles.planPricing}>
                              <span className={styles.customPrice}>Custom Pricing</span>
                            </div>
                          </div>
                          <ul className={styles.featureList}>
                            <li><CheckCircle size={14} /> Everything in Business</li>
                            <li><CheckCircle size={14} /> Custom integrations</li>
                            <li><CheckCircle size={14} /> Dedicated account manager</li>
                            <li><CheckCircle size={14} /> Custom branding</li>
                          </ul>
                          <button
                            className={`${styles.upgradeBtn} ${styles.enterpriseBtn}`}
                            onClick={handleUpgradeEnterprise}
                            disabled={upgradingEnterprise}
                          >
                            {upgradingEnterprise ? (
                              <>
                                <div className={styles.btnSpinner}></div>
                                Processing...
                              </>
                            ) : (
                              "Contact Sales"
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enterprise Active Status */}
                  {currentPlan === "enterprise" && currentStatus === "active" && (
                    <div className={styles.infoBox}>
                      <Crown size={18} />
                      <p>
                        You're on our premium Enterprise plan with full access to all features. 
                        Contact support for custom requirements.
                      </p>
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
