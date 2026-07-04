"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./style.module.css";

/* ── Validators ── */
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

function nameError(v) {
  const s = v.trim();
  if (!s) return "Name is required";
  if (s.length < 2) return "Minimum 2 characters";
  if (/^\d+$/.test(s)) return "Cannot be numbers only";
  if (!/^[a-zA-Z\s\-'.]+$/.test(s)) return "Only letters, spaces and - . ' allowed";
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
  const d = v.replace(/\D/g, "");
  if (!d || d.length !== 10) return "Enter a valid 10-digit number";
  if (!/^[6-9]/.test(d)) return "Number must start with 6, 7, 8 or 9";
  return "";
}

function InlineErr({ msg, show }) {
  if (!show || !msg) return null;
  return <p style={{ color:"#dc2626", fontSize:"0.72rem", fontWeight:700, marginTop:4, marginBottom:0 }}>{msg}</p>;
}

export default function VisitorPrimaryDetails() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [prefillBanner, setPrefillBanner] = useState(false);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    const storedCompany = localStorage.getItem("company");
    if (!storedCompany) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(storedCompany)); } catch {
      localStorage.clear(); router.replace("/auth/login"); return;
    }
    const storedPrimary = localStorage.getItem("visitor_primary");
    if (storedPrimary) {
      try {
        const data = JSON.parse(storedPrimary);
        if (data.name)  setName(data.name);
        if (data.email) setEmail(data.email);
      } catch {}
    }
    const newPhone = localStorage.getItem("visitor_new_phone");
    if (newPhone) { setPhone(newPhone); localStorage.removeItem("visitor_new_phone"); }
    setLoading(false);
  }, [router]);

  const handlePhoneBlur = async () => {
    setTouched(p => ({ ...p, phone: true }));
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10 || !/^[6-9]/.test(digits)) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/returning?phone=${digits}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.found && data.profile) {
        const p = data.profile;
        if (!name.trim()  && p.name)  setName(p.name);
        if (!email.trim() && p.email) setEmail(p.email);
        localStorage.setItem("visitor_returning", JSON.stringify(p));
        setPrefillBanner(true);
      } else {
        localStorage.removeItem("visitor_returning");
        setPrefillBanner(false);
      }
    } catch { localStorage.removeItem("visitor_returning"); setPrefillBanner(false); }
  };

  const handleBlur = (field) => setTouched(p => ({ ...p, [field]: true }));

  const fe = {
    name:  nameError(name),
    phone: phoneError(phone),
    email: emailError(email),
  };

  const borderFor = (field) =>
    touched[field] && fe[field] ? "1px solid #dc2626" : undefined;

  const handleNext = () => {
    setTouched({ name: true, phone: true, email: true });
    const firstErr = Object.values(fe).find(Boolean);
    if (firstErr) { setError(firstErr); return; }
    setError("");
    localStorage.setItem("visitor_primary", JSON.stringify({
      name: name.trim(), phone: `91${phone.replace(/\D/g,"")}`, email: email.trim().toLowerCase(),
    }));
    router.push("/visitor/secondary_details");
  };

  if (loading || !company) {
    return <div className={styles.container}><div className={styles.loading}>Loading…</div></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`} alt="Company Logo"
            className={styles.companyLogo} onError={e => { e.currentTarget.style.display = "none"; }} />
          <button className={styles.backBtn} onClick={() => router.push("/visitor/dashboard")}>← Back</button>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>New <span>Visitor</span></h1>
          <p className={styles.heroSub}>Enter primary details to register a visitor</p>
          <div className={styles.steps}>
            <div className={`${styles.step} ${styles.stepActive}`}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepLabel}>Primary Details</span>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepLabel}>Secondary Details</span>
            </div>
          </div>
        </section>

        <main className={styles.mainContent}>
          <div className={styles.formCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardDot} />
              <h3 className={styles.cardTitle}>Primary Information</h3>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {prefillBanner && (
              <div style={{ background:"#ede9fe", border:"1px solid #c4b5fd", borderRadius:"0.5rem",
                padding:"0.6rem 0.875rem", fontSize:"0.82rem", color:"#5b21b6", marginBottom:"0.75rem" }}>
                ✓ Details pre-filled from last visit — review before proceeding
              </div>
            )}

            {/* Name */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Full Name <span className={styles.req}>*</span></label>
              <input className={styles.input}
                style={{ borderColor: borderFor("name") }}
                value={name}
                onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
                onBlur={() => handleBlur("name")}
                placeholder="Enter visitor's full name"
                autoComplete="off"
              />
              <InlineErr msg={fe.name} show={touched.name} />
            </div>

            <div className={styles.row}>
              {/* Phone */}
              <div className={styles.col}>
                <label className={styles.label}>WhatsApp Number <span className={styles.req}>*</span></label>
                <div style={{ display:"flex", gap:"0.5rem", alignItems:"stretch" }}>
                  <div style={{ padding:"0.75rem 1rem", background:"#f3f4f6",
                    border: touched.phone && fe.phone ? "1px solid #dc2626" : "1px solid #d1d5db",
                    borderRadius:"0.5rem", fontWeight:"600", color:"#374151", fontSize:"0.95rem",
                    display:"flex", alignItems:"center" }}>
                    +91
                  </div>
                  <input className={styles.input}
                    type="tel"
                    value={phone}
                    style={{ flex:1, margin:0, borderColor: borderFor("phone") }}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g,"").slice(0,10)); setPrefillBanner(false); localStorage.removeItem("visitor_returning"); if (error) setError(""); }}
                    onBlur={handlePhoneBlur}
                    placeholder="10-digit number"
                    autoComplete="new-password"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>
                <InlineErr msg={fe.phone} show={touched.phone} />
              </div>

              {/* Email */}
              <div className={styles.col}>
                <label className={styles.label}>Email <span className={styles.req}>*</span></label>
                <input className={styles.input}
                  style={{ borderColor: borderFor("email") }}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                  onBlur={() => handleBlur("email")}
                  placeholder="Email address"
                  autoComplete="off"
                  inputMode="email"
                />
                <InlineErr msg={fe.email} show={touched.email} />
              </div>
            </div>

            <button className={styles.nextBtn} onClick={handleNext}>Next →</button>
          </div>
        </main>
      </div>
    </div>
  );
}
