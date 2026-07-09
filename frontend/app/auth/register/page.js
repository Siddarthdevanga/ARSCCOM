"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ── Disposable email domains ── */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","tempmail.com","throwam.com",
  "yopmail.com","sharklasers.com","guerrillamail.info","guerrillamail.biz",
  "guerrillamail.de","guerrillamail.net","guerrillamail.org","spam4.me",
  "trashmail.com","trashmail.me","trashmail.net","dispostable.com",
  "mailnull.com","spamgourmet.com","maildrop.cc","discard.email",
  "fakeinbox.com","mailnesia.com","spamfree24.org","mytrashmail.com",
  "tempr.email","10minutemail.com","10minutemail.net","minuteinbox.com",
  "throwaway.email","getnada.com","mailtemp.net","tempinbox.com",
]);

/* ── Per-field validators ── */
const COMPANY_NAME_RE = /^[a-zA-Z0-9\s\-'.&,]+$/;

function companyNameError(v) {
  const s = v.trim();
  if (!s) return "Company name is required";
  if (s.length < 3) return "Minimum 3 characters";
  if (/^\d+$/.test(s)) return "Cannot be numbers only";
  if (!COMPANY_NAME_RE.test(s)) return "Only letters, numbers, spaces and - . ' & , are allowed";
  return "";
}

function emailError(v) {
  const s = v.trim().toLowerCase();
  if (!s) return "Email is required";
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s)) return "Enter a valid email address";
  const domain = s.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) return "Disposable email addresses are not allowed";
  return "";
}

function phoneError(v) {
  if (!v) return "Phone number is required";
  if (!/^\d{10}$/.test(v)) return "Enter exactly 10 digits";
  if (!/^[6-9]/.test(v)) return "Number must start with 6, 7, 8 or 9";
  return "";
}

function passwordError(v) {
  if (!v) return "Password is required";
  if (v.length < 8) return "Minimum 8 characters";
  if (!/[A-Z]/.test(v)) return "Must contain at least one uppercase letter";
  if (!/[0-9]/.test(v)) return "Must contain at least one number";
  if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(v)) return "Must contain at least one special character";
  return "";
}

function confirmPasswordError(pw, cpw) {
  if (!cpw) return "Please confirm your password";
  if (pw !== cpw) return "Passwords do not match";
  return "";
}

function conferenceRoomsError(v) {
  if (v === "" || v === null || v === undefined) return "Number of rooms is required";
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Must be a whole number";
  if (n < 1 || n > 100) return "Must be between 1 and 100";
  return "";
}

function passwordStrength(v) {
  if (!v) return 0;
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(v)) score++;
  return score; // 0–4
}

const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];

/* ── Inline error component ── */
function InlineErr({ msg, show }) {
  if (!show || !msg) return null;
  return (
    <p style={{ color: "#dc2626", fontSize: "0.7rem", fontWeight: 700, marginTop: 4, marginBottom: 0, lineHeight: 1.3 }}>
      {msg}
    </p>
  );
}

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
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "https://www.wheelbrand.in";

  /* ── Computed per-field errors ── */
  const fe = {
    companyName:     companyNameError(formData.companyName),
    email:           emailError(formData.email),
    phone:           phoneError(formData.phone),
    password:        passwordError(formData.password),
    confirmPassword: confirmPasswordError(formData.password, formData.confirmPassword),
    conferenceRooms: conferenceRoomsError(formData.conferenceRooms),
  };

  const pwStrength = passwordStrength(formData.password);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleBlur = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const borderFor = (field) =>
    touched[field] && fe[field] ? "1.5px solid #dc2626" : "1.5px solid #ddd2f0";

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
    const allTouched = { companyName: true, email: true, phone: true, conferenceRooms: true, password: true, confirmPassword: true };
    setTouched(allTouched);

    const firstErr = Object.values(fe).find(Boolean);
    if (firstErr) { setError(firstErr); return false; }

    if (formData.whatsappUrl?.trim()) {
      const waRe = /^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com\/channel)\/.+/i;
      if (!waRe.test(formData.whatsappUrl.trim())) {
        setError("Invalid WhatsApp URL. Accepted: https://wa.me/..., https://chat.whatsapp.com/... or https://whatsapp.com/channel/...");
        return false;
      }
    }

    if (!logo) { setError("Company logo is required"); return false; }
    return true;
  };

  const handleRegister = async () => {
    setError(""); setSuccess("");
    if (!validateForm()) return;
    const { companyName, email, phone, conferenceRooms, whatsappUrl, password } = formData;
    const payload = new FormData();
    payload.append("companyName", companyName.trim());
    payload.append("email", email.trim().toLowerCase());
    payload.append("phone", "91" + phone.trim());
    payload.append("conferenceRooms", Number(conferenceRooms));
    payload.append("password", password);
    payload.append("logo", logo);
    if (whatsappUrl?.trim()) payload.append("whatsappUrl", whatsappUrl.trim());
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/register`, { method: "POST", body: payload, credentials: "include" });
      if (res.status === 413) { setError("Logo file is too large. Please upload an image under 1 MB."); return; }
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
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>

              {/* ── Company Info ── */}
              <div className={styles.sectionHeader}>
                <span className={styles.cardDot} />
                <h3 className={styles.cardTitle}>Company Information</h3>
              </div>

              {/* Company Name */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="companyName">Company Name *</label>
                <input
                  id="companyName"
                  type="text"
                  className={styles.input}
                  style={{ borderColor: touched.companyName && fe.companyName ? "#dc2626" : undefined }}
                  placeholder="Enter your company name"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange("companyName", e.target.value)}
                  onBlur={() => handleBlur("companyName")}
                  disabled={loading}
                  autoComplete="organization"
                  maxLength={100}
                />
                <InlineErr msg={fe.companyName} show={touched.companyName} />
              </div>

              <div className={styles.row2}>

                {/* Email */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="email">Admin Email *</label>
                  <input
                    id="email"
                    type="email"
                    className={styles.input}
                    style={{ borderColor: touched.email && fe.email ? "#dc2626" : undefined }}
                    placeholder="admin@company.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    disabled={loading}
                    autoComplete="email"
                  />
                  <InlineErr msg={fe.email} show={touched.email} />
                </div>

                {/* Phone — fixed +91 prefix */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="phone">Admin Phone *</label>
                  <div style={{
                    display: "flex",
                    height: 46,
                    borderRadius: 12,
                    border: touched.phone && fe.phone ? "1.5px solid #dc2626" : "1.5px solid #ddd2f0",
                    overflow: "hidden",
                    background: loading ? "#f3f0fb" : "#fff",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}>
                    <span style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0 12px",
                      background: "#f5f0ff",
                      borderRight: "1.5px solid #ddd2f0",
                      color: "#6200d6",
                      fontWeight: 800,
                      fontSize: 13,
                      fontFamily: "Nunito, sans-serif",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}>+91</span>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        padding: "0 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "Nunito, sans-serif",
                        background: "transparent",
                        color: "#1a0038",
                        opacity: loading ? 0.5 : 1,
                        cursor: loading ? "not-allowed" : "text",
                      }}
                      placeholder="10-digit mobile number"
                      value={formData.phone}
                      maxLength={10}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                        handleInputChange("phone", v);
                      }}
                      onBlur={() => handleBlur("phone")}
                      disabled={loading}
                      autoComplete="tel"
                    />
                  </div>
                  <InlineErr msg={fe.phone} show={touched.phone} />
                </div>

              </div>

              <div className={styles.row2}>

                {/* WhatsApp URL */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="whatsappUrl">WhatsApp URL (Optional)</label>
                  <input
                    id="whatsappUrl"
                    type="url"
                    className={styles.input}
                    placeholder="https://wa.me/1234567890"
                    value={formData.whatsappUrl}
                    onChange={(e) => handleInputChange("whatsappUrl", e.target.value)}
                    disabled={loading}
                    autoComplete="url"
                  />
                </div>

                {/* Conference Rooms */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="conferenceRooms">Conference Rooms *</label>
                  <input
                    id="conferenceRooms"
                    type="number"
                    className={styles.input}
                    style={{ borderColor: touched.conferenceRooms && fe.conferenceRooms ? "#dc2626" : undefined }}
                    placeholder="Number of rooms"
                    value={formData.conferenceRooms}
                    min="1"
                    max="100"
                    step="1"
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      handleInputChange("conferenceRooms", v);
                    }}
                    onBlur={() => handleBlur("conferenceRooms")}
                    disabled={loading}
                  />
                  <InlineErr msg={fe.conferenceRooms} show={touched.conferenceRooms} />
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
                      <button type="button" className={styles.removeLogo}
                        onClick={() => { setLogo(null); setLogoPreview(null); document.getElementById("logo").value = ""; }}
                        disabled={loading}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className={styles.logoPlaceholder}>
                      <p>Click to upload company logo</p>
                      <small>JPG, PNG or WEBP (Max 3MB)</small>
                    </div>
                  )}
                  <input id="logo" type="file" className={styles.fileInput}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleLogoChange} disabled={loading} />
                </div>
              </div>

              {/* ── Security ── */}
              <div className={styles.sectionHeader} style={{ marginTop: 8 }}>
                <span className={`${styles.cardDot} ${styles.dotGold}`} />
                <h3 className={styles.cardTitle}>Security</h3>
              </div>

              <div className={styles.row2}>

                {/* Password */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="password">Password *</label>
                  <input
                    id="password"
                    type="password"
                    className={styles.input}
                    style={{ borderColor: touched.password && fe.password ? "#dc2626" : undefined }}
                    placeholder="Min 8 chars, uppercase, number, symbol"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {/* Strength bar */}
                  {formData.password && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} style={{
                            flex: 1, height: 4, borderRadius: 4,
                            background: i <= pwStrength ? STRENGTH_COLOR[pwStrength] : "#e5e7eb",
                            transition: "background 0.2s",
                          }} />
                        ))}
                      </div>
                      <p style={{ fontSize: "0.68rem", fontWeight: 700, color: STRENGTH_COLOR[pwStrength], marginTop: 3, marginBottom: 0 }}>
                        {STRENGTH_LABEL[pwStrength]}
                      </p>
                    </div>
                  )}
                  <InlineErr msg={fe.password} show={touched.password} />
                </div>

                {/* Confirm Password */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="confirmPassword">Confirm Password *</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className={styles.input}
                    style={{ borderColor: touched.confirmPassword && fe.confirmPassword ? "#dc2626" : undefined }}
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    onBlur={() => handleBlur("confirmPassword")}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <InlineErr msg={fe.confirmPassword} show={touched.confirmPassword} />
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
