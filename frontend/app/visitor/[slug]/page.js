"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ===============================================
   CONSTANTS
=============================================== */
const API               = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const FETCH_TIMEOUT_MS  = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;

/* ===============================================
   FETCH HELPER
=============================================== */
const publicFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API}${url}`, {
      ...options,
      signal: controller.signal,
      credentials: "omit",
    });
    clearTimeout(timer);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || (data && !data.success)) {
      throw new Error(data?.message || `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Request timed out — please check your connection and try again");
    }
    throw err;
  }
};

/* ===============================================
   GREETING HELPER
=============================================== */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
};

/* ===============================================
   EMPLOYEE AUTOCOMPLETE
   ─────────────────────────────────────────────
   ARCHITECTURE: Fully inline — NO portal, NO fixed,
   NO getBoundingClientRect.

   The dropdown renders as a normal block element
   directly after the input inside .acWrapper.
   The wrapper uses position:relative. The dropdown
   uses position:absolute, top:100%, left:0, right:0.

   The ONLY thing that can clip this is overflow:hidden
   on an ancestor. We ensure none of our ancestors
   have overflow:hidden — the .card, .container, and
   .formGroup all use the default overflow:visible.

   On mobile: because it is in normal flow (just
   absolutely positioned), it scrolls with the page
   naturally. No coordinate math needed. No keyboard
   offset issues. No viewport shift problems.

   The dropdown pushes DOWN the page — it does NOT
   overlap siblings. This is intentional: on mobile
   it is far more reliable than overlapping.
   We achieve this by setting position:relative on
   .acWrapper and using a padding-bottom technique
   when the dropdown is open to reserve the space.
=============================================== */
const EmployeeAutocomplete = ({
  slug, value, employeeId, onChange, onSelect, disabled,
}) => {
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [fetching, setFetching] = useState(false);

  const debounceRef  = useRef(null);
  const wrapperRef   = useRef(null);
  const inputRef     = useRef(null);

  /* Close on outside click / touch */
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setFetching(true);
    try {
      const res = await fetch(
        `${API}/api/public/visitor/${slug}/employees?q=${encodeURIComponent(q)}`,
        { credentials: "omit" }
      );
      if (!res.ok) { setResults([]); setOpen(true); return; }
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.employees) ? data.employees
        : Array.isArray(data?.data)      ? data.data
        : [];
      setResults(list);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(true);
    } finally {
      setFetching(false);
    }
  }, [slug]);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (employeeId) onSelect({ name: val, id: null });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (emp) => {
    onSelect({ name: emp.name, id: emp.id });
    setOpen(false);
    setResults([]);
    // Blur input so mobile keyboard closes after selection
    inputRef.current?.blur();
  };

  const handleFocus = () => {
    if (value.trim() && results.length > 0) setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  const initials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : parts[0].slice(0, 2)
    ).toUpperCase();
  };

  const showDropdown = open && (results.length > 0 || (!fetching && value.trim().length > 0));

  return (
    <div
      ref={wrapperRef}
      className={`${styles.acWrapper} ${showDropdown ? styles.acWrapperOpen : ""}`}
    >
      {/* Input row */}
      <div className={styles.acInputRow}>
        <input
          ref={inputRef}
          className={`${styles.input} ${styles.acInput} ${employeeId ? styles.acInputLinked : ""}`}
          type="text"
          name="personToMeet"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search by name..."
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {/* Status icons */}
        {fetching && (
          <span className={styles.acSpinner} aria-hidden="true" />
        )}
        {employeeId && !fetching && (
          <span className={styles.acLinkedTick}>✓</span>
        )}
        {!employeeId && !fetching && value.trim() && (
          <button
            type="button"
            className={styles.acClearBtn}
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
              onSelect({ name: "", id: null });
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear"
          >✕</button>
        )}
      </div>

      {/* Inline dropdown — renders in normal flow, no portal */}
      {showDropdown && (
        <div className={styles.acDropdown} role="listbox" aria-label="Employee suggestions">
          {results.length > 0 ? (
            results.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className={`${styles.acItem} ${employeeId === emp.id ? styles.acItemSelected : ""}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(emp); }}
                onTouchEnd={(e)  => { e.preventDefault(); handleSelect(emp); }}
                role="option"
                aria-selected={employeeId === emp.id}
              >
                {/* Avatar */}
                <span className={styles.acAvatar} aria-hidden="true">
                  {initials(emp.name)}
                </span>

                {/* Name + dept */}
                <span className={styles.acInfo}>
                  <span className={styles.acName}>{emp.name}</span>
                  {emp.department && (
                    <span className={styles.acDept}>{emp.department}</span>
                  )}
                </span>

                {/* Selected tick */}
                {employeeId === emp.id && (
                  <span className={styles.acTick} aria-label="Selected">✓</span>
                )}
              </button>
            ))
          ) : (
            <div className={styles.acEmpty}>
              <span className={styles.acEmptyIcon}>🔍</span>
              <span>No employees found for &quot;{value}&quot;</span>
              <span className={styles.acEmptyHint}>Your text will still be saved</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ===============================================
   STEP PROGRESS BAR
=============================================== */
const StepProgress = ({ currentStep }) => {
  if (currentStep === 0 || currentStep === 4) return null;
  const labels = ["Details", "Info", "Photo"];
  return (
    <div className={styles.stepProgress}>
      {labels.map((label, i) => {
        const stepNum    = i + 1;
        const isActive   = currentStep === stepNum;
        const isDone     = currentStep > stepNum;
        const circleClass = isDone ? styles.stepCircleDone
          : isActive ? styles.stepCircleActive : styles.stepCircleIdle;
        const labelClass = isDone ? styles.stepLabelDone
          : isActive ? styles.stepLabelActive : styles.stepLabelIdle;
        return (
          <div key={label} className={styles.stepItem}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
              <div className={`${styles.stepCircle} ${circleClass}`}>
                {isDone ? "✓" : stepNum}
              </div>
              <span className={`${styles.stepLabel} ${labelClass}`}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`${styles.stepConnector} ${
                isDone ? styles.stepConnectorDone : styles.stepConnectorIdle
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ===============================================
   NAVBAR
=============================================== */
const Navbar = ({ company }) => (
  <header className={styles.header}>
    <div className={styles.headerLeft}>
      {company?.logo_url && (
        <img src={company.logo_url} alt={`${company.name} logo`} className={styles.logo} />
      )}
      <span className={styles.logoText}>{company?.name}</span>
    </div>
    <span className={styles.headerBadge}>Visitor Registration</span>
  </header>
);

/* ===============================================
   HERO BANNER
=============================================== */
const HeroBanner = ({ company }) => (
  <div className={styles.heroBanner}>
    <div className={styles.heroBannerContent}>
      <div className={styles.heroBannerGreeting}>
        <span className={styles.heroBannerDot} />
        {getGreeting()}
      </div>
      <h2 className={styles.heroBannerTitle}>
        Welcome to <span>{company?.name}</span>
      </h2>
      <p className={styles.heroBannerSub}>
        Verify your email to complete visitor registration
      </p>
    </div>
  </div>
);

/* ===============================================
   PAGE COMPONENT
=============================================== */
export default function PublicVisitorRegistration() {
  const params = useParams();
  const router = useRouter();
  const slug   = params?.slug;

  const [step,        setStep]        = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [company,     setCompany]     = useState(null);
  const [error,       setError]       = useState("");
  const [visitorCode, setVisitorCode] = useState("");

  const [email,       setEmail]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [otpSent,     setOtpSent]     = useState(false);
  const [otpToken,    setOtpToken]    = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  const [formData, setFormData] = useState({
    name: "", phone: "", fromCompany: "", department: "", designation: "",
    address: "", city: "", state: "", postalCode: "", country: "",
    personToMeet: "", purpose: "", belongings: [], idType: "", idNumber: "",
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [photo,        setPhoto]        = useState(null);
  const [photoBlob,    setPhotoBlob]    = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream,       setStream]       = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true); setError("");
        const data = await publicFetch(`/api/public/visitor/${slug}/info`);
        setCompany(data.company);
      } catch (err) {
        setError(err.message || "Failed to load registration page");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject   = stream;
      videoRef.current.muted       = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, stream]);

  useEffect(() => () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }, [stream]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  }, []);

  const handlePersonToMeetChange = useCallback((val) => {
    setFormData((p) => ({ ...p, personToMeet: val }));
  }, []);

  const handleEmployeeSelect = useCallback(({ name, id }) => {
    setFormData((p) => ({ ...p, personToMeet: name }));
    setSelectedEmployeeId(id);
  }, []);

  const toggleBelonging = useCallback((item) => {
    setFormData((p) => ({
      ...p,
      belongings: p.belongings.includes(item)
        ? p.belongings.filter((b) => b !== item)
        : [...p.belongings, item],
    }));
  }, []);

  const goBack = useCallback(() => { setError(""); setStep((p) => Math.max(p - 1, 1)); }, []);

  const handleSendOTP = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Valid email address required"); return;
    }
    try {
      setError(""); setSubmitting(true);
      const data = await publicFetch(`/api/public/visitor/${slug}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      setEmail(trimmedEmail);
      setOtpSent(true);
      setResendTimer(data.resendAfter || 30);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) { setError("Please enter the 6-digit code"); return; }
    try {
      setError(""); setSubmitting(true);
      const data = await publicFetch(`/api/public/visitor/${slug}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      setOtpToken(data.otpToken);
      setStep(1);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const startCamera = async () => {
    setError("");
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(ms); setCameraActive(true);
    } catch {
      setError("Camera access denied. Please allow camera permissions and try again.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setCameraActive(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width = 400; canvas.height = 300;
    canvas.getContext("2d").drawImage(video, 0, 0, 400, 300);
    setPhoto(canvas.toDataURL("image/jpeg", 0.9));
    canvas.toBlob((blob) => setPhotoBlob(blob), "image/jpeg", 0.9);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setPhoto(null); setPhotoBlob(null);
    canvasRef.current?.getContext("2d")
      .clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  const validateStep = useCallback(() => {
    setError("");
    if (step === 1) {
      if (!formData.name.trim())  { setError("Visitor name is required"); return false; }
      if (!formData.phone.trim() || !/^\+?[\d\s\-()]{10,}$/.test(formData.phone)) {
        setError("Valid phone number required (min 10 digits)"); return false;
      }
    }
    if (step === 2 && !formData.personToMeet.trim()) {
      setError("Person to meet is required"); return false;
    }
    if (step === 3 && (!photo || !photoBlob)) {
      setError("Visitor photo is required"); return false;
    }
    return true;
  }, [step, formData, photo, photoBlob]);

  const handleNext = useCallback(() => {
    if (validateStep()) { setError(""); setStep((p) => p + 1); }
  }, [validateStep]);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    try {
      setSubmitting(true); setError("");
      const fd = new FormData();
      fd.append("photo", new File([photoBlob], "visitor.jpg", { type: "image/jpeg" }));
      Object.entries(formData).forEach(([k, v]) =>
        fd.append(k, k === "belongings" ? (Array.isArray(v) ? v.join(", ") : "") : v || "")
      );
      if (selectedEmployeeId) fd.append("employeeId", String(selectedEmployeeId));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      let data;
      try {
        const res = await fetch(`${API}/api/public/visitor/${slug}/register`, {
          method: "POST", headers: { "otp-token": otpToken },
          body: fd, credentials: "omit", signal: controller.signal,
        });
        clearTimeout(timer);
        data = await res.json();
        if (!res.ok || !data.success)
          throw new Error(data.message || "Registration failed. Please try again.");
      } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError")
          throw new Error("Upload timed out — please check your connection and try again");
        throw err;
      }
      setVisitorCode(data.visitorCode);
      setStep(4);
    } catch (err) {
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null); setCameraActive(false);
    canvasRef.current?.getContext("2d")
      .clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setStep(0); setEmail(""); setOtp(""); setOtpSent(false);
    setOtpToken(""); setResendTimer(0);
    setFormData({
      name: "", phone: "", fromCompany: "", department: "", designation: "",
      address: "", city: "", state: "", postalCode: "", country: "",
      personToMeet: "", purpose: "", belongings: [], idType: "", idNumber: "",
    });
    setSelectedEmployeeId(null);
    setPhoto(null); setPhotoBlob(null); setVisitorCode(""); setError("");
  }, [stream]);

  if (loading) return (
    <div className={styles.loadingContainer}><div className={styles.spinner} /></div>
  );

  if (!company) return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <h2>⚠️ {error ? "Error" : "Not Found"}</h2>
            <p>{error || "This registration link is invalid or has expired."}</p>
          </div>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>Go Home</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>

      {/* ── STEP 0: EMAIL ── */}
      {step === 0 && (
        <>
          <Navbar company={company} />
          <HeroBanner company={company} />
          <div className={styles.container}>
            <div className={styles.authCard}>
              <p className={styles.authSubtitle}>
                Enter your email to receive a verification code
              </p>
              {error && <div className={styles.errorMsg}>{error}</div>}
              {!otpSent ? (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="email">Email Address *</label>
                    <input id="email" className={styles.input} type="email"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !submitting && handleSendOTP()}
                      placeholder="your.email@example.com"
                      disabled={submitting} autoComplete="email" autoCapitalize="none" />
                  </div>
                  <button className={styles.primaryBtn} onClick={handleSendOTP}
                    disabled={submitting || !email.trim()}>
                    {submitting ? "Sending..." : "Send Verification Code"}
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="otp">6-Digit Verification Code</label>
                    <input id="otp" className={styles.otpInput} type="text"
                      inputMode="numeric" value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && !submitting && handleVerifyOTP()}
                      placeholder="• • • • • •" maxLength={6} disabled={submitting}
                      autoComplete="one-time-code" />
                  </div>
                  <button className={styles.primaryBtn} onClick={handleVerifyOTP}
                    disabled={submitting || otp.length !== 6}>
                    {submitting ? "Verifying..." : "Verify Code"}
                  </button>
                  <button className={styles.secondaryBtn} onClick={handleSendOTP}
                    disabled={resendTimer > 0 || submitting}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                  </button>
                  <p className={styles.otpMeta}>
                    Sent to: <strong>{email}</strong><br />
                    <button className={styles.textBtn}
                      onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}>
                      Change email
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── STEP 1: PRIMARY DETAILS ── */}
      {step === 1 && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <StepProgress currentStep={step} />
            <main className={styles.card}>
              <h2 className={styles.title}>Primary Details</h2>
              {error && <div className={styles.errorMsg}>{error}</div>}
              <div className={styles.formGroup}>
                <label htmlFor="name">Full Name *</label>
                <input id="name" className={styles.input} type="text" name="name"
                  value={formData.name} onChange={handleInputChange}
                  placeholder="Enter your full name" autoComplete="name" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="phone">Phone Number *</label>
                <input id="phone" className={styles.input} type="tel" name="phone"
                  value={formData.phone} onChange={handleInputChange}
                  placeholder="+1234567890" autoComplete="tel" inputMode="tel" />
              </div>
              <div className={styles.formGroup}>
                <label>Email (Verified ✓)</label>
                <input className={styles.input} type="email" value={email} disabled readOnly />
              </div>
              <button className={styles.primaryBtn} onClick={handleNext}>Next →</button>
            </main>
          </div>
        </>
      )}

      {/* ── STEP 2: SECONDARY DETAILS ── */}
      {step === 2 && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <StepProgress currentStep={step} />
            <main className={styles.card}>
              <h2 className={styles.title}>Secondary Details</h2>
              {error && <div className={styles.errorMsg}>{error}</div>}

              <div className={styles.gridRow}>
                <input className={styles.input} name="fromCompany"
                  value={formData.fromCompany} onChange={handleInputChange}
                  placeholder="From Company" autoComplete="organization" />
                <input className={styles.input} name="department"
                  value={formData.department} onChange={handleInputChange}
                  placeholder="Department" />
                <input className={styles.input} name="designation"
                  value={formData.designation} onChange={handleInputChange}
                  placeholder="Designation" />
              </div>

              <input className={styles.input} style={{ marginBottom: "0.75rem" }}
                name="address" value={formData.address} onChange={handleInputChange}
                placeholder="Organization Address" autoComplete="street-address" />

              <div className={styles.gridRow}>
                <input className={styles.input} name="city"
                  value={formData.city} onChange={handleInputChange}
                  placeholder="City" autoComplete="address-level2" />
                <input className={styles.input} name="state"
                  value={formData.state} onChange={handleInputChange}
                  placeholder="State" autoComplete="address-level1" />
                <input className={styles.input} name="postalCode"
                  value={formData.postalCode} onChange={handleInputChange}
                  placeholder="Postal Code" inputMode="numeric" />
              </div>

              <div className={styles.gridRow2}>
                <input className={styles.input} name="country"
                  value={formData.country} onChange={handleInputChange}
                  placeholder="Country" autoComplete="country-name" />
                <input className={styles.input} name="purpose"
                  value={formData.purpose} onChange={handleInputChange}
                  placeholder="Purpose of Visit" />
              </div>

              {/* ── Person to Meet — full width with inline dropdown ── */}
              <div className={styles.meetSection}>
                <label className={styles.meetLabel}>
                  <span>👤</span> Person to Meet *
                </label>
                <EmployeeAutocomplete
                  slug={slug}
                  value={formData.personToMeet}
                  employeeId={selectedEmployeeId}
                  onChange={handlePersonToMeetChange}
                  onSelect={handleEmployeeSelect}
                  disabled={submitting}
                />
                {selectedEmployeeId && (
                  <p className={styles.employeeLinkedHint}>
                    ✓ Linked to employee record
                  </p>
                )}
              </div>

              <div className={styles.checkboxGroup}>
                {["Laptop", "Bag", "Documents"].map((item) => (
                  <label key={item} className={styles.checkboxLabel}>
                    <input type="checkbox"
                      checked={formData.belongings.includes(item)}
                      onChange={() => toggleBelonging(item)} />
                    {item}
                  </label>
                ))}
              </div>

              <div className={styles.btnRow}>
                <button className={styles.secondaryBtn} onClick={goBack}>← Back</button>
                <button className={styles.primaryBtn} onClick={handleNext}>Next →</button>
              </div>
            </main>
          </div>
        </>
      )}

      {/* ── STEP 3: PHOTO + ID ── */}
      {step === 3 && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <StepProgress currentStep={step} />
            <main className={styles.card}>
              <h2 className={styles.title}>Identity Verification</h2>
              {error && <div className={styles.errorMsg}>{error}</div>}

              <div className={styles.cameraContainer}>
                {!cameraActive && !photo && (
                  <button type="button" className={styles.primaryBtn}
                    onClick={startCamera} style={{ maxWidth: "280px" }}>
                    📷 Start Camera
                  </button>
                )}
                {cameraActive && (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className={styles.cameraVideo} />
                    <button type="button" className={styles.primaryBtn}
                      onClick={capturePhoto} style={{ maxWidth: "280px" }}>
                      📸 Capture Photo
                    </button>
                  </>
                )}
                {photo && (
                  <>
                    <img src={photo} alt="Captured visitor" className={styles.cameraPhoto} />
                    <button type="button" className={styles.secondaryBtn}
                      onClick={retakePhoto} style={{ maxWidth: "280px", marginTop: 0 }}>
                      🔄 Retake Photo
                    </button>
                  </>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="idType">ID Proof Type</label>
                <select id="idType" className={styles.select}
                  name="idType" value={formData.idType} onChange={handleInputChange}>
                  <option value="">Select ID Proof (Optional)</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="pan">PAN Card</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="idNumber">ID Number</label>
                <input id="idNumber" className={styles.input} name="idNumber"
                  value={formData.idNumber} onChange={handleInputChange}
                  placeholder="ID Number (Optional)" />
              </div>

              <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />

              <div className={styles.btnRow}>
                <button className={styles.secondaryBtn} onClick={goBack}
                  disabled={submitting}>← Back</button>
                <button className={styles.primaryBtn} onClick={handleSubmit}
                  disabled={!photo || !photoBlob || submitting}>
                  {submitting ? "Submitting..." : "✓ Submit"}
                </button>
              </div>
            </main>
          </div>
        </>
      )}

      {/* ── STEP 4: SUCCESS ── */}
      {step === 4 && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <div className={styles.authCard}>
              <div className={styles.textCenter}>
                <div className={styles.successIconWrap}>✓</div>
                <h2 className={styles.successHeading}>Registration Successful!</h2>
                <p className={styles.successSub}>Your visitor pass has been sent to your email.</p>
                <div className={styles.successMsg}>
                  <p className={styles.visitorIdLabel}>Visitor ID</p>
                  <p className={styles.visitorIdCode}>{visitorCode}</p>
                </div>
                <p className={styles.successNote}>
                  Please show this ID at the reception desk.<br />
                  Check your email <strong>({email})</strong> for the digital pass.
                </p>
                {company?.whatsapp_url?.trim() && (
                  <div className={styles.whatsappSection}>
                    <div className={styles.whatsappHeader}>
                      <div className={styles.whatsappIcon}>📱</div>
                      <div>
                        <h3 className={styles.whatsappTitle}>Stay Connected</h3>
                        <p className={styles.whatsappSubtitle}>Contact on WhatsApp</p>
                      </div>
                    </div>
                    <button
                      onClick={() => company?.whatsapp_url && window.open(company.whatsapp_url, "_blank", "noopener,noreferrer")}
                      className={styles.whatsappBtn} type="button">
                      <span>💬</span> Contact on WhatsApp
                    </button>
                  </div>
                )}
                <button className={styles.primaryBtn} onClick={handleReset}>✓ Done</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
