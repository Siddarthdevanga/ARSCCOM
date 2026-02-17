"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, User, Lock, Eye, EyeOff,
  Upload, Edit2, Check, X, Loader2
} from "lucide-react";
import styles from "./style.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg,   setErrorMsg]   = useState("");

  // Company fields
  const [companyName,       setCompanyName]       = useState("");
  const [whatsappUrl,       setWhatsappUrl]       = useState("");
  const [whatsappGroupUrl,  setWhatsappGroupUrl]  = useState("");   // ← NEW
  const [logoPreview,       setLogoPreview]       = useState(null);
  const [logoFile,          setLogoFile]          = useState(null);

  // User fields
  const [userName,  setUserName]  = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Password fields
  const [currentPassword,     setCurrentPassword]     = useState("");
  const [newPassword,         setNewPassword]         = useState("");
  const [confirmPassword,     setConfirmPassword]     = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword,     setShowNewPassword]     = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Edit mode flags
  const [editingCompanyName,      setEditingCompanyName]      = useState(false);
  const [editingWhatsapp,         setEditingWhatsapp]         = useState(false);
  const [editingWhatsappGroup,    setEditingWhatsappGroup]    = useState(false);   // ← NEW
  const [editingUserName,         setEditingUserName]         = useState(false);
  const [editingUserPhone,        setEditingUserPhone]        = useState(false);

  // Temp values
  const [tempCompanyName,     setTempCompanyName]     = useState("");
  const [tempWhatsapp,        setTempWhatsapp]        = useState("");
  const [tempWhatsappGroup,   setTempWhatsappGroup]   = useState("");   // ← NEW
  const [tempUserName,        setTempUserName]        = useState("");
  const [tempUserPhone,       setTempUserPhone]       = useState("");

  // Saving flags
  const [savingCompanyName,    setSavingCompanyName]    = useState(false);
  const [savingWhatsapp,       setSavingWhatsapp]       = useState(false);
  const [savingWhatsappGroup,  setSavingWhatsappGroup]  = useState(false);   // ← NEW
  const [savingLogo,           setSavingLogo]           = useState(false);
  const [savingUserName,       setSavingUserName]       = useState(false);
  const [savingUserPhone,      setSavingUserPhone]      = useState(false);
  const [savingPassword,       setSavingPassword]       = useState(false);

  /* ── Auth check ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token         = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");
    if (!token || !storedCompany) { router.replace("/auth/login"); return; }
    try {
      setCompany(JSON.parse(storedCompany));
      fetchSettings();
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router]);

  /* ── Fetch settings ── */
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load settings");

      setCompanyName(data.company?.name              || "");
      setWhatsappUrl(data.company?.whatsapp_url      || "");
      setWhatsappGroupUrl(data.company?.whatsapp_group_url || "");   // ← NEW
      setLogoPreview(data.company?.logo_url          || null);
      setUserName(data.user?.name   || "");
      setUserPhone(data.user?.phone || "");
      setUserEmail(data.user?.email || "");
    } catch (err) {
      setErrorMsg(err?.message || "Unable to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 4000); };
  const showError   = (msg) => { setErrorMsg(msg);   setTimeout(() => setErrorMsg(""),   5000); };

  /* ── Company Name ── */
  const startEditCompanyName  = () => { setTempCompanyName(companyName); setEditingCompanyName(true); };
  const cancelEditCompanyName = () => { setEditingCompanyName(false); setTempCompanyName(""); };
  const saveCompanyName = async () => {
    if (!tempCompanyName.trim()) { showError("Company name is required"); return; }
    try {
      setSavingCompanyName(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    JSON.stringify({ name: tempCompanyName, whatsappUrl, whatsappGroupUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");
      setCompanyName(tempCompanyName);
      setEditingCompanyName(false);
      const sc = JSON.parse(localStorage.getItem("company"));
      sc.name = tempCompanyName;
      localStorage.setItem("company", JSON.stringify(sc));
      setCompany(sc);
      showSuccess("Company name updated successfully");
    } catch (err) { showError(err?.message || "Failed to update company name"); }
    finally { setSavingCompanyName(false); }
  };

  /* ── WhatsApp URL ── */
  const startEditWhatsapp  = () => { setTempWhatsapp(whatsappUrl); setEditingWhatsapp(true); };
  const cancelEditWhatsapp = () => { setEditingWhatsapp(false); setTempWhatsapp(""); };
  const saveWhatsapp = async () => {
    try {
      setSavingWhatsapp(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    JSON.stringify({ name: companyName, whatsappUrl: tempWhatsapp || null, whatsappGroupUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");
      setWhatsappUrl(tempWhatsapp);
      setEditingWhatsapp(false);
      const sc = JSON.parse(localStorage.getItem("company"));
      sc.whatsapp_url = tempWhatsapp;
      localStorage.setItem("company", JSON.stringify(sc));
      setCompany(sc);
      showSuccess("WhatsApp URL updated successfully");
    } catch (err) { showError(err?.message || "Failed to update WhatsApp URL"); }
    finally { setSavingWhatsapp(false); }
  };

  /* ── WhatsApp Group URL  ← NEW ── */
  const startEditWhatsappGroup  = () => { setTempWhatsappGroup(whatsappGroupUrl); setEditingWhatsappGroup(true); };
  const cancelEditWhatsappGroup = () => { setEditingWhatsappGroup(false); setTempWhatsappGroup(""); };
  const saveWhatsappGroup = async () => {
    try {
      setSavingWhatsappGroup(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    JSON.stringify({
          name:             companyName,
          whatsappUrl,
          whatsappGroupUrl: tempWhatsappGroup || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");
      setWhatsappGroupUrl(tempWhatsappGroup);
      setEditingWhatsappGroup(false);
      const sc = JSON.parse(localStorage.getItem("company"));
      sc.whatsapp_group_url = tempWhatsappGroup;
      localStorage.setItem("company", JSON.stringify(sc));
      setCompany(sc);
      showSuccess("WhatsApp Group link updated successfully");
    } catch (err) { showError(err?.message || "Failed to update WhatsApp Group link"); }
    finally { setSavingWhatsappGroup(false); }
  };

  /* ── User Name ── */
  const startEditUserName  = () => { setTempUserName(userName); setEditingUserName(true); };
  const cancelEditUserName = () => { setEditingUserName(false); setTempUserName(""); };
  const saveUserName = async () => {
    if (!tempUserName.trim()) { showError("Name is required"); return; }
    try {
      setSavingUserName(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/profile`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    JSON.stringify({ name: tempUserName, phone: userPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");
      setUserName(tempUserName);
      setEditingUserName(false);
      showSuccess("Name updated successfully");
    } catch (err) { showError(err?.message || "Failed to update name"); }
    finally { setSavingUserName(false); }
  };

  /* ── User Phone ── */
  const startEditUserPhone  = () => { setTempUserPhone(userPhone); setEditingUserPhone(true); };
  const cancelEditUserPhone = () => { setEditingUserPhone(false); setTempUserPhone(""); };
  const saveUserPhone = async () => {
    if (!tempUserPhone.trim()) { showError("Phone is required"); return; }
    try {
      setSavingUserPhone(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/profile`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    JSON.stringify({ name: userName, phone: tempUserPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update");
      setUserPhone(tempUserPhone);
      setEditingUserPhone(false);
      showSuccess("Phone updated successfully");
    } catch (err) { showError(err?.message || "Failed to update phone"); }
    finally { setSavingUserPhone(false); }
  };

  /* ── Logo ── */
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024)    { showError("Logo size must be less than 5MB"); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadLogo = async () => {
    if (!logoFile) { showError("Please select a logo first"); return; }
    try {
      setSavingLogo(true);
      const formData = new FormData();
      formData.append("logo", logoFile);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company/logo`, {
        method:  "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to upload logo");
      setLogoPreview(data.logo_url);
      setLogoFile(null);
      const sc = JSON.parse(localStorage.getItem("company"));
      sc.logo_url = data.logo_url;
      localStorage.setItem("company", JSON.stringify(sc));
      setCompany(sc);
      showSuccess("Logo updated successfully");
    } catch (err) { showError(err?.message || "Failed to upload logo"); }
    finally { setSavingLogo(false); }
  };

  /* ── Password ── */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError("All password fields are required"); return;
    }
    if (newPassword !== confirmPassword) { showError("New passwords do not match"); return; }
    if (newPassword.length < 8)          { showError("Password must be at least 8 characters long"); return; }
    try {
      setSavingPassword(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/password`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to change password");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showSuccess("Password changed successfully");
    } catch (err) { showError(err?.message || "Failed to change password"); }
    finally { setSavingPassword(false); }
  };

  const handleBack   = () => router.push("/home");
  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.clear();
      router.replace("/auth/login");
    }
  };

  /* ── Loading state ── */
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

  /* ── Helper: inline field row ── */
  const InlineField = ({
    label, value, editing, tempValue, onTempChange,
    onStart, onSave, onCancel, saving,
    type = "text", placeholder = "",
    helpText, badge,
  }) => (
    <div className={styles.fieldGroup}>
      <label>
        {label}
        {badge && <span className={styles.fieldBadge}>{badge}</span>}
      </label>
      {!editing ? (
        <div className={styles.fieldDisplay}>
          <span className={styles.fieldValue} title={value || "Not set"}>
            {value || "Not set"}
          </span>
          <button className={styles.editBtn} onClick={onStart} aria-label={`Edit ${label}`}>
            <Edit2 size={15} />
          </button>
        </div>
      ) : (
        <div className={styles.fieldEdit}>
          <input
            type={type}
            value={tempValue}
            onChange={(e) => onTempChange(e.target.value)}
            placeholder={placeholder}
            className={styles.input}
            autoFocus
          />
          <div className={styles.fieldActions}>
            <button className={styles.saveBtn} onClick={onSave} disabled={saving}>
              {saving ? <Loader2 size={14} className={styles.spinning} /> : <Check size={14} />}
            </button>
            <button className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {helpText && <p className={styles.fieldHelp}>{helpText}</p>}
    </div>
  );

  /* ── Render ── */
  return (
    <div className={styles.container}>

      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={handleBack} aria-label="Back to home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Back</span>
        </button>

        <div className={styles.companyInfo}>
          {company?.logo_url && (
            <img src={company.logo_url} alt={`${company.name} logo`} className={styles.companyLogoHeader} />
          )}
          <h1 className={styles.companyName}>{company?.name}</h1>
        </div>

        <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Logout">
          <span>Logout</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.settingsView}>

          {/* Page title */}
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
              <Check size={18} /><span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className={styles.notification} data-type="error">
              <X size={18} /><span>{errorMsg}</span>
            </div>
          )}

          {/* Grid */}
          <div className={styles.settingsContent}>

            {/* ── Company Settings ── */}
            <div className={styles.settingsSection}>
              <div className={styles.settingsSectionTitle}>
                <Building2 size={20} />
                <h3>Company Settings</h3>
              </div>

              {/* Company Name */}
              <InlineField
                label="Company Name *"
                value={companyName}
                editing={editingCompanyName}
                tempValue={tempCompanyName}
                onTempChange={setTempCompanyName}
                onStart={startEditCompanyName}
                onSave={saveCompanyName}
                onCancel={cancelEditCompanyName}
                saving={savingCompanyName}
              />

              {/* WhatsApp Direct URL */}
              <InlineField
                label="WhatsApp URL"
                badge="Optional"
                value={whatsappUrl}
                editing={editingWhatsapp}
                tempValue={tempWhatsapp}
                onTempChange={setTempWhatsapp}
                onStart={startEditWhatsapp}
                onSave={saveWhatsapp}
                onCancel={cancelEditWhatsapp}
                saving={savingWhatsapp}
                type="url"
                placeholder="https://api.whatsapp.com/send/?phone=91..."
                helpText="Direct chat link — used in visitor pass emails"
              />

              {/* WhatsApp Group Invite ← NEW */}
              <InlineField
                label="WhatsApp Group Invite"
                badge="Optional"
                value={whatsappGroupUrl}
                editing={editingWhatsappGroup}
                tempValue={tempWhatsappGroup}
                onTempChange={setTempWhatsappGroup}
                onStart={startEditWhatsappGroup}
                onSave={saveWhatsappGroup}
                onCancel={cancelEditWhatsappGroup}
                saving={savingWhatsappGroup}
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                helpText="Group invite link — shared with visitors on check-in"
              />

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
                  id="logo-upload" type="file" accept="image/*"
                  onChange={handleLogoChange} style={{ display: "none" }}
                />
                {logoFile && (
                  <>
                    <p className={styles.fileSelected} title={logoFile.name}>{logoFile.name}</p>
                    <button className={styles.saveLogoBtn} onClick={uploadLogo} disabled={savingLogo}>
                      {savingLogo
                        ? <><Loader2 size={14} className={styles.spinning} /> Uploading...</>
                        : "Save Logo"
                      }
                    </button>
                  </>
                )}
                <p className={styles.fieldHelp}>Max 5MB • JPG, PNG, WEBP</p>
              </div>
            </div>

            {/* ── User Profile ── */}
            <div className={styles.settingsSection}>
              <div className={styles.settingsSectionTitle}>
                <User size={20} />
                <h3>User Profile</h3>
              </div>

              <InlineField
                label="Full Name *"
                value={userName}
                editing={editingUserName}
                tempValue={tempUserName}
                onTempChange={setTempUserName}
                onStart={startEditUserName}
                onSave={saveUserName}
                onCancel={cancelEditUserName}
                saving={savingUserName}
              />

              <InlineField
                label="Phone Number"
                value={userPhone}
                editing={editingUserPhone}
                tempValue={tempUserPhone}
                onTempChange={setTempUserPhone}
                onStart={startEditUserPhone}
                onSave={saveUserPhone}
                onCancel={cancelEditUserPhone}
                saving={savingUserPhone}
                type="tel"
              />

              {/* Email — read only */}
              <div className={styles.fieldGroup}>
                <label>Email Address 🔒</label>
                <div className={styles.fieldDisplay}>
                  <span className={styles.fieldValue} style={{ color: "#999" }} title={userEmail}>
                    {userEmail}
                  </span>
                </div>
                <p className={styles.fieldHelp}>Email cannot be changed (security)</p>
              </div>
            </div>

            {/* ── Change Password ── */}
            <div className={`${styles.settingsSection} ${styles.fullWidth}`}>
              <div className={styles.settingsSectionTitle}>
                <Lock size={20} />
                <h3>Change Password</h3>
              </div>

              {[
                { label: "Current Password *", value: currentPassword, setter: setCurrentPassword, show: showCurrentPassword, toggle: () => setShowCurrentPassword(p => !p), placeholder: "Enter current password" },
                { label: "New Password *",      value: newPassword,     setter: setNewPassword,     show: showNewPassword,     toggle: () => setShowNewPassword(p => !p),     placeholder: "Min 8 characters" },
                { label: "Confirm New Password *", value: confirmPassword, setter: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(p => !p), placeholder: "Confirm new password" },
              ].map(({ label, value, setter, show, toggle, placeholder }) => (
                <div className={styles.fieldGroup} key={label}>
                  <label>{label}</label>
                  <div className={styles.passwordInput}>
                    <input
                      type={show ? "text" : "password"}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      className={styles.input}
                    />
                    <button type="button" onClick={toggle} className={styles.passwordToggle}>
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              ))}

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className={styles.fieldError}>Passwords do not match</p>
              )}

              <div className={styles.infoBox}>
                <Lock size={16} />
                <p>Password must be at least 8 characters. You'll receive a confirmation email.</p>
              </div>

              <button className={styles.primaryBtn} onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword
                  ? <><Loader2 size={16} className={styles.spinning} /> Changing...</>
                  : <><Lock size={16} /> Change Password</>
                }
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
