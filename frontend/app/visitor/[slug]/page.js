"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function PublicVisitorRegistration() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  /* ================= STATE ================= */
  const [step, setStep] = useState(0); // 0: Welcome/OTP, 1: Primary, 2: Secondary, 3: Identity, 4: Thank You
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const [visitorCode, setVisitorCode] = useState("");

  /* ================= OTP STATE ================= */
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  /* ================= FORM DATA ================= */
  const [formData, setFormData] = useState({
    // Primary Details
    name: "",
    phone: "",
    
    // Secondary Details
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
    
    // Identity
    idType: "",
    idNumber: ""
  });

  const [photo, setPhoto] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /* ================= LOAD COMPANY INFO ================= */
  useEffect(() => {
    if (!slug) return;

    const fetchCompanyInfo = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/visitor/${slug}/info`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Invalid registration link");
          return;
        }

        console.log("Company data loaded:", data.company); // Debug log
        setCompany(data.company);
      } catch (err) {
        console.error("Failed to load company info:", err);
        setError("Failed to load registration page");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, [slug]);

  /* ================= RESEND TIMER ================= */
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  /* ================= CLEANUP CAMERA ================= */
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.play();
    }
  }, [cameraActive, stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  /* ================= HANDLERS ================= */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleBelonging = (item) => {
    setFormData(prev => ({
      ...prev,
      belongings: prev.belongings.includes(item)
        ? prev.belongings.filter(b => b !== item)
        : [...prev.belongings, item]
    }));
  };

  /* ================= OTP FUNCTIONS ================= */
  const handleSendOTP = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Valid email address required");
      return;
    }

    try {
      setError("");
      setSubmitting(true);

      const res = await fetch(`/api/public/visitor/${slug}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send OTP");
      }

      setOtpSent(true);
      setResendTimer(data.resendAfter || 30);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter 6-digit OTP");
      return;
    }

    try {
      setError("");
      setSubmitting(true);

      const res = await fetch(`/api/public/visitor/${slug}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Invalid OTP");
      }

      setOtpToken(data.otpToken);
      setStep(1); // Move to primary details
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ================= CAMERA FUNCTIONS ================= */
  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      setError("Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = 400;
    canvas.height = 300;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, 400, 300);

    setPhoto(canvas.toDataURL("image/jpeg"));
    stopCamera();
  };

  /* ================= VALIDATION ================= */
  const validateStep = () => {
    switch (step) {
      case 1: // Primary Details
        if (!formData.name.trim()) {
          setError("Visitor name is required");
          return false;
        }
        if (!formData.phone.trim() || !/^\+?[\d\s\-()]{10,}$/.test(formData.phone)) {
          setError("Valid phone number is required");
          return false;
        }
        break;

      case 2: // Secondary Details
        if (!formData.personToMeet.trim()) {
          setError("Person to meet is required");
          return false;
        }
        break;

      case 3: // Identity
        if (!photo) {
          setError("Visitor photo is required");
          return false;
        }
        break;
    }

    setError("");
    return true;
  };

  /* ================= NAVIGATION ================= */
  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setError("");
    setStep(prev => prev - 1);
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (!validateStep()) return;

    try {
      setSubmitting(true);
      setError("");

      const blob = await fetch(photo).then(r => r.blob());
      const file = new File([blob], "visitor.jpg", { type: "image/jpeg" });

      const formDataToSend = new FormData();
      
      formDataToSend.append("name", formData.name);
      formDataToSend.append("phone", formData.phone);
      formDataToSend.append("fromCompany", formData.fromCompany || "");
      formDataToSend.append("department", formData.department || "");
      formDataToSend.append("designation", formData.designation || "");
      formDataToSend.append("address", formData.address || "");
      formDataToSend.append("city", formData.city || "");
      formDataToSend.append("state", formData.state || "");
      formDataToSend.append("postalCode", formData.postalCode || "");
      formDataToSend.append("country", formData.country || "");
      formDataToSend.append("personToMeet", formData.personToMeet || "");
      formDataToSend.append("purpose", formData.purpose || "");
      formDataToSend.append("belongings", formData.belongings.join(", "));
      formDataToSend.append("idType", formData.idType || "");
      formDataToSend.append("idNumber", formData.idNumber || "");
      formDataToSend.append("photo", file);

      const res = await fetch(`/api/public/visitor/${slug}/register`, {
        method: "POST",
        headers: {
          "otp-token": otpToken
        },
        body: formDataToSend
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Registration failed");
      }

      setVisitorCode(data.visitorCode);
      setStep(4); // Thank you screen
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ================= WHATSAPP HANDLER ================= */
  const handleWhatsAppContact = () => {
    console.log("WhatsApp URL:", company?.whatsapp_url); // Debug log
    if (company?.whatsapp_url) {
      window.open(company.whatsapp_url, '_blank', 'noopener,noreferrer');
    }
  };

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    // Clear all state
    setStep(0);
    setEmail("");
    setOtp("");
    setOtpSent(false);
    setOtpToken("");
    setResendTimer(0);
    setFormData({
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
      idNumber: ""
    });
    setPhoto(null);
    setVisitorCode("");
    setError("");
    
    // Stop camera if active
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  /* ================= ERROR STATE ================= */
  if (error && !company) {
    return (
      <div className={styles.page}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <h2>⚠️ Error</h2>
            <p>{error}</p>
          </div>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  /* ================= RENDER ================= */
  return (
    <div className={styles.page}>
      {/* ================= STEP 0: WELCOME + EMAIL VERIFICATION ================= */}
      {step === 0 && (
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.logoText}>{company?.name}</div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Company Logo" className={styles.logo} />
            )}
          </header>

          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2>Welcome to {company?.name}!</h2>
              <p>Please verify your email to start visitor registration.</p>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            {!otpSent ? (
              <>
                <div className={styles.formGroup}>
                  <label>Email Address *</label>
                  <input
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    disabled={submitting}
                    onKeyPress={(e) => e.key === "Enter" && handleSendOTP()}
                  />
                </div>

                <button 
                  className={styles.primaryBtn} 
                  onClick={handleSendOTP}
                  disabled={submitting}
                >
                  {submitting ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label>Enter 6-Digit Verification Code</label>
                  <input
                    className={styles.input}
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    disabled={submitting}
                    onKeyPress={(e) => e.key === "Enter" && otp.length === 6 && handleVerifyOTP()}
                    style={{ 
                      letterSpacing: "8px", 
                      fontSize: "1.25rem", 
                      textAlign: "center",
                      fontWeight: "700"
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
                  {resendTimer > 0 
                    ? `Resend Code in ${resendTimer}s` 
                    : "Resend Code"}
                </button>

                <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
                  Code sent to: <strong>{email}</strong>
                  <br />
                  <span 
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setError("");
                    }}
                    style={{ 
                      color: "#667eea", 
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontSize: "0.85rem"
                    }}
                  >
                    Change email
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= STEP 1: PRIMARY DETAILS ================= */}
      {step === 1 && (
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.logoText}>{company?.name}</div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Company Logo" className={styles.logo} />
            )}
          </header>

          <main className={styles.card}>
            <h2 className={styles.title}>Primary Details</h2>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.formGroup}>
              <label>Full Name *</label>
              <input
                className={styles.input}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Phone Number *</label>
              <input
                className={styles.input}
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+1234567890"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email Address (Verified)</label>
              <input
                className={styles.input}
                type="email"
                value={email}
                disabled
                style={{ background: "#f5f5f5", cursor: "not-allowed" }}
              />
            </div>

            <div className={styles.buttonRow}>
              <button className={styles.secondaryBtn} onClick={() => setStep(0)}>
                ← Back
              </button>
              <button className={styles.primaryBtn} onClick={handleNext}>
                Next →
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ================= STEP 2: SECONDARY DETAILS ================= */}
      {step === 2 && (
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.logoText}>{company?.name}</div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Company Logo" className={styles.logo} />
            )}
          </header>

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
              />
            </div>

            <div className={styles.gridRow}>
              <input
                className={styles.input}
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="City"
              />
              <input
                className={styles.input}
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="State"
              />
              <input
                className={styles.input}
                name="postalCode"
                value={formData.postalCode}
                onChange={handleInputChange}
                placeholder="Postal Code"
              />
            </div>

            <div className={styles.gridRow}>
              <input
                className={styles.input}
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                placeholder="Country"
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
              {["Laptop", "Bag", "Documents"].map(item => (
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

            <div className={styles.buttonRow}>
              <button className={styles.secondaryBtn} onClick={handleBack}>
                ← Previous
              </button>
              <button className={styles.primaryBtn} onClick={handleNext}>
                Next →
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ================= STEP 3: IDENTITY + PHOTO ================= */}
      {step === 3 && (
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.logoText}>{company?.name}</div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Company Logo" className={styles.logo} />
            )}
          </header>

          <main className={styles.card}>
            <h2 className={styles.title}>Identity Verification</h2>

            {error && <div className={styles.errorMsg}>{error}</div>}

            {/* Camera Section */}
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
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
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
                    alt="Preview" 
                    style={{
                      width: "100%",
                      maxWidth: "400px",
                      borderRadius: "0.75rem",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }}
                  />
                  <button 
                    type="button"
                    className={styles.secondaryBtn} 
                    onClick={() => setPhoto(null)}
                    style={{ maxWidth: "300px", marginTop: 0 }}
                  >
                    🔄 Retake Photo
                  </button>
                </>
              )}
            </div>

            {/* Identity Details Section */}
            <div className={styles.formGroup}>
              <label>ID Proof Type</label>
              <select
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
              <label>ID Number</label>
              <input
                className={styles.input}
                name="idNumber"
                value={formData.idNumber}
                onChange={handleInputChange}
                placeholder="ID Number (Optional)"
              />
            </div>

            {/* Buttons Section */}
            <div className={styles.buttonRow}>
              <button 
                className={styles.secondaryBtn} 
                onClick={handleBack}
                disabled={submitting}
              >
                ← Previous
              </button>
              <button 
                className={styles.primaryBtn} 
                onClick={handleSubmit}
                disabled={!photo || submitting}
              >
                {submitting ? "Submitting..." : "✓ Submit"}
              </button>
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
          </main>
        </div>
      )}

      {/* ================= STEP 4: THANK YOU WITH WHATSAPP ================= */}
      {step === 4 && (
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.logoText}>{company?.name}</div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Company Logo" className={styles.logo} />
            )}
          </header>

          <div className={styles.authCard}>
            <div className={styles.textCenter}>
              <div style={{ fontSize: "4rem", marginBottom: "1rem", color: "#4caf50" }}>✓</div>
              <h2 style={{ color: "#4caf50", marginBottom: "1rem", fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 800 }}>
                Registration Successful!
              </h2>
              <p style={{ fontSize: "clamp(0.9rem, 2vw, 1rem)", color: "#666", marginBottom: "2rem", lineHeight: 1.6 }}>
                Your visitor pass has been sent to your email.
              </p>

              <div className={styles.successMsg}>
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#2e7d32" }}>
                  Visitor ID
                </p>
                <p style={{ 
                  margin: "0.5rem 0 0 0", 
                  fontSize: "clamp(1.5rem, 3.5vw, 2rem)", 
                  fontWeight: "800", 
                  color: "#667eea",
                  letterSpacing: "2px"
                }}>
                  {visitorCode}
                </p>
              </div>

              <p style={{ 
                fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)", 
                color: "#888", 
                lineHeight: 1.6, 
                marginBottom: "2rem" 
              }}>
                Please show this ID at the reception desk.<br />
                Check your email <strong>({email})</strong> for the digital pass.
              </p>

              {/* WhatsApp Contact Section */}
              {company?.whatsapp_url && company.whatsapp_url.trim() !== "" && (
                <div className={styles.whatsappSection}>
                  <div className={styles.whatsappHeader}>
                    <div className={styles.whatsappIcon}>📱</div>
                    <div>
                      <h3 className={styles.whatsappTitle}>Need Help?</h3>
                      <p className={styles.whatsappSubtitle}>Contact us on WhatsApp</p>
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
                onClick={handleLogout}
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
