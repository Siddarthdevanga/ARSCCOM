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
  ArrowLeft,
  Settings,
  User,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Upload
} from "lucide-react";
import styles from "./style.module.css";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  // View state: "home" | "reports" | "settings"
  const [currentView, setCurrentView] = useState("home");

  // Settings tab state: "company" | "profile" | "password"
  const [settingsTab, setSettingsTab] = useState("company");

  // Subscription panel state
  const [showMenu, setShowMenu] = useState(false);
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

  // Settings states
  const [settingsData, setSettingsData] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsError, setSettingsError] = useState("");

  // Settings form states
  const [companyName, setCompanyName] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/subscription/details`, {
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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/exports/stats`, {
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

  /* ================= FETCH SETTINGS ================= */
  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      setSettingsError("");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load settings");

      setSettingsData(data);
      
      // Populate form fields
      setCompanyName(data.company?.name || "");
      setWhatsappUrl(data.company?.whatsapp_url || "");
      setLogoPreview(data.company?.logo_url || null);
      setUserName(data.user?.name || "");
      setUserPhone(data.user?.phone || "");
      setUserEmail(data.user?.email || "");

    } catch (err) {
      setSettingsError(err?.message || "Unable to fetch settings");
    } finally {
      setLoadingSettings(false);
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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.message || "Download failed");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `${reportName.replace(/\s+/g, '-')}-${Date.now()}.xlsx`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
      
      fetchExportStats();
    } catch (err) {
      setDownloadError(err?.message || "Download failed");
      setTimeout(() => setDownloadError(""), 5000);
    } finally {
      setDownloading(false);
    }
  };

  /* ================= SAVE COMPANY SETTINGS ================= */
  const handleSaveCompanySettings = async () => {
    try {
      setSavingSettings(true);
      setSettingsError("");
      setSettingsSuccess("");

      // Update company name and WhatsApp URL
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name: companyName,
          whatsappUrl: whatsappUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update company settings");

      // Update localStorage
      const storedCompany = JSON.parse(localStorage.getItem("company"));
      storedCompany.name = data.company.name;
      storedCompany.whatsapp_url = data.company.whatsapp_url;
      localStorage.setItem("company", JSON.stringify(storedCompany));
      setCompany(storedCompany);

      // Upload logo if file selected
      if (logoFile) {
        const formData = new FormData();
        formData.append("logo", logoFile);

        const logoRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company/logo`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        });

        const logoData = await logoRes.json();
        if (!logoRes.ok) throw new Error(logoData?.message || "Failed to upload logo");

        // Update localStorage with new logo
        storedCompany.logo_url = logoData.logo_url;
        localStorage.setItem("company", JSON.stringify(storedCompany));
        setCompany(storedCompany);
        setLogoPreview(logoData.logo_url);
        setLogoFile(null);
      }

      setSettingsSuccess("Company settings updated successfully");
      setTimeout(() => setSettingsSuccess(""), 5000);

    } catch (err) {
      setSettingsError(err?.message || "Failed to update settings");
      setTimeout(() => setSettingsError(""), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  /* ================= SAVE USER PROFILE ================= */
  const handleSaveUserProfile = async () => {
    try {
      setSavingSettings(true);
      setSettingsError("");
      setSettingsSuccess("");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name: userName,
          phone: userPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update profile");

      setSettingsSuccess("Profile updated successfully");
      setTimeout(() => setSettingsSuccess(""), 5000);

    } catch (err) {
      setSettingsError(err?.message || "Failed to update profile");
      setTimeout(() => setSettingsError(""), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  /* ================= CHANGE PASSWORD ================= */
  const handleChangePassword = async () => {
    try {
      setSavingSettings(true);
      setSettingsError("");
      setSettingsSuccess("");

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        setSettingsError("All password fields are required");
        setSavingSettings(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setSettingsError("New passwords do not match");
        setSavingSettings(false);
        return;
      }

      if (newPassword.length < 8) {
        setSettingsError("Password must be at least 8 characters long");
        setSavingSettings(false);
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to change password");

      setSettingsSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSettingsSuccess(""), 5000);

    } catch (err) {
      setSettingsError(err?.message || "Failed to change password");
      setTimeout(() => setSettingsError(""), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  /* ================= LOGO FILE HANDLER ================= */
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setSettingsError("Please select an image file");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSettingsError("Logo size must be less than 5MB");
      return;
    }

    setLogoFile(file);
    
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  /* ================= UPGRADE FUNCTIONS ================= */
  const handleUpgradeBusiness = async () => {
    try {
      setUpgradingBusiness(true);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upgrade`, {
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
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upgrade`, {
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
        setShowMenu(false);
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

  /* ================= VIEW HANDLERS ================= */
  const handleOpenMenu = () => {
    setShowMenu(true);
    fetchSubscription();
  };

  const handleOpenReports = () => {
    setShowMenu(false);
    setCurrentView("reports");
    fetchExportStats();
  };

  const handleOpenSettings = () => {
    setShowMenu(false);
    setCurrentView("settings");
    setSettingsTab("company");
    fetchSettings();
  };

  const handleBackToHome = () => {
    setCurrentView("home");
    setSettingsSuccess("");
    setSettingsError("");
  };

  const handleRenew = () => {
    setShowMenu(false);
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
        {currentView !== "home" ? (
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
            onClick={handleOpenMenu}
            title="Open menu"
            aria-label="Open menu"
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

            {downloadSuccess && (
              <div className={styles.notification} data-type="success">
                <CheckCircle size={18} />
                <span>Report downloaded successfully!</span>
              </div>
            )}

            {downloadError && (
              <div className={styles.notification} data-type="error">
                <AlertCircle size={18} />
                <span>{downloadError}</span>
              </div>
            )}

            {loadingStats && (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Loading statistics...</p>
              </div>
            )}

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

        {/* SETTINGS VIEW */}
        {currentView === "settings" && (
          <div className={styles.settingsView}>
            <div className={styles.settingsHeader}>
              <div className={styles.settingsHeaderIcon}>
                <Settings size={32} />
              </div>
              <div>
                <h2 className={styles.settingsTitle}>My Account</h2>
                <p className={styles.settingsSubtitle}>Manage your company and profile settings</p>
              </div>
            </div>

            {settingsSuccess && (
              <div className={styles.notification} data-type="success">
                <CheckCircle size={18} />
                <span>{settingsSuccess}</span>
              </div>
            )}

            {settingsError && (
              <div className={styles.notification} data-type="error">
                <AlertCircle size={18} />
                <span>{settingsError}</span>
              </div>
            )}

            {loadingSettings && (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Loading settings...</p>
              </div>
            )}

            {settingsData && (
              <>
                {/* Settings Tabs */}
                <div className={styles.settingsTabs}>
                  <button
                    className={settingsTab === "company" ? styles.activeTab : styles.tab}
                    onClick={() => setSettingsTab("company")}
                  >
                    <Building2 size={18} />
                    <span>Company Settings</span>
                  </button>
                  <button
                    className={settingsTab === "profile" ? styles.activeTab : styles.tab}
                    onClick={() => setSettingsTab("profile")}
                  >
                    <User size={18} />
                    <span>User Profile</span>
                  </button>
                  <button
                    className={settingsTab === "password" ? styles.activeTab : styles.tab}
                    onClick={() => setSettingsTab("password")}
                  >
                    <Lock size={18} />
                    <span>Change Password</span>
                  </button>
                </div>

                {/* Company Settings Tab */}
                {settingsTab === "company" && (
                  <div className={styles.settingsContent}>
                    <div className={styles.settingsSection}>
                      <h3 className={styles.settingsSectionTitle}>Company Information</h3>

                      <div className={styles.formGroup}>
                        <label>Company Name *</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Enter company name"
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>WhatsApp URL (Optional)</label>
                        <input
                          type="url"
                          value={whatsappUrl}
                          onChange={(e) => setWhatsappUrl(e.target.value)}
                          placeholder="https://wa.me/... or https://api.whatsapp.com/..."
                          className={styles.input}
                        />
                        <p className={styles.fieldHelp}>
                          Used in visitor pass emails. Format: https://wa.me/your-link
                        </p>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Company Logo</label>
                        {logoPreview && (
                          <div className={styles.logoPreview}>
                            <img src={logoPreview} alt="Logo preview" />
                          </div>
                        )}
                        <label htmlFor="logo-upload" className={styles.uploadBtn}>
                          <Upload size={16} />
                          <span>{logoFile ? "Change Logo" : "Upload New Logo"}</span>
                        </label>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          style={{ display: "none" }}
                        />
                        {logoFile && (
                          <p className={styles.fileSelected}>
                            Selected: {logoFile.name}
                          </p>
                        )}
                        <p className={styles.fieldHelp}>
                          Max 5MB. Formats: JPG, PNG, WEBP
                        </p>
                      </div>

                      <div className={styles.readOnlySection}>
                        <h4>Read-Only Information</h4>
                        <div className={styles.readOnlyRow}>
                          <span>Conference Rooms:</span>
                          <strong>{settingsData.company?.rooms || 0}</strong>
                        </div>
                        <div className={styles.readOnlyRow}>
                          <span>Subscription Plan:</span>
                          <strong>{settingsData.company?.plan?.toUpperCase() || "—"}</strong>
                        </div>
                        <div className={styles.readOnlyRow}>
                          <span>Status:</span>
                          <strong>{settingsData.company?.subscription_status?.toUpperCase() || "—"}</strong>
                        </div>
                      </div>

                      <button
                        className={styles.saveBtn}
                        onClick={handleSaveCompanySettings}
                        disabled={savingSettings}
                      >
                        {savingSettings ? "Saving..." : "Save Company Settings"}
                      </button>
                    </div>
                  </div>
                )}

                {/* User Profile Tab */}
                {settingsTab === "profile" && (
                  <div className={styles.settingsContent}>
                    <div className={styles.settingsSection}>
                      <h3 className={styles.settingsSectionTitle}>Personal Information</h3>

                      <div className={styles.formGroup}>
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          placeholder="Enter your name"
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          value={userPhone}
                          onChange={(e) => setUserPhone(e.target.value)}
                          placeholder="Enter your phone"
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Email Address</label>
                        <input
                          type="email"
                          value={userEmail}
                          disabled
                          className={`${styles.input} ${styles.readOnlyInput}`}
                        />
                        <p className={styles.fieldHelp}>
                          Email cannot be changed (security)
                        </p>
                      </div>

                      <button
                        className={styles.saveBtn}
                        onClick={handleSaveUserProfile}
                        disabled={savingSettings}
                      >
                        {savingSettings ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Change Password Tab */}
                {settingsTab === "password" && (
                  <div className={styles.settingsContent}>
                    <div className={styles.settingsSection}>
                      <h3 className={styles.settingsSectionTitle}>Change Password</h3>

                      <div className={styles.formGroup}>
                        <label>Current Password *</label>
                        <div className={styles.passwordInput}>
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className={styles.input}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className={styles.passwordToggle}
                          >
                            {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <label>New Password *</label>
                        <div className={styles.passwordInput}>
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 8 characters)"
                            className={styles.input}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className={styles.passwordToggle}
                          >
                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Confirm New Password *</label>
                        <div className={styles.passwordInput}>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className={styles.input}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className={styles.passwordToggle}
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                          <p className={styles.fieldError}>
                            Passwords do not match
                          </p>
                        )}
                      </div>

                      <div className={styles.infoBox}>
                        <Lock size={16} />
                        <p>
                          Password must be at least 8 characters long. You will receive a confirmation email after changing your password.
                        </p>
                      </div>

                      <button
                        className={styles.saveBtn}
                        onClick={handleChangePassword}
                        disabled={savingSettings}
                      >
                        {savingSettings ? "Changing..." : "Change Password"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>

      {/* ================= MENU PANEL (LEFT) ================= */}
      {showMenu && (
        <>
          <div
            className={styles.overlay}
            onClick={() => setShowMenu(false)}
            aria-hidden="true"
          />

          <aside
            className={styles.slidePanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-title"
          >
            <div className={styles.panelHeader}>
              <h3 id="menu-title">Menu</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowMenu(false)}
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

                  {/* Menu Items */}
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

                    <button
                      className={styles.menuItem}
                      onClick={handleOpenSettings}
                    >
                      <div className={styles.menuItemIcon}>
                        <Settings size={20} />
                      </div>
                      <div className={styles.menuItemContent}>
                        <span className={styles.menuItemTitle}>My Account</span>
                        <span className={styles.menuItemSubtitle}>Company & profile settings</span>
                      </div>
                      <ChevronRight size={18} className={styles.menuItemArrow} />
                    </button>
                  </div>

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

                  {!needsRenewal && (canUpgradeBusiness || canUpgradeEnterprise) && (
                    <div className={styles.upgradeSection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={20} />
                        <h5>Upgrade Your Plan</h5>
                      </div>
                      <p className={styles.sectionDescription}>
                        Unlock more features and grow your business
                      </p>

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
