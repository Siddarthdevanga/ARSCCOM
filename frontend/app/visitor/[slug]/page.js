"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ===============================================
   CONSTANTS
=============================================== */
const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const FETCH_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const TOTAL_FORM_STEPS = 4; // steps 1-3 are form steps; step 4 is success

/* ===============================================
   FETCH HELPER — PUBLIC (no JWT, with timeout)
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
    try {
      data = await res.json();
    } catch (_) {}

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
   STEP PROGRESS BAR
=============================================== */
const StepProgress = ({ currentStep }) => {
  // Only show progress during form steps (1-3)
  if (currentStep === 0 || currentStep === 4) return null;

  const labels = ["Details", "Info", "Photo"];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.5rem",
        padding: "1rem 1.5rem 0",
      }}
    >
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;
        return (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: isDone
                    ? "#4caf50"
                    : isActive
                    ? "#667eea"
                    : "#ddd",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  transition: "background 0.3s",
                }}
              >
                {isDone ? "✓" : stepNum}
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: isActive ? "#667eea" : isDone ? "#4caf50" : "#999",
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: isDone ? "#4caf50" : "#ddd",
                  marginBottom: 16,
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ===============================================
   COMPONENT
=============================================== */
export default function PublicVisitorRegistration() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  /* ── State ── */
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const [visitorCode, setVisitorCode] = useState("");

  /* ── OTP State ── */
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  /* ── Form Data ── */
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    fromCompany: "",
    department: "",
    designation: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    personToMeet: "",
    purpose: "",
    belongings: [],
    idType: "",
    idNumber: "",
  });

  /* ── Photo / Camera ── */
  const [photo, setPhoto] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null); // store blob directly — no re-fetch needed
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /* ─────────────────────────────────────────────
     LOAD COMPANY INFO
  ───────────────────────────────────────────── */
  useEffect(() => {
    if (!slug) return;

    const fetchCompanyInfo = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await publicFetch(`/api/public/visitor/${slug}/info`);
        setCompany(data.company);
      } catch (err) {
        console.error("[VISITOR_REG] Failed to load company info:", err);
        setError(err.message || "Failed to load registration page");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, [slug]);

  /* ─────────────────────────────────────────────
     RESEND TIMER
  ───────────────────────────────────────────── */
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  /* ─────────────────────────────────────────────
     CAMERA SETUP
  ───────────────────────────────────────────── */
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch((err) => {
        console.error("[CAMERA] Playback error:", err);
      });
    }
  }, [cameraActive, stream]);

  /* ─────────────────────────────────────────────
     STREAM CLEANUP on unmount
  ───────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  /* ─────────────────────────────────────────────
     SCROLL TO TOP on step change
  ───────────────────────────────────────────── */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /* ─────────────────────────────────────────────
     HANDLERS
  ───────────────────────────────────────────── */
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const toggleBelonging = useCallback((item) => {
    setFormData((prev) => ({
      ...prev,
      belongings: prev.belongings.includes(item)
        ? prev.belongings.filter((b) => b !== item)
        : [...prev.belongings, item],
    }));
  }, []);

  const goBack = useCallback(() => {
    setError("");
    setStep((prev) => Math.max(prev - 1, 1));
  }, []);

  /* ─────────────────────────────────────────────
     OTP HANDLERS
     Note: not wrapped in useCallback because they use
     latest state from closure and are called directly
     from event handlers — no child component deps.
  ───────────────────────────────────────────── */
  const handleSendOTP = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Valid email address required");
      return;
    }

    try {
      setError("");
      setSubmitting(true);

      const data = await publicFetch(`/api/public/visitor/${slug}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      setEmail(trimmedEmail);
      setOtpSent(true);
      setResendTimer(data.resendAfter || 30);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    try {
      setError("");
      setSubmitting(true);

      const data = await publicFetch(`/api/public/visitor/${slug}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      setOtpToken(data.otpToken);
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ─────────────────────────────────────────────
     CAMERA HANDLERS
  ───────────────────────────────────────────── */
  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error("[CAMERA] Access error:", err);
      setError(
        "Camera access denied. Please allow camera permissions and try again."
      );
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = 400;
    canvas.height = 300;
    canvas.getContext("2d").drawImage(video, 0, 0, 400, 300);

    // Store preview URL for display
    const previewUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhoto(previewUrl);

    // Store blob directly — avoids re-fetching from memory on submit
    canvas.toBlob(
      (blob) => setPhotoBlob(blob),
      "image/jpeg",
      0.9
    );

    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setPhoto(null);
    setPhotoBlob(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  /* ─────────────────────────────────────────────
     VALIDATION
  ───────────────────────────────────────────── */
  const validateStep = useCallback(() => {
    setError("");

    if (step === 1) {
      if (!formData.name.trim()) {
        setError("Visitor name is required");
        return false;
      }
      if (!formData.phone.trim() || !/^\+?[\d\s\-()]{10,}$/.test(formData.phone)) {
        setError("Valid phone number is required (min 10 digits)");
        return false;
      }
    }

    if (step === 2) {
      if (!formData.personToMeet.trim()) {
        setError("Person to meet is required");
        return false;
      }
    }

    if (step === 3) {
      if (!photo || !photoBlob) {
        setError("Visitor photo is required");
        return false;
      }
    }

    return true;
  }, [step, formData, photo, photoBlob]);

  /* ─────────────────────────────────────────────
     NAVIGATION
  ───────────────────────────────────────────── */
  const handleNext = useCallback(() => {
    if (validateStep()) {
      setError("");
      setStep((prev) => prev + 1);
    }
  }, [validateStep]);

  /* ─────────────────────────────────────────────
     SUBMIT
  ───────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!validateStep()) return;

    try {
      setSubmitting(true);
      setError("");

      // Use the pre-captured blob — no re-fetch from data URL needed
      const file = new File([photoBlob], "visitor.jpg", { type: "image/jpeg" });

      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        fd.append(
          key,
          key === "belongings"
            ? Array.isArray(value) ? value.join(", ") : ""
            : value || ""
        );
      });
      fd.append("photo", file);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      let data;
      try {
        const res = await fetch(`${API}/api/public/visitor/${slug}/register`, {
          method: "POST",
          headers: { "otp-token": otpToken },
          // ✅ No Content-Type header — browser sets multipart/form-data with boundary automatically
          body: fd,
          credentials: "omit",
          signal: controller.signal,
        });

        clearTimeout(timer);
        data = await res.json();

        if (!res.ok || !data.success) {
          // Surface 403 (subscription/trial errors) with their message directly
          throw new Error(data.message || "Registration failed. Please try again.");
        }
      } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
          throw new Error("Upload timed out — please check your connection and try again");
        }
        throw err;
      }

      setVisitorCode(data.visitorCode);
      setStep(4);
    } catch (err) {
      console.error("[VISITOR_REG] Registration error:", err);
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─────────────────────────────────────────────
     WHATSAPP
  ───────────────────────────────────────────── */
  const handleWhatsAppContact = useCallback(() => {
    if (company?.whatsapp_url) {
      window.open(company.whatsapp_url, "_blank", "noopener,noreferrer");
    }
  }, [company]);

  /* ─────────────────────────────────────────────
     RESET
  ───────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setCameraActive(false);
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setStep(0);
    setEmail("");
    setOtp("");
    setOtpSent(false);
    setOtpToken("");
    setResendTimer(0);
    setFormData({
      name: "", phone: "", fromCompany: "", department: "", designation: "",
      address: "", city: "", state: "", postalCode: "", country: "",
      personToMeet: "", purpose: "", belongings: [], idType: "", idNumber: "",
    });
    setPhoto(null);
    setPhotoBlob(null);
    setVisitorCode("");
    setError("");
  }, [stream]);

  /* ─────────────────────────────────────────────
     KEYBOARD HANDLERS
     Defined after send/verify to avoid stale closure.
     Use inline handlers in JSX or define here referencing
     the functions directly (non-memoized is fine here).
  ───────────────────────────────────────────── */
  const handleEmailKeyDown = (e) => {
    if (e.key === "Enter" && !submitting) handleSendOTP();
  };

  const handleOTPKeyDown = (e) => {
    if (e.key === "Enter" && otp.length === 6 && !submitting) handleVerifyOTP();
  };

  /* ─────────────────────────────────────────────
     SHARED HEADER
  ───────────────────────────────────────────── */
  const Header = () => (
    <header className={styles.header}>
      <div className={styles.logoText}>{company?.name}</div>
      {company?.logo_url && (
        <img
          src={company.logo_url}
          alt={`${company.name} logo`}
          className={styles.logo}
        />
      )}
    </header>
  );

  /* ─────────────────────────────────────────────
     LOADING STATE
  ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     FATAL ERROR (no company found)
  ───────────────────────────────────────────── */
  if (!company) {
    return (
      <div className={styles.page}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <h2>⚠️ {error ? "Error" : "Not Found"}</h2>
            <p>{error || "This registration link is invalid or has expired."}</p>
          </div>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className={styles.page}>

      {/* ── STEP 0: EMAIL VERIFICATION ── */}
      {step === 0 && (
        <div className={styles.container}>
          <Header />
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2>Welcome to {company?.name}!</h2>
              <p>Please verify your email to start visitor registration.</p>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            {!otpSent ? (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                    placeholder="your.email@example.com"
                    disabled={submitting}
                    autoComplete="email"
                    autoCapitalize="none"
                  />
                </div>
                <button
                  className={styles.primaryBtn}
                  onClick={handleSendOTP}
                  disabled={submitting || !email.trim()}
                >
                  {submitting ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="otp">Enter 6-Digit Verification Code</label>
                  <input
                    id="otp"
                    className={styles.input}
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={handleOTPKeyDown}
                    placeholder="123456"
                    maxLength={6}
                    disabled={submitting}
                    autoComplete="one-time-code"
                    style={{
                      letterSpacing: "8px",
                      fontSize: "1.25rem",
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  />
                </div>

                <button
                  className={styles.primaryBtn}
                  onClick={handleVerifyOTP}
                  disabled={submitting || otp.length !== 6}
                >
                  {submitting ? "Verifying..." : "Verify Code"}
                </button>

                <button
                  className={styles.secondaryBtn}
                  onClick={handleSendOTP}
                  disabled={resendTimer > 0 || submitting}
                >
                  {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Code"}
                </button>

                <p
                  style={{
                    textAlign: "center",
                    marginTop: "1rem",
                    fontSize: "0.9rem",
                    color: "#666",
                  }}
                >
                  Code sent to: <strong>{email}</strong>
                  <br />
                  <button
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setError("");
                    }}
                    style={{
                      color: "#667eea",
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontSize: "0.85rem",
                      background: "none",
                      border: "none",
                      padding: 0,
                      marginTop: "0.5rem",
                    }}
                  >
                    Change email
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 1: PRIMARY DETAILS ── */}
      {step === 1 && (
        <div className={styles.container}>
          <Header />
          <StepProgress currentStep={step} />
          <main className={styles.card}>
            <h2 className={styles.title}>Primary Details</h2>
            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.formGroup}>
              <label htmlFor="name">Full Name *</label>
              <input
                id="name"
                className={styles.input}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone">Phone Number *</label>
              <input
                id="phone"
                className={styles.input}
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+1234567890"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email Address (Verified ✓)</label>
              <input
                className={styles.input}
                type="email"
                value={email}
                disabled
                readOnly
                style={{
                  background: "#f5f5f5",
                  cursor: "not-allowed",
                  color: "#555",
                }}
              />
            </div>

            <button
              className={styles.primaryBtn}
              onClick={handleNext}
              style={{ width: "100%" }}
            >
              Next →
            </button>
          </main>
        </div>
      )}

      {/* ── STEP 2: SECONDARY DETAILS ── */}
      {step === 2 && (
        <div className={styles.container}>
          <Header />
          <StepProgress currentStep={step} />
          <main className={styles.card}>
            <h2 className={styles.title}>Secondary Details</h2>
            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.gridRow}>
              <input
                className={styles.input}
                name="fromCompany"
                value={formData.fromCompany}
                onChange={handleInputChange}
                placeholder="From Company"
                autoComplete="organization"
              />
              <input
                className={styles.input}
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                placeholder="Department"
              />
              <input
                className={styles.input}
                name="designation"
                value={formData.designation}
                onChange={handleInputChange}
                placeholder="Designation"
              />
            </div>

            <div className={styles.formGroup}>
              <input
                className={styles.input}
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Organization Address"
                autoComplete="street-address"
              />
            </div>

            <div className={styles.gridRow}>
              <input
                className={styles.input}
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="City"
                autoComplete="address-level2"
              />
              <input
                className={styles.input}
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="State"
                autoComplete="address-level1"
              />
              <input
                className={styles.input}
                name="postalCode"
                value={formData.postalCode}
                onChange={handleInputChange}
                placeholder="Postal Code"
                autoComplete="postal-code"
                inputMode="numeric"
              />
            </div>

            <div className={styles.gridRow}>
              <input
                className={styles.input}
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                placeholder="Country"
                autoComplete="country-name"
              />
              <input
                className={styles.input}
                name="personToMeet"
                value={formData.personToMeet}
                onChange={handleInputChange}
                placeholder="Person to Meet *"
              />
              <input
                className={styles.input}
                name="purpose"
                value={formData.purpose}
                onChange={handleInputChange}
                placeholder="Purpose of Visit"
              />
            </div>

            <div className={styles.checkboxGroup}>
              {["Laptop", "Bag", "Documents"].map((item) => (
                <label key={item} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.belongings.includes(item)}
                    onChange={() => toggleBelonging(item)}
                  />
                  {item}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                className={styles.secondaryBtn}
                onClick={goBack}
                style={{ flex: 1 }}
              >
                ← Back
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleNext}
                style={{ flex: 2 }}
              >
                Next →
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ── STEP 3: IDENTITY + PHOTO ── */}
      {step === 3 && (
        <div className={styles.container}>
          <Header />
          <StepProgress currentStep={step} />
          <main className={styles.card}>
            <h2 className={styles.title}>Identity Verification</h2>
            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.cameraContainer}>
              {!cameraActive && !photo && (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={startCamera}
                  style={{ maxWidth: "300px" }}
                >
                  📷 Start Camera
                </button>
              )}

              {cameraActive && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      maxWidth: "400px",
                      borderRadius: "0.75rem",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={capturePhoto}
                    style={{ maxWidth: "300px" }}
                  >
                    📸 Capture Photo
                  </button>
                </>
              )}

              {photo && (
                <>
                  <img
                    src={photo}
                    alt="Captured visitor photo"
                    style={{
                      width: "100%",
                      maxWidth: "400px",
                      borderRadius: "0.75rem",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={retakePhoto}
                    style={{ maxWidth: "300px", marginTop: 0 }}
                  >
                    🔄 Retake Photo
                  </button>
                </>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="idType">ID Proof Type</label>
              <select
                id="idType"
                className={styles.select}
                name="idType"
                value={formData.idType}
                onChange={handleInputChange}
              >
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
              <input
                id="idNumber"
                className={styles.input}
                name="idNumber"
                value={formData.idNumber}
                onChange={handleInputChange}
                placeholder="ID Number (Optional)"
              />
            </div>

            <canvas
              ref={canvasRef}
              style={{ display: "none" }}
              aria-hidden="true"
            />

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                className={styles.secondaryBtn}
                onClick={goBack}
                style={{ flex: 1 }}
                disabled={submitting}
              >
                ← Back
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleSubmit}
                disabled={!photo || !photoBlob || submitting}
                style={{ flex: 2 }}
              >
                {submitting ? "Submitting..." : "✓ Submit"}
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ── STEP 4: SUCCESS ── */}
      {step === 4 && (
        <div className={styles.container}>
          <Header />
          <div className={styles.authCard}>
            <div className={styles.textCenter}>
              <div
                style={{ fontSize: "4rem", marginBottom: "1rem", color: "#4caf50" }}
              >
                ✓
              </div>
              <h2
                style={{
                  color: "#4caf50",
                  marginBottom: "1rem",
                  fontSize: "clamp(1.5rem, 3.5vw, 2rem)",
                  fontWeight: 800,
                }}
              >
                Registration Successful!
              </h2>
              <p
                style={{
                  fontSize: "clamp(0.9rem, 2vw, 1rem)",
                  color: "#666",
                  marginBottom: "2rem",
                  lineHeight: 1.6,
                }}
              >
                Your visitor pass has been sent to your email.
              </p>

              <div className={styles.successMsg}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#2e7d32",
                  }}
                >
                  Visitor ID
                </p>
                <p
                  style={{
                    margin: "0.5rem 0 0 0",
                    fontSize: "clamp(1.5rem, 3.5vw, 2rem)",
                    fontWeight: 800,
                    color: "#667eea",
                    letterSpacing: "2px",
                  }}
                >
                  {visitorCode}
                </p>
              </div>

              <p
                style={{
                  fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)",
                  color: "#888",
                  lineHeight: 1.6,
                  marginBottom: "2rem",
                }}
              >
                Please show this ID at the reception desk.
                <br />
                Check your email <strong>({email})</strong> for the digital pass.
              </p>

              {company?.whatsapp_url?.trim() && (
                <div className={styles.whatsappSection}>
                  <div className={styles.whatsappHeader}>
                    <div className={styles.whatsappIcon}>📱</div>
                    <div>
                      <h3 className={styles.whatsappTitle}>
                        Stay Connected With Us
                      </h3>
                      <p className={styles.whatsappSubtitle}>
                        Contact on WhatsApp
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleWhatsAppContact}
                    className={styles.whatsappBtn}
                    type="button"
                  >
                    <span style={{ fontSize: "1.25rem" }}>💬</span>
                    Contact on WhatsApp
                  </button>
                </div>
              )}

              <button
                className={styles.primaryBtn}
                onClick={handleReset}
                type="button"
              >
                ✓ Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
