"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function VisitorIdentity() {
  const router = useRouter();

  /* ================= COMPANY ================= */
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const rawCompany = localStorage.getItem("company");
    const token = localStorage.getItem("token");

    if (!rawCompany || !token) {
      router.replace("/auth/login");
      return;
    }

    try {
      setCompany(JSON.parse(rawCompany));
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router]);

  /* ================= IDENTITY ================= */
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");

  /* ================= CAMERA ================= */
  const [cameraActive, setCameraActive] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [stream, setStream] = useState(null);

  /* ================= ERROR ================= */
  const [error, setError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /* ================= ATTACH STREAM ================= */
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.play();
    }
  }, [cameraActive, stream]);

  /* ================= CLEANUP ================= */
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  /* ================= CAMERA ================= */
  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch {
      setError("Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
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
  const validateAll = () => {
    if (!photo) {
      setError("Visitor photo is required");
      return false;
    }
    return true;
  };

  /* ================= GENERATE PASS ================= */
  const handleGeneratePass = async () => {
    try {
      setError("");

      const primaryRaw = localStorage.getItem("visitor_primary");
      const secondaryRaw = localStorage.getItem("visitor_secondary");

      if (!primaryRaw || !secondaryRaw) {
        setError("Visitor details are missing. Please restart registration.");
        return;
      }

      const primary = JSON.parse(primaryRaw);
      const secondary = JSON.parse(secondaryRaw);

      if (!validateAll()) return;

      const blob = await fetch(photo).then((r) => r.blob());
      const file = new File([blob], "visitor.jpg", { type: "image/jpeg" });

      const formData = new FormData();

      formData.append("name", primary.name);
      formData.append("phone", primary.phone);
      formData.append("email", primary.email || "");

      Object.entries(secondary).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => formData.append(key, v));
        } else {
          formData.append(key, value || "");
        }
      });

      formData.append("idType", idType);
      formData.append("idNumber", idNumber);
      formData.append("photo", file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Visitor creation failed");

      localStorage.removeItem("visitor_primary");
      localStorage.removeItem("visitor_secondary");

      router.push(`/visitor/pass?visitorCode=${data.visitor.visitorCode}`);
    } catch (err) {
      console.error("GENERATE PASS ERROR:", err);
      setError(err.message || "Failed to generate visitor pass");
    }
  };

  if (!company) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <img
            src={company.logo_url || "/logo.png"}
            alt="Company Logo"
            className={styles.companyLogo}
          />
          <button
            className={styles.backBtn}
            onClick={() => router.push("/visitor/secondary_details")}
          >
            ← Back
          </button>
        </div>
      </header>

      {/* ===== SCROLLABLE BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Identity <span>Verification</span>
          </h1>
          <p className={styles.heroSub}>Capture photo and verify identity</p>

          <div className={styles.steps}>
            <div className={`${styles.step} ${styles.stepDone}`}>
              <span className={styles.stepNum}>✓</span>
              <span className={styles.stepLabel}>Primary</span>
            </div>
            <div className={styles.stepLine} />
            <div className={`${styles.step} ${styles.stepDone}`}>
              <span className={styles.stepNum}>✓</span>
              <span className={styles.stepLabel}>Secondary</span>
            </div>
            <div className={styles.stepLine} />
            <div className={`${styles.step} ${styles.stepActive}`}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepLabel}>Identity</span>
            </div>
          </div>
        </section>

        {/* ===== FORM CARD ===== */}
        <main className={styles.mainContent}>
          <div className={styles.formCard}>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.mainLayout}>

              {/* ── LEFT: Camera ── */}
              <div className={styles.leftPane}>
                <div className={styles.sectionHeader}>
                  <span className={styles.cardDot} />
                  <h3 className={styles.cardTitle}>Visitor Photo</h3>
                </div>

                <div className={styles.cameraContainer}>
                  {!cameraActive && !photo && (
                    <div className={styles.cameraIdle}>
                      <div className={styles.cameraIcon}>📷</div>
                      <p className={styles.cameraIdleText}>Take a visitor photo</p>
                      <button className={styles.startBtn} onClick={startCamera}>
                        Start Camera
                      </button>
                    </div>
                  )}

                  {cameraActive && (
                    <>
                      <video ref={videoRef} className={styles.video} />
                      <button className={styles.captureBtn} onClick={capturePhoto}>
                        Capture Photo
                      </button>
                    </>
                  )}

                  {photo && (
                    <>
                      <img src={photo} className={styles.preview} alt="Visitor" />
                      <button
                        className={styles.retakeBtn}
                        onClick={() => setPhoto(null)}
                      >
                        Retake Photo
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ── RIGHT: ID Details ── */}
              <div className={styles.rightPane}>
                <div className={styles.sectionHeader}>
                  <span className={`${styles.cardDot} ${styles.cardDotGreen}`} />
                  <h3 className={styles.cardTitle}>ID Proof (Optional)</h3>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>ID Type</label>
                  <select
                    className={styles.input}
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                  >
                    <option value="">Select ID Proof</option>
                    <option value="aadhaar">Aadhaar</option>
                    <option value="pan">PAN</option>
                    <option value="passport">Passport</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>ID Number</label>
                  <input
                    className={styles.input}
                    placeholder="Enter ID number"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>

                <button className={styles.generateBtn} onClick={handleGeneratePass}>
                  Generate Pass →
                </button>
              </div>
            </div>

            <canvas ref={canvasRef} hidden />
          </div>
        </main>

      </div>
    </div>
  );
}
