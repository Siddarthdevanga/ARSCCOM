"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
    conferenceRooms: "",
    whatsappUrl: "",
    password: "",
    confirmPassword: "",
  });

  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) { setLogo(null); setLogoPreview(null); return; }
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) { setError("Logo must be JPG, PNG, or WEBP format"); e.target.value = ""; return; }
    if (file.size > 3 * 1024 * 1024) { setError("Logo file must be less than 3MB"); e.target.value = ""; return; }
    setLogo(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
    if (error) setError("");
  };

  const validateForm = () => {
    const { companyName, email, phone, conferenceRooms, whatsappUrl, password, confirmPassword } = formData;
    if (!companyName?.trim()) { setError("Company name is required"); return false; }
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setError("Enter a valid email address"); return false; }
    if (!phone?.trim() || phone.trim().length < 8) { setError("Enter a valid phone number (minimum 8 digits)"); return false; }
    const roomCount = Number(conferenceRooms);
    if (!roomCount || roomCount < 1 || roomCount > 100) { setError("Conference rooms must be between 1 and 100"); return false; }
    if (whatsappUrl?.trim()) {
      const whatsappPattern = /^https:\/\/(wa\.me|api\.whatsapp\.com)\/.+/i;
      if (!whatsappPattern.test(whatsappUrl.trim())) { setError("Invalid WhatsApp URL. Must start with https://wa.me/ or https://api.whatsapp.com/"); return false; }
    }
    if (!logo) { setError("Company logo is required"); return false; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return false; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return false; }
    return true;
  };

  const handleRegister = async () => {
    setError(""); setSuccess("");
    if (!validateForm()) return;
    const { companyName, email, phone, conferenceRooms, whatsappUrl, password } = formData;
    const formPayload = new FormData();
    formPayload.append("companyName", companyName.trim());
    formPayload.append("email", email.trim().toLowerCase());
    formPayload.append("phone", phone.trim());
    formPayload.append("conferenceRooms", Number(conferenceRooms));
    formPayload.append("password", password);
    formPayload.append("logo", logo);
    if (whatsappUrl?.trim()) formPayload.append("whatsappUrl", whatsappUrl.trim());
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/register`, { method: "POST", body: formPayload, credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setError(data?.message || "Registration failed"); return; }
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail) localStorage.setItem("regEmail", normalizedEmail);
      setSuccess("Registration successful! Redirecting to login page...");
      setTimeout(() => router.push("/auth/login"), 2500);
    } catch (err) {
      console.error("REGISTRATION ERROR:", err);
      setError("Unable to connect to server. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>PROMEET</div>
        </div>
        <div className={styles.rightHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/auth/login")}>← Back</button>
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Create <span>Account</span></h1>
          <p className={styles.heroSub}>Register your organization to start managing visitors and conference rooms</p>
        </section>

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>
          <div className={styles.formCard}>
            <form
              className={styles.form}
              onSubmit={(e) => { e.preventDefault(); handleRegister(); }}
            >

              {/* ── Company Info ── */}
              <div className={styles.sectionHeader}>
                <span className={styles.cardDot} />
                <h3 className={styles.cardTitle}>Company Information</h3>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="companyName">Company Name *</label>
                <input id="companyName" type="text" className={styles.input} placeholder="Enter your company name" value={formData.companyName} onChange={(e) => handleInputChange("companyName", e.target.value)} disabled={loading} autoComplete="organization" />
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="email">Admin Email *</label>
                  <input id="email" type="email" className={styles.input} placeholder="admin@company.com" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} disabled={loading} autoComplete="email" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="phone">Admin Phone *</label>
                  <input id="phone" type="tel" className={styles.input} placeholder="+1234567890" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} disabled={loading} autoComplete="tel" />
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="whatsappUrl">WhatsApp URL (Optional)</label>
                  <input id="whatsappUrl" type="url" className={styles.input} placeholder="https://wa.me/1234567890" value={formData.whatsappUrl} onChange={(e) => handleInputChange("whatsappUrl", e.target.value)} disabled={loading} autoComplete="url" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="conferenceRooms">Conference Rooms *</label>
                  <input id="conferenceRooms" type="number" className={styles.input} placeholder="Number of rooms" value={formData.conferenceRooms} onChange={(e) => handleInputChange("conferenceRooms", e.target.value)} disabled={loading} min="1" max="100" />
                </div>
              </div>

              {/* ── Logo Upload ── */}
              <div className={styles.sectionHeader} style={{ marginTop: 8 }}>
                <span className={`${styles.cardDot} ${styles.dotGreen}`} />
                <h3 className={styles.cardTitle}>Company Logo</h3>
              </div>

              <div className={styles.field}>
                <div className={styles.logoUpload}>
                  {logoPreview ? (
                    <div className={styles.logoPreview}>
                      <img src={logoPreview} alt="Logo preview" className={styles.logoImg} />
                      <button type="button" className={styles.removeLogo} onClick={() => { setLogo(null); setLogoPreview(null); document.getElementById("logo").value = ""; }} disabled={loading}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className={styles.logoPlaceholder}>
                      <p>Click to upload company logo</p>
                      <small>JPG, PNG or WEBP (Max 3MB)</small>
                    </div>
                  )}
                  <input id="logo" type="file" className={styles.fileInput} accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleLogoChange} disabled={loading} />
                </div>
              </div>

              {/* ── Security ── */}
              <div className={styles.sectionHeader} style={{ marginTop: 8 }}>
                <span className={`${styles.cardDot} ${styles.dotGold}`} />
                <h3 className={styles.cardTitle}>Security</h3>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="password">Password *</label>
                  <input id="password" type="password" className={styles.input} placeholder="Minimum 8 characters" value={formData.password} onChange={(e) => handleInputChange("password", e.target.value)} disabled={loading} autoComplete="new-password" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="confirmPassword">Confirm Password *</label>
                  <input id="confirmPassword" type="password" className={styles.input} placeholder="Re-enter your password" value={formData.confirmPassword} onChange={(e) => handleInputChange("confirmPassword", e.target.value)} disabled={loading} autoComplete="new-password" />
                </div>
              </div>

              {/* ── Messages ── */}
              {error && <div className={styles.errorBox} role="alert">{error}</div>}
              {success && <div className={styles.successBox} role="alert">{success}</div>}

              {/* ── Submit ── */}
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? <><span className={styles.btnSpinner} /> Registering...</> : "Register & Continue"}
              </button>

              {/* ── Footer ── */}
              <div className={styles.formFooter}>
                Already have an account?{" "}
                <button type="button" className={styles.linkBtn} onClick={() => router.push("/auth/login")} disabled={loading}>
                  Login here
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
