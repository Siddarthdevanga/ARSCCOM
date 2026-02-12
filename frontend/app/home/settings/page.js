"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2,
  User,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Edit2,
  Check,
  X,
  Loader2
} from "lucide-react";
import styles from "./style.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Notification states
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Company Settings
  const [companyName, setCompanyName] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [companyRooms, setCompanyRooms] = useState(0);
  const [companyPlan, setCompanyPlan] = useState("");
  const [companyStatus, setCompanyStatus] = useState("");

  // User Profile
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [userRole, setUserRole] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Edit mode states (inline editing)
  const [editingCompanyName, setEditingCompanyName] = useState(false);
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [editingUserName, setEditingUserName] = useState(false);
  const [editingUserPhone, setEditingUserPhone] = useState(false);

  // Temp values for inline editing
  const [tempCompanyName, setTempCompanyName] = useState("");
  const [tempWhatsapp, setTempWhatsapp] = useState("");
  const [tempUserName, setTempUserName] = useState("");
  const [tempUserPhone, setTempUserPhone] = useState("");

  // Saving states
  const [savingCompanyName, setSavingCompanyName] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingUserName, setSavingUserName] = useState(false);
  const [savingUserPhone, setSavingUserPhone] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
      fetchSettings();
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router]);

  /* ================= FETCH SETTINGS ================= */
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load settings");

      // Company data
      setCompanyName(data.company?.name || "");
      setWhatsappUrl(data.company?.whatsapp_url || "");
      setLogoPreview(data.company?.logo_url || null);
      setCompanyRooms(data.company?.rooms || 0);
      setCompanyPlan(data.company?.plan || "");
      setCompanyStatus(data.company?.subscription_status || "");

      // User data
      setUserName(data.user?.name || "");
      setUserPhone(data.user?.phone || "");
      setUserEmail(data.user?.email || "");
      setMemberSince(data.user?.created_at || "");
      setUserRole(data.user?.role || "Admin");

    } catch (err) {
      setErrorMsg(err?.message || "Unable to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  /* ================= SHOW NOTIFICATION ================= */
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 5000);
  };

  /* ================= INLINE EDIT HANDLERS ================= */
  const startEditCompanyName = () => {
    setTempCompanyName(companyName);
    setEditingCompanyName(true);
  };

  const cancelEditCompanyName = () => {
    setEditingCompanyName(false);
    setTempCompanyName("");
  };

  const saveCompanyName = async () => {
    if (!tempCompanyName.trim()) {
      showError("Company name is required");
      return;
    }

    try {
      setSavingCompanyName(true);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ name: tempCompanyName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");

      setCompanyName(tempCompanyName);
      setEditingCompanyName(false);

      // Update localStorage
      const storedCompany = JSON.parse(localStorage.getItem("company"));
      storedCompany.name = tempCompanyName;
      localStorage.setItem("company", JSON.stringify(storedCompany));
      setCompany(storedCompany);

      showSuccess("Company name updated successfully");
    } catch (err) {
      showError(err?.message || "Failed to update company name");
    } finally {
      setSavingCompanyName(false);
    }
  };

  const startEditWhatsapp = () => {
    setTempWhatsapp(whatsappUrl);
    setEditingWhatsapp(true);
  };

  const cancelEditWhatsapp = () => {
    setEditingWhatsapp(false);
    setTempWhatsapp("");
  };

  const saveWhatsapp = async () => {
    try {
      setSavingWhatsapp(true);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ 
          name: companyName,
          whatsappUrl: tempWhatsapp || null 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");

      setWhatsappUrl(tempWhatsapp);
      setEditingWhatsapp(false);

      // Update localStorage
      const storedCompany = JSON.parse(localStorage.getItem("company"));
      storedCompany.whatsapp_url = tempWhatsapp;
      localStorage.setItem("company", JSON.stringify(storedCompany));
      setCompany(storedCompany);

      showSuccess("WhatsApp URL updated successfully");
    } catch (err) {
      showError(err?.message || "Failed to update WhatsApp URL");
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const startEditUserName = () => {
    setTempUserName(userName);
    setEditingUserName(true);
  };

  const cancelEditUserName = () => {
    setEditingUserName(false);
    setTempUserName("");
  };

  const saveUserName = async () => {
    if (!tempUserName.trim()) {
      showError("Name is required");
      return;
    }

    try {
      setSavingUserName(true);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ 
          name: tempUserName,
          phone: userPhone 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");

      setUserName(tempUserName);
      setEditingUserName(false);

      showSuccess("Name updated successfully");
    } catch (err) {
      showError(err?.message || "Failed to update name");
    } finally {
      setSavingUserName(false);
    }
  };

  const startEditUserPhone = () => {
    setTempUserPhone(userPhone);
    setEditingUserPhone(true);
  };

  const cancelEditUserPhone = () => {
    setEditingUserPhone(false);
    setTempUserPhone("");
  };

  const saveUserPhone = async () => {
    if (!tempUserPhone.trim()) {
      showError("Phone is required");
      return;
    }

    try {
      setSavingUserPhone(true);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ 
          name: userName,
          phone: tempUserPhone 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");

      setUserPhone(tempUserPhone);
      setEditingUserPhone(false);

      showSuccess("Phone updated successfully");
    } catch (err) {
      showError(err?.message || "Failed to update phone");
    } finally {
      setSavingUserPhone(false);
    }
  };

  /* ================= LOGO UPLOAD ================= */
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError("Logo size must be less than 5MB");
      return;
    }

    setLogoFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadLogo = async () => {
    if (!logoFile) {
      showError("Please select a logo first");
      return;
    }

    try {
      setSavingLogo(true);

      const formData = new FormData();
      formData.append("logo", logoFile);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company/logo`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to upload logo");

      setLogoPreview(data.logo_url);
      setLogoFile(null);

      // Update localStorage
      const storedCompany = JSON.parse(localStorage.getItem("company"));
      storedCompany.logo_url = data.logo_url;
      localStorage.setItem("company", JSON.stringify(storedCompany));
      setCompany(storedCompany);

      showSuccess("Logo updated successfully");
    } catch (err) {
      showError(err?.message || "Failed to upload logo");
    } finally {
      setSavingLogo(false);
    }
  };

  /* ================= CHANGE PASSWORD ================= */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError("All password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      showError("Password must be at least 8 characters long");
      return;
    }

    try {
      setSavingPassword(true);

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

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Password changed successfully");
    } catch (err) {
      showError(err?.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  /* ================= HANDLERS ================= */
  const handleBack = () => {
    router.push("/home");
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.clear();
      router.replace("/auth/login");
    }
  };

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={handleBack}
          aria-label="Back to home"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Back</span>
        </button>

        <div className={styles.companyInfo}>
          {company?.logo_url && (
            <img
              src={company.logo_url}
              alt={`${company.name} logo`}
              className={styles.companyLogoHeader}
            />
          )}
          <h1 className={styles.companyName}>{company?.name}</h1>
        </div>

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
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className={styles.main}>
        <div className={styles.settingsView}>
          {/* Page Header */}
          <div className={styles.settingsHeader}>
            <div className={styles.settingsHeaderIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m5.196-13.804l-4.242 4.242m-2.828 2.828l-4.242 4.242M23 12h-6m-6 0H1m13.804-5.196l-4.242 4.242m-2.828 2.828l-4.242 4.242"/>
              </svg>
            </div>
            <div>
              <h2 className={styles.settingsTitle}>My Account Settings</h2>
              <p className={styles.settingsSubtitle}>Manage your company and profile information</p>
            </div>
          </div>

          {/* Notifications */}
          {successMsg && (
            <div className={styles.notification} data-type="success">
              <Check size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className={styles.notification} data-type="error">
              <X size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Settings Grid */}
          <div className={styles.settingsContent}>
            
            {/* COMPANY SETTINGS CARD */}
            <div className={styles.settingsSection}>
              <div className={styles.settingsSectionTitle}>
                <Building2 size={20} />
                <h3>Company Settings</h3>
              </div>

              {/* Company Name - Inline Edit */}
              <div className={styles.fieldGroup}>
                <label>Company Name *</label>
                {!editingCompanyName ? (
                  <div className={styles.fieldDisplay}>
                    <span className={styles.fieldValue}>{companyName}</span>
                    <button
                      className={styles.editBtn}
                      onClick={startEditCompanyName}
                      aria-label="Edit company name"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.fieldEdit}>
                    <input
                      type="text"
                      value={tempCompanyName}
                      onChange={(e) => setTempCompanyName(e.target.value)}
                      className={styles.input}
                      autoFocus
                    />
                    <div className={styles.fieldActions}>
                      <button
                        className={styles.saveBtn}
                        onClick={saveCompanyName}
                        disabled={savingCompanyName}
                      >
                        {savingCompanyName ? <Loader2 size={14} className={styles.spinning} /> : <Check size={14} />}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={cancelEditCompanyName}
                        disabled={savingCompanyName}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp URL - Inline Edit */}
              <div className={styles.fieldGroup}>
                <label>WhatsApp URL (Optional)</label>
                {!editingWhatsapp ? (
                  <div className={styles.fieldDisplay}>
                    <span className={styles.fieldValue}>{whatsappUrl || "Not set"}</span>
                    <button
                      className={styles.editBtn}
                      onClick={startEditWhatsapp}
                      aria-label="Edit WhatsApp URL"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.fieldEdit}>
                    <input
                      type="url"
                      value={tempWhatsapp}
                      onChange={(e) => setTempWhatsapp(e.target.value)}
                      placeholder="https://wa.me/..."
                      className={styles.input}
                      autoFocus
                    />
                    <div className={styles.fieldActions}>
                      <button
                        className={styles.saveBtn}
                        onClick={saveWhatsapp}
                        disabled={savingWhatsapp}
                      >
                        {savingWhatsapp ? <Loader2 size={14} className={styles.spinning} /> : <Check size={14} />}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={cancelEditWhatsapp}
                        disabled={savingWhatsapp}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <p className={styles.fieldHelp}>Used in visitor pass emails</p>
              </div>

              {/* Company Logo */}
              <div className={styles.fieldGroup}>
                <label>Company Logo</label>
                {logoPreview && (
                  <div className={styles.logoPreview}>
                    <img src={logoPreview} alt="Logo preview" />
                  </div>
                )}
                <label htmlFor="logo-upload" className={styles.uploadBtn}>
                  <Upload size={14} />
                  <span>{logoFile ? "Change Logo" : "Upload Logo"}</span>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  style={{ display: "none" }}
                />
                {logoFile && (
                  <>
                    <p className={styles.fileSelected}>{logoFile.name}</p>
                    <button
                      className={styles.saveLogoBtn}
                      onClick={uploadLogo}
                      disabled={savingLogo}
                    >
                      {savingLogo ? (
                        <>
                          <Loader2 size={14} className={styles.spinning} />
                          Uploading...
                        </>
                      ) : (
                        "Save Logo"
                      )}
                    </button>
                  </>
                )}
                <p className={styles.fieldHelp}>Max 5MB • JPG, PNG, WEBP</p>
              </div>

              {/* Read-Only Info */}
              <div className={styles.readOnlySection}>
                <h4>ℹ️ Read-Only Info</h4>
                <div className={styles.readOnlyRow}>
                  <span>Conference Rooms</span>
                  <strong>{companyRooms}</strong>
                </div>
                <div className={styles.readOnlyRow}>
                  <span>Plan</span>
                  <strong>{companyPlan || "—"}</strong>
                </div>
                <div className={styles.readOnlyRow}>
                  <span>Status</span>
                  <strong>{companyStatus || "—"}</strong>
                </div>
              </div>
            </div>

            {/* USER PROFILE CARD */}
            <div className={styles.settingsSection}>
              <div className={styles.settingsSectionTitle}>
                <User size={20} />
                <h3>User Profile</h3>
              </div>

              {/* Full Name - Inline Edit */}
              <div className={styles.fieldGroup}>
                <label>Full Name *</label>
                {!editingUserName ? (
                  <div className={styles.fieldDisplay}>
                    <span className={styles.fieldValue}>{userName}</span>
                    <button
                      className={styles.editBtn}
                      onClick={startEditUserName}
                      aria-label="Edit name"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.fieldEdit}>
                    <input
                      type="text"
                      value={tempUserName}
                      onChange={(e) => setTempUserName(e.target.value)}
                      className={styles.input}
                      autoFocus
                    />
                    <div className={styles.fieldActions}>
                      <button
                        className={styles.saveBtn}
                        onClick={saveUserName}
                        disabled={savingUserName}
                      >
                        {savingUserName ? <Loader2 size={14} className={styles.spinning} /> : <Check size={14} />}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={cancelEditUserName}
                        disabled={savingUserName}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Phone Number - Inline Edit */}
              <div className={styles.fieldGroup}>
                <label>Phone Number</label>
                {!editingUserPhone ? (
                  <div className={styles.fieldDisplay}>
                    <span className={styles.fieldValue}>{userPhone}</span>
                    <button
                      className={styles.editBtn}
                      onClick={startEditUserPhone}
                      aria-label="Edit phone"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.fieldEdit}>
                    <input
                      type="tel"
                      value={tempUserPhone}
                      onChange={(e) => setTempUserPhone(e.target.value)}
                      className={styles.input}
                      autoFocus
                    />
                    <div className={styles.fieldActions}>
                      <button
                        className={styles.saveBtn}
                        onClick={saveUserPhone}
                        disabled={savingUserPhone}
                      >
                        {savingUserPhone ? <Loader2 size={14} className={styles.spinning} /> : <Check size={14} />}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={cancelEditUserPhone}
                        disabled={savingUserPhone}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Email Address - Read Only */}
              <div className={styles.fieldGroup}>
                <label>Email Address 🔒</label>
                <div className={styles.fieldDisplay}>
                  <span className={styles.fieldValue} style={{ color: "#999" }}>{userEmail}</span>
                </div>
                <p className={styles.fieldHelp}>Email cannot be changed (security)</p>
              </div>

              {/* Read-Only Info */}
              <div className={styles.readOnlySection}>
                <h4>ℹ️ Read-Only Info</h4>
                <div className={styles.readOnlyRow}>
                  <span>Member Since</span>
                  <strong>
                    {memberSince ? new Date(memberSince).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) : "—"}
                  </strong>
                </div>
                <div className={styles.readOnlyRow}>
                  <span>Role</span>
                  <strong>{userRole}</strong>
                </div>
              </div>
            </div>

            {/* CHANGE PASSWORD CARD */}
            <div className={`${styles.settingsSection} ${styles.fullWidth}`}>
              <div className={styles.settingsSectionTitle}>
                <Lock size={20} />
                <h3>Change Password</h3>
              </div>

              <div className={styles.fieldGroup}>
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

              <div className={styles.fieldGroup}>
                <label>New Password *</label>
                <div className={styles.passwordInput}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
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

              <div className={styles.fieldGroup}>
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
                  <p className={styles.fieldError}>Passwords do not match</p>
                )}
              </div>

              <div className={styles.infoBox}>
                <Lock size={16} />
                <p>Password must be at least 8 characters. You'll receive a confirmation email.</p>
              </div>

              <button
                className={styles.primaryBtn}
                onClick={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <>
                    <Loader2 size={16} className={styles.spinning} />
                    Changing...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Change Password
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
