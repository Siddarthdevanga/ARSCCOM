"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../register/style.module.css";

const COMPANY_NAME_RE = /^[a-zA-Z0-9\s\-'.&,]+$/;

function companyNameError(v) {
  const s = v.trim();
  if (!s) return "Company name is required";
  if (s.length < 3) return "Minimum 3 characters";
  if (/^\d+$/.test(s)) return "Cannot be numbers only";
  if (!COMPANY_NAME_RE.test(s)) return "Only letters, numbers, spaces and - . ' & , are allowed";
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

function passwordStrength(v) {
  if (!v) return 0;
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(v)) score++;
  return score;
}

const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];

function InlineErr({ msg, show }) {
  if (!show || !msg) return null;
  return (
    <p style={{ color: "#dc2626", fontSize: "0.7rem", fontWeight: 700, marginTop: 4, marginBottom: 0, lineHeight: 1.3 }}>
      {msg}
    </p>
  );
}

export default function CompleteRegistrationPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [formData, setFormData] = useState({
    companyName: "",
    whatsappUrl: "",
    password: "",
    confirmPassword: "",
  });
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "https://www.promeet.zodopt.in";

  /* ── Gate: only razorpay-sourced, incomplete accounts land here ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("company");
      if (!stored) { router.replace("/login"); return; }

      const company = JSON.parse(stored);
      if (company?.registration_complete) { router.replace("/home"); return; }

      setFormData((p) => ({ ...p, companyName: company?.name || "" }));
      setChecking(false);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const fe = {
    companyName: companyNameError(formData.companyName),
    password: passwordError(formData.password),
    confirmPassword: confirmPasswordError(formData.password, formData.confirmPassword),
  };

  const pwStrength = passwordStrength(formData.password);

  const handleInputChange = (field, value) => setFormData((p) => ({ ...p, [field]: value }));
  const handleBlur = (field) => setTouched((p) => ({ ...p, [field]: true }));

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("Logo must be under 3MB"); return; }
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async () => {
    setTouched({ companyName: true, password: true, confirmPassword: true });
    const firstErr = Object.values(fe).find(Boolean);
    if (firstErr) { setError(firstErr); return; }

    setError("");
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append("companyName", formData.companyName.trim());
      payload.append("password", formData.password);
      if (formData.whatsappUrl?.trim()) payload.append("whatsappUrl", formData.whatsappUrl.trim());
      if (logo) payload.append("logo", logo);

      const res = await fetch(`${API_BASE}/api/auth/complete-registration`, {
        method: "POST",
        body: payload,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Failed to complete registration");
        return;
      }

      localStorage.setItem("company", JSON.stringify(data.company));
      router.push("/home");
    } catch (err) {
      console.error("COMPLETE REGISTRATION ERROR:", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>Hai Visitor</div>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Complete Your <span>Registration</span></h1>
          <p className={styles.heroSub}>Your trial is active — just a few details left before you start.</p>
        </section>

        <main className={styles.mainContent}>
          <div className={styles.formCard}>
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

              <div className={styles.sectionHeader}>
                <span className={styles.cardDot} />
                <h3 className={styles.cardTitle}>Company Information</h3>
              </div>

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
                      <small>JPG, PNG or WEBP (Max 3MB, optional)</small>
                    </div>
                  )}
                  <input id="logo" type="file" className={styles.fileInput}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleLogoChange} disabled={loading} />
                </div>
              </div>

              <div className={styles.sectionHeader} style={{ marginTop: 8 }}>
                <span className={`${styles.cardDot} ${styles.dotGold}`} />
                <h3 className={styles.cardTitle}>Set Your Password</h3>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="password">New Password *</label>
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

              {error && <div className={styles.errorBox} role="alert">{error}</div>}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? <><span className={styles.btnSpinner} /> Saving...</> : "Complete Registration"}
              </button>

            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
