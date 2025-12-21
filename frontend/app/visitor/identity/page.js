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
      router.replace("/login");
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
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  /* ================= CAMERA ================= */
  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch {
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
  const validateAll = () => {
    if (!photo) {
      setError("Visitor photo is required");
      return false;
    }

    if (!idType) {
      setError("Please select an ID proof type");
      return false;
    }

    if (!idNumber.trim()) {
      setError("Please enter ID number");
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

      /* Convert photo to File */
      const blob = await fetch(photo).then(r => r.blob());
      const file = new File([blob], "visitor.jpg", {
        type: "image/jpeg"
      });

      const formData = new FormData();

      /* Primary */
      formData.append("name", primary.name);
      formData.append("phone", primary.phone);
      formData.append("email", primary.email || "");

      /* Secondary */
      Object.entries(secondary).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => formData.append(key, v));
        } else {
          formData.append(key, value || "");
        }
      });

      /* Identity */
      formData.append("idType", idType);
      formData.append("idNumber", idNumber);

      /* Photo */
      formData.append("photo", file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/visitors`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: formData
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Visitor creation failed");
      }

      /* Cleanup */
      localStorage.removeItem("visitor_primary");
      localStorage.removeItem("visitor_secondary");

      router.push(`/visitor/pass?visitorCode=${data.visitor.visitorCode}`);
    } catch (err) {
      console.error("GENERATE PASS ERROR:", err);
      setError(err.message || "Failed to generate visitor pass");
    }
  };

  if (!company) return null;

  /* ================= UI ================= */
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.companyName}>{company.name}</div>
        {company.logo && (
          <img
            src={company.logo}
            alt="Company Logo"
            className={styles.companyLogo}
          />
        )}
      </header>

      <div className={styles.card}>
        <h2 className={styles.title}>Visitor Identity Verification</h2>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.mainLayout}>
          {/* CAMERA */}
          <div className={styles.leftPane}>
            <div className={styles.cameraContainer}>
              {!cameraActive && !photo && (
                <button className={styles.startBtn} onClick={startCamera}>
                  Start Camera
                </button>
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

          {/* ID DETAILS */}
          <div className={styles.rightPane}>
            <select
              className={styles.input}
              value={idType}
              onChange={e => setIdType(e.target.value)}
            >
              <option value="">Select ID Proof *</option>
              <option value="aadhaar">Aadhaar</option>
              <option value="pan">PAN</option>
              <option value="passport">Passport</option>
            </select>

            <input
              className={styles.input}
              placeholder="ID Number *"
              value={idNumber}
              onChange={e => setIdNumber(e.target.value)}
            />

            <button className={styles.generateBtn} onClick={handleGeneratePass}>
              Generate Pass
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} hidden />
      </div>
    </div>
  );
}
