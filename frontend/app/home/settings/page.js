"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, User, Lock, Eye, EyeOff, Upload, Edit2, Check, X, Loader2,
} from "lucide-react";
import styles from "./style.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [editingCompanyName, setEditingCompanyName] = useState(false);
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [editingUserName, setEditingUserName] = useState(false);
  const [editingUserPhone, setEditingUserPhone] = useState(false);

  const [tempCompanyName, setTempCompanyName] = useState("");
  const [tempWhatsapp, setTempWhatsapp] = useState("");
  const [tempUserName, setTempUserName] = useState("");
  const [tempUserPhone, setTempUserPhone] = useState("");

  const [savingCompanyName, setSavingCompanyName] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingUserName, setSavingUserName] = useState(false);
  const [savingUserPhone, setSavingUserPhone] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
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

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load settings");
      setCompanyName(data.company?.name || "");
      setWhatsappUrl(data.company?.whatsapp_url || "");
      setLogoPreview(data.company?.logo_url || null);
      setUserName(data.user?.name || "");
      setUserPhone(data.user?.phone || "");
      setUserEmail(data.user?.email || "");
    } catch (err) {
      setErrorMsg(err?.message || "Unable to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 4000); };
  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(""), 5000); };

  /* ── Company Name ── */
  const startEditCompanyName = () => { setTempCompanyName(companyName); setEditingCompanyName(true); };
  const cancelEditCompanyName = () => { setEditingCompanyName(false); setTempCompanyName(""); };
  const saveCompanyName = async () => {
    if (!tempCompanyName.trim()) { showError("Company name is required"); return; }
    try {
      setSavingCompanyName(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name: tempCompanyName }),
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

  /* ── WhatsApp ── */
  const startEditWhatsapp = () => { setTempWhatsapp(whatsappUrl); setEditingWhatsapp(true); };
  const cancelEditWhatsapp = () => { setEditingWhatsapp(false); setTempWhatsapp(""); };
  const saveWhatsapp = async () => {
    try {
      setSavingWhatsapp(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/company`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name: companyName, whatsappUrl: tempWhatsapp || null }),
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

  /* ── User Name ── */
  const startEditUserName = () => { setTempUserName(userName); setEditingUserName(true); };
  const cancelEditUserName = () => { setEditingUserName(false); setTempUserName(""); };
  const saveUserName = async () => {
    if (!tempUserName.trim()) { showError("Name is required"); return; }
    try {
      setSavingUserName(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name: tempUserName, phone: userPhone }),
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
  const startEditUserPhone = () => { setTempUserPhone(userPhone); setEditingUserPhone(true); };
  const cancelEditUserPhone = () => { setEditingUserPhone(false); setTempUserPhone(""); };
  const saveUserPhone = async () => {
    if (!tempUserPhone.trim()) { showError("Phone is required"); return; }
    try {
      setSavingUserPhone(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name: userName, phone: tempUserPhone }),
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
    if (file.size > 5 * 1024 * 1024) { showError("Logo size must be less than 5MB"); return; }
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
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
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
    if (!currentPassword || !newPassword || !confirmPassword) { showError("All password fields are required"); return; }
    if (newPassword !== confirmPassword) { showError("New passwords do not match"); return; }
    if (newPassword.length < 8) { showError("Password must be at least 8 characters long"); return; }
    try {
      setSavingPassword(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to change password");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showSuccess("Password changed successfully");
    } catch (err) { showError(err?.message || "Failed to change password"); }
    finally { setSavingPassword(false); }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.clear();
      router.replace("/auth/login");
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          Loading settings…
        </div>
      </div>
    );
  }

  /* ── Inline Editable Field ── */
  const EditableField = ({ label, value, editing, temp, setTemp, startEdit, cancelEditFn, saveFn, saving, placeholder, type = "text" }) => (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      {!editing ? (
        <div className={styles.fieldDisplay}>
          <span className={styles.fieldValue} title={value || "Not set"}>{value || "Not set"}</span>
          <button className={styles.editBtn} onClick={startEdit} aria-label={`Edit ${label}`}>
            <Edit2 size={14} />
          </button>
        </div>
      ) : (
        <div className={styles.fieldEdit}>
          <input
            type={type}
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            className={styles.input}
            placeholder={placeholder}
            autoFocus
          />
          <div className={styles.fieldActions}>
            <button className={styles.saveFieldBtn} onClick={saveFn} disabled={saving}>
              {saving ? <Loader2 size={13} className={styles.spinning} /> : <Check size={13} />}
            </button>
            <button className={styles.cancelFieldBtn} onClick={cancelEditFn} disabled={saving}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company?.name}</div>
        </div>
        <div className={styles.rightHeader}>
          {company?.logo_url && (
            <img src={company.logo_url} alt="Logo" className={styles.companyLogo} />
          )}
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Back</button>
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Account <span>Settings</span></h1>
          <p className={styles.heroSub}>Manage your company and profile information</p>
        </section>

        {/* ===== TOASTS ===== */}
        {successMsg && <div className={`${styles.toast} ${styles.toastSuccess}`}><Check size={15} /> {successMsg}</div>}
        {errorMsg && <div className={`${styles.toast} ${styles.toastError}`}><X size={15} /> {errorMsg}</div>}

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>
          <div className={styles.settingsGrid}>

            {/* ── COMPANY SETTINGS ── */}
            <div className={styles.settingsCard}>
              <div className={styles.sectionHeader}>
                <span className={styles.cardDot} />
                <Building2 size={15} className={styles.sectionIcon} />
                <h3 className={styles.cardTitle}>Company Settings</h3>
              </div>

              <EditableField
                label="Company Name *"
                value={companyName}
                editing={editingCompanyName}
                temp={tempCompanyName}
                setTemp={setTempCompanyName}
                startEdit={startEditCompanyName}
                cancelEditFn={cancelEditCompanyName}
                saveFn={saveCompanyName}
                saving={savingCompanyName}
                placeholder="Company name"
              />

              <EditableField
                label="WhatsApp URL"
                value={whatsappUrl}
                editing={editingWhatsapp}
                temp={tempWhatsapp}
                setTemp={setTempWhatsapp}
                startEdit={startEditWhatsapp}
                cancelEditFn={cancelEditWhatsapp}
                saveFn={saveWhatsapp}
                saving={savingWhatsapp}
                placeholder="https://api.whatsapp.com/send/?phone=91…"
                type="url"
              />
              <p className={styles.fieldHelp}>Used in visitor pass emails</p>

              {/* Logo */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Company Logo</label>
                {logoPreview && (
                  <div className={styles.logoPreview}><img src={logoPreview} alt="Logo preview" /></div>
                )}
                <label htmlFor="logo-upload" className={styles.uploadBtn}>
                  <Upload size={13} /> {logoFile ? "Change Logo" : "Upload Logo"}
                </label>
                <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
                {logoFile && (
                  <>
                    <p className={styles.fileSelected} title={logoFile.name}>{logoFile.name}</p>
                    <button className={styles.saveLogoBtn} onClick={uploadLogo} disabled={savingLogo}>
                      {savingLogo ? <><Loader2 size={13} className={styles.spinning} /> Uploading…</> : "Save Logo"}
                    </button>
                  </>
                )}
                <p className={styles.fieldHelp}>Max 5MB · JPG, PNG, WEBP</p>
              </div>
            </div>

            {/* ── USER PROFILE ── */}
            <div className={styles.settingsCard}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.cardDot} ${styles.dotGreen}`} />
                <User size={15} className={styles.sectionIcon} />
                <h3 className={styles.cardTitle}>User Profile</h3>
              </div>

              <EditableField
                label="Full Name *"
                value={userName}
                editing={editingUserName}
                temp={tempUserName}
                setTemp={setTempUserName}
                startEdit={startEditUserName}
                cancelEditFn={cancelEditUserName}
                saveFn={saveUserName}
                saving={savingUserName}
                placeholder="Your name"
              />

              <EditableField
                label="Phone Number"
                value={userPhone}
                editing={editingUserPhone}
                temp={tempUserPhone}
                setTemp={setTempUserPhone}
                startEdit={startEditUserPhone}
                cancelEditFn={cancelEditUserPhone}
                saveFn={saveUserPhone}
                saving={savingUserPhone}
                placeholder="Phone number"
                type="tel"
              />

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Email 🔒</label>
                <div className={styles.fieldDisplay}>
                  <span className={styles.fieldValue} style={{ color: "#b8a8d8" }} title={userEmail}>{userEmail}</span>
                </div>
                <p className={styles.fieldHelp}>Email cannot be changed</p>
              </div>
            </div>

            {/* ── CHANGE PASSWORD ── */}
            <div className={`${styles.settingsCard} ${styles.fullWidth}`}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.cardDot} ${styles.dotGold}`} />
                <Lock size={15} className={styles.sectionIcon} />
                <h3 className={styles.cardTitle}>Change Password</h3>
              </div>

              <div className={styles.passwordGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Current Password *</label>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className={styles.input}
                    />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className={styles.passwordToggle}>
                      {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>New Password *</label>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className={styles.input}
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className={styles.passwordToggle}>
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Confirm Password *</label>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={styles.input}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={styles.passwordToggle}>
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className={styles.fieldError}>Passwords do not match</p>
                  )}
                </div>
              </div>

              <div className={styles.infoBox}>
                <Lock size={14} />
                <p>Password must be at least 8 characters. You'll receive a confirmation email.</p>
              </div>

              <button className={styles.changePassBtn} onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword
                  ? <><Loader2 size={14} className={styles.spinning} /> Changing…</>
                  : <><Lock size={14} /> Change Password</>
                }
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
