"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function PublicVisitorRegistration() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  /* ================= STATE ================= */
  const [step, setStep] = useState(0); // 0: Intro, 1: Primary, 2: Secondary, 3: Identity, 4: Thank You
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState(null);
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");
  const [visitorCode, setVisitorCode] = useState("");

  /* ================= FORM DATA ================= */
  const [primaryData, setPrimaryData] = useState({
    name: "",
    phone: "",
    email: ""
  });

  const [secondaryData, setSecondaryData] = useState({
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
    belongings: []
  });

  const [identityData, setIdentityData] = useState({
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

        setCompany(data.company);
        setQrCode(data.qrCode);
      } catch (err) {
        console.error("Failed to load company info:", err);
        setError("Failed to load registration page");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, [slug]);

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
  const updatePrimary = (key, value) => {
    setPrimaryData(prev => ({ ...prev, [key]: value }));
  };

  const updateSecondary = (key, value) => {
    setSecondaryData(prev => ({ ...prev, [key]: value }));
  };

  const updateIdentity = (key, value) => {
    setIdentityData(prev => ({ ...prev, [key]: value }));
  };

  const toggleBelonging = (item) => {
    setSecondaryData(prev => ({
      ...prev,
      belongings: prev.belongings.includes(item)
        ? prev.belongings.filter(b => b !== item)
        : [...prev.belongings, item]
    }));
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
        if (!primaryData.name.trim()) {
          setError("Name is required");
          return false;
        }
        if (!primaryData.phone.trim() || !/^\+?[\d\s\-()]{10,}$/.test(primaryData.phone)) {
          setError("Valid phone number is required");
          return false;
        }
        if (primaryData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryData.email)) {
          setError("Invalid email address");
          return false;
        }
        break;

      case 2: // Secondary Details
        if (!secondaryData.personToMeet.trim()) {
          setError("Person to meet is required");
          return false;
        }
        break;

      case 3: // Identity
        if (!photo) {
          setError("Photo is required");
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

      const formData = new FormData();
      
      // Primary
      formData.append("name", primaryData.name);
      formData.append("phone", primaryData.phone);
      formData.append("email", primaryData.email || "");

      // Secondary
      Object.entries(secondaryData).forEach(([key, value]) => {
        if (key === "belongings") {
          secondaryData.belongings.forEach(item => formData.append("belongings", item));
        } else {
          formData.append(key, value || "");
        }
      });

      // Identity
      formData.append("idType", identityData.idType);
      formData.append("idNumber", identityData.idNumber);

      // Photo
      formData.append("photo", file);

      const res = await fetch(`/api/public/visitor/${slug}/register`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Registration failed");
      }

      setVisitorCode(data.visitor.visitorCode);
      setStep(4); // Thank you screen
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setSubmitting(false);
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
      {/* ================= STEP 0: INTRO ================= */}
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
              <p>Please register yourself to receive your digital visitor pass.</p>
            </div>

            {qrCode && (
              <div style={{ textAlign: "center", margin: "2rem 0" }}>
                <img 
                  src={qrCode} 
                  alt="QR Code" 
                  style={{ 
                    width: "200px", 
                    height: "200px", 
                    borderRadius: "1rem",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
                  }} 
                />
                <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
                  Scan to register on your phone
                </p>
              </div>
            )}

            <button className={styles.primaryBtn} onClick={() => setStep(1)}>
              Register
            </button>
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
            <h2 className={styles.title}>Visitor Primary Details</h2>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.formGroup}>
              <label>Full Name *</label>
              <input
                className={styles.input}
                type="text"
                value={primaryData.name}
                onChange={(e) => updatePrimary("name", e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Phone Number *</label>
              <input
                className={styles.input}
                type="tel"
                value={primaryData.phone}
                onChange={(e) => updatePrimary("phone", e.target.value)}
                placeholder="+1234567890"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email Address</label>
              <input
                className={styles.input}
                type="email"
                value={primaryData.email}
                onChange={(e) => updatePrimary("email", e.target.value)}
                placeholder="your.email@example.com"
              />
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <button className={styles.secondaryBtn} onClick={() => setStep(0)} style={{ width: "auto", flex: 1 }}>
                ← Back
              </button>
              <button className={styles.primaryBtn} onClick={handleNext} style={{ width: "auto", flex: 1 }}>
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
            <h2 className={styles.title}>Visitor Secondary Details</h2>

            {error && <div className={styles.errorMsg}>{error}</div>}

            {/* Row 1: 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              <input
                className={styles.input}
                value={secondaryData.fromCompany}
                onChange={(e) => updateSecondary("fromCompany", e.target.value)}
                placeholder="From Company"
              />
              <input
                className={styles.input}
                value={secondaryData.department}
                onChange={(e) => updateSecondary("department", e.target.value)}
                placeholder="Department"
              />
              <input
                className={styles.input}
                value={secondaryData.designation}
                onChange={(e) => updateSecondary("designation", e.target.value)}
                placeholder="Designation"
              />
            </div>

            {/* Address */}
            <div className={styles.formGroup}>
              <input
                className={styles.input}
                value={secondaryData.address}
                onChange={(e) => updateSecondary("address", e.target.value)}
                placeholder="Organization Address"
              />
            </div>

            {/* Location: 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              <input
                className={styles.input}
                value={secondaryData.city}
                onChange={(e) => updateSecondary("city", e.target.value)}
                placeholder="City"
              />
              <input
                className={styles.input}
                value={secondaryData.state}
                onChange={(e) => updateSecondary("state", e.target.value)}
                placeholder="State"
              />
              <input
                className={styles.input}
                value={secondaryData.postalCode}
                onChange={(e) => updateSecondary("postalCode", e.target.value)}
                placeholder="Postal Code"
              />
            </div>

            {/* Visit details: 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              <input
                className={styles.input}
                value={secondaryData.country}
                onChange={(e) => updateSecondary("country", e.target.value)}
                placeholder="Country"
              />
              <input
                className={styles.input}
                value={secondaryData.personToMeet}
                onChange={(e) => updateSecondary("personToMeet", e.target.value)}
                placeholder="Person to Meet *"
              />
              <input
                className={styles.input}
                value={secondaryData.purpose}
                onChange={(e) => updateSecondary("purpose", e.target.value)}
                placeholder="Purpose of Visit"
              />
            </div>

            {/* Belongings */}
            <div style={{ display: "flex", gap: "1.5rem", marginBottom: "2rem" }}>
              {["Laptop", "Bag", "Documents"].map(item => (
                <label 
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.95rem"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={secondaryData.belongings.includes(item)}
                    onChange={() => toggleBelonging(item)}
                    style={{ cursor: "pointer", width: "18px", height: "18px" }}
                  />
                  {item}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button className={styles.secondaryBtn} onClick={handleBack} style={{ width: "auto", flex: 1 }}>
                ← Previous
              </button>
              <button className={styles.primaryBtn} onClick={handleNext} style={{ width: "auto", flex: 1 }}>
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
            <h2 className={styles.title}>Visitor Identity Verification</h2>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "2rem", alignItems: "start" }}>
              {/* LEFT: Camera */}
              <div>
                <div style={{ 
                  border: "2px dashed #e0e0e0", 
                  borderRadius: "1rem", 
                  padding: "1rem",
                  minHeight: "350px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1rem"
                }}>
                  {!cameraActive && !photo && (
                    <button 
                      type="button"
                      className={styles.primaryBtn} 
                      onClick={startCamera}
                      style={{ width: "100%" }}
                    >
                      Start Camera
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
                          borderRadius: "0.75rem",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                        }}
                      />
                      <button 
                        type="button"
                        className={styles.primaryBtn} 
                        onClick={capturePhoto}
                        style={{ width: "100%" }}
                      >
                        Capture Photo
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
                          borderRadius: "0.75rem",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                        }}
                      />
                      <button 
                        type="button"
                        className={styles.secondaryBtn} 
                        onClick={() => setPhoto(null)}
                        style={{ width: "100%", marginTop: 0 }}
                      >
                        Retake Photo
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* RIGHT: ID Details */}
              <div>
                <div className={styles.formGroup}>
                  <label>ID Proof Type</label>
                  <select
                    className={styles.select}
                    value={identityData.idType}
                    onChange={(e) => updateIdentity("idType", e.target.value)}
                  >
                    <option value="">Select ID Proof (Optional)</option>
                    <option value="aadhaar">Aadhaar</option>
                    <option value="pan">PAN Card</option>
                    <option value="passport">Passport</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>ID Number</label>
                  <input
                    className={styles.input}
                    value={identityData.idNumber}
                    onChange={(e) => updateIdentity("idNumber", e.target.value)}
                    placeholder="ID Number (Optional)"
                  />
                </div>

                <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                  <button 
                    className={styles.secondaryBtn} 
                    onClick={handleBack}
                    disabled={submitting}
                    style={{ width: "auto", flex: 1, marginTop: 0 }}
                  >
                    ← Previous
                  </button>
                  <button 
                    className={styles.primaryBtn} 
                    onClick={handleSubmit}
                    disabled={!photo || submitting}
                    style={{ width: "auto", flex: 1 }}
                  >
                    {submitting ? "Generating..." : "Generate Pass"}
                  </button>
                </div>
              </div>
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
          </main>
        </div>
      )}

      {/* ================= STEP 4: THANK YOU ================= */}
      {step === 4 && (
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.logoText}>{company?.name}</div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Company Logo" className={styles.logo} />
            )}
          </header>

          <div className={styles.authCard}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "4rem", marginBottom: "1rem", color: "#4caf50" }}>✓</div>
              <h2 style={{ color: "#4caf50", marginBottom: "1rem", fontSize: "1.75rem" }}>
                Registration Successful!
              </h2>
              <p style={{ fontSize: "1rem", color: "#666", marginBottom: "2rem" }}>
                Your visitor pass has been sent to your email.
              </p>

              <div className={styles.successMsg} style={{ textAlign: "center", marginBottom: "2rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>Visitor ID</p>
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "1.75rem", fontWeight: 800", color: "#667eea" }}>
                  {visitorCode}
                </p>
              </div>

              <p style={{ fontSize: "0.9rem", color: "#888", lineHeight: 1.6, marginBottom: "2rem" }}>
                Please show this ID at the reception desk.<br />
                Check your email for the digital pass.
              </p>

              <button 
                className={styles.primaryBtn}
                onClick={() => window.location.href = "/"}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
