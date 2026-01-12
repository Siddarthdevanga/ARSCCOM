"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   READ MYSQL / ISO TIME AS-IS (No timezone conversion)
====================================================== */
const formatISTTime = (value) => {
  if (!value) return "-";
  try {
    const str = String(value).trim();
    let timePart;

    if (str.includes(" ")) timePart = str.split(" ")[1];
    if (str.includes("T")) timePart = str.split("T")[1];

    if (!timePart) return "-";

    let [h, m] = timePart.split(":");
    h = parseInt(h, 10);
    if (isNaN(h)) return "-";

    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;

    return `${h}:${m} ${suffix}`;
  } catch {
    return "-";
  }
};

export default function VisitorDashboard() {
  const router = useRouter();
  const qrCanvasRef = useRef(null);

  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState({ today: 0, inside: 0, out: 0 });
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [checkedOutVisitors, setCheckedOutVisitors] = useState([]);
  const [checkingOut, setCheckingOut] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  
  /* ================= SLIDING PANEL STATE ================= */
  const [panelOpen, setPanelOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [loadingQR, setLoadingQR] = useState(false);

  /* ================= FETCH DASHBOARD ================= */
  const loadDashboard = useCallback(async (token) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      setStats(data?.stats || { today: 0, inside: 0, out: 0 });
      setActiveVisitors(data?.activeVisitors || []);
      setCheckedOutVisitors(data?.checkedOutVisitors || []);
      setPlan(data?.plan || null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ================= LOAD QR CODE ================= */
  const loadQRCode = useCallback(async (companySlug) => {
    if (!companySlug) return;
    
    try {
      setLoadingQR(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/public/visitor/${companySlug}/info`
      );

      if (!res.ok) return;

      const data = await res.json();
      if (data.success) {
        setPublicUrl(data.publicUrl);
        setQrCodeImage(data.qrCode);
      }
    } catch (err) {
      console.error("QR Code fetch error:", err);
    } finally {
      setLoadingQR(false);
    }
  }, []);

  /* ================= AUTH + INIT ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    try {
      const companyData = JSON.parse(storedCompany);
      setCompany(companyData);
      loadDashboard(token);
      loadQRCode(companyData.slug);
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [router, loadDashboard, loadQRCode]);

  /* ================= CHECKOUT ================= */
  const handleCheckout = async (visitorCode) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setCheckingOut(visitorCode);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/${visitorCode}/checkout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.ok) await loadDashboard(token);
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setCheckingOut(null);
    }
  };

  /* ================= DOWNLOAD PDF ================= */
  const downloadPDF = async () => {
    if (!qrCodeImage || !company) return;

    try {
      // Create a canvas to generate PDF content
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 1000);

      // Header background
      ctx.fillStyle = '#667eea';
      ctx.fillRect(0, 0, 800, 120);

      // Company Logo (if available)
      if (company.logo_url) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          logoImg.src = company.logo_url;
          await new Promise((resolve) => {
            logoImg.onload = () => {
              ctx.drawImage(logoImg, 50, 30, 80, 60);
              resolve();
            };
            logoImg.onerror = resolve;
          });
        } catch (e) {
          console.log('Logo load error:', e);
        }
      }

      // Company Name in Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.fillText(company.name, 160, 70);

      // Title
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('Visitor Registration', 50, 180);

      // Public URL Label
      ctx.font = '18px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('Scan QR Code or Visit:', 50, 230);

      // Public URL
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#667eea';
      ctx.fillText(publicUrl, 50, 260);

      // QR Code
      const qrImg = new Image();
      qrImg.src = qrCodeImage;
      await new Promise((resolve) => {
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 250, 300, 300, 300);
          resolve();
        };
      });

      // Instructions
      ctx.font = '16px Arial';
      ctx.fillStyle = '#333333';
      ctx.fillText('Instructions for Visitors:', 50, 650);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('1. Scan the QR code with your phone camera', 70, 685);
      ctx.fillText('2. Or visit the URL above in your browser', 70, 715);
      ctx.fillText('3. Enter your email to receive verification code', 70, 745);
      ctx.fillText('4. Complete the registration form', 70, 775);
      ctx.fillText('5. Capture your photo', 70, 805);
      ctx.fillText('6. Receive your digital visitor pass via email', 70, 835);

      // Footer background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 900, 800, 100);

      // Footer text
      ctx.fillStyle = '#667eea';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('PROMEET', 320, 940);
      
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.fillText('Visitor and Conference Booking Platform', 240, 970);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${company.slug}-visitor-registration.png`;
        link.click();
        URL.revokeObjectURL(url);
      });

    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  /* ================= COPY URL ================= */
  const copyURL = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    alert('URL copied to clipboard!');
  };

  /* ================= PLAN HELPERS ================= */
  const isTrial = plan?.plan === "TRIAL";
  const limitReached = isTrial && plan?.remaining === 0;

  const planPercentage = useMemo(() => {
    if (!plan?.limit || plan.limit === 0) return 0;
    return Math.min(100, Math.round((plan.used / plan.limit) * 100));
  }, [plan]);

  const planBarColor =
    planPercentage >= 90 ? "#ff1744" :
    planPercentage >= 70 ? "#ff9800" :
    "#00c853";

  /* ================= LOADING ================= */
  if (loading || !company) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ================= SLIDING PANEL ================= */}
      <div className={`${styles.slidingPanel} ${panelOpen ? styles.panelOpen : ''}`}>
        <div className={styles.panelHeader}>
          <h3>Public Registration</h3>
          <button 
            className={styles.panelCloseBtn}
            onClick={() => setPanelOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className={styles.panelContent}>
          {loadingQR ? (
            <div className={styles.panelLoading}>
              <div className={styles.spinner} />
              <p>Loading QR Code...</p>
            </div>
          ) : (
            <>
              {/* QR Code */}
              {qrCodeImage && (
                <div className={styles.qrSection}>
                  <img 
                    src={qrCodeImage} 
                    alt="QR Code" 
                    className={styles.qrImage}
                  />
                  <p className={styles.qrHint}>Scan to register</p>
                </div>
              )}

              {/* Public URL */}
              {publicUrl && (
                <div className={styles.urlSection}>
                  <label>Public Registration URL</label>
                  <div className={styles.urlBox}>
                    <input 
                      type="text" 
                      value={publicUrl} 
                      readOnly 
                      className={styles.urlInput}
                    />
                    <button 
                      className={styles.copyBtn}
                      onClick={copyURL}
                      title="Copy URL"
                    >
                      📋
                    </button>
                  </div>
                </div>
              )}

              {/* Download Button */}
              <button 
                className={styles.downloadPdfBtn}
                onClick={downloadPDF}
              >
                📄 Download as Image
              </button>

              {/* Instructions */}
              <div className={styles.panelInstructions}>
                <h4>How to use:</h4>
                <ol>
                  <li>Share QR code or URL with visitors</li>
                  <li>Visitors scan QR or visit URL</li>
                  <li>Complete online registration</li>
                  <li>Receive digital pass via email</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= PANEL TOGGLE BUTTON ================= */}
      {!panelOpen && (
        <button 
          className={styles.panelToggleBtn}
          onClick={() => setPanelOpen(true)}
          title="Show Public Registration"
        >
          📱 QR Code
        </button>
      )}

      {/* ================= OVERLAY ================= */}
      {panelOpen && (
        <div 
          className={styles.panelOverlay}
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.logoText}>
          {company.name}
        </div>

        <div className={styles.rightHeader}>
          <img
            src={company.logo_url || "/logo.png"}
            alt="Company Logo"
            className={styles.companyLogo}
          />

          <button
            className={styles.backBtn}
            onClick={() => router.push("/home")}
          >
            ← Back
          </button>
        </div>
      </header>

      {/* ================= TITLE ================= */}
      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>Visitor Dashboard</h1>

        <button
          className={styles.newBtn}
          disabled={limitReached}
          style={{
            opacity: limitReached ? 0.5 : 1,
            cursor: limitReached ? "not-allowed" : "pointer"
          }}
          onClick={() => router.push("/visitor/primary_details")}
        >
          + New Visitor
        </button>
      </div>

      {/* ================= UPGRADE MESSAGE ================= */}
      {limitReached && (
        <div className={styles.upgradeMsg}>
          Trial limit reached. Please upgrade your plan to register more visitors.
        </div>
      )}

      {/* ================= PLAN BAR ================= */}
      {isTrial && (
        <section className={styles.planBarWrapper}>
          <div className={styles.planHeader}>
            <span className={styles.planName}>Trial Plan</span>
            <span className={styles.planRemaining}>
              {plan.remaining} Visitors Remaining
            </span>
          </div>

          <div className={styles.planBarBg}>
            <div
              className={styles.planBarFill}
              style={{
                width: `${planPercentage}%`,
                background: planBarColor
              }}
            />
          </div>

          <div className={styles.planFooter}>
            <span>{plan.used} / {plan.limit} Used</span>
            {plan.trialEndsAt && (
              <span>
                Expires: {new Date(plan.trialEndsAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ================= KPI ================= */}
      <section className={styles.topStats}>
        <div className={styles.bigCard}>
          <h4>Visitors Today</h4>
          <p>{stats.today}</p>
        </div>

        <div className={styles.bigCard}>
          <h4>Currently Inside</h4>
          <p>{stats.inside}</p>
        </div>

        <div className={styles.bigCard}>
          <h4>Visitors Out</h4>
          <p>{stats.out}</p>
        </div>
      </section>

      {/* ================= TABLES ================= */}
      <section className={styles.tablesRow}>
        {/* ACTIVE VISITORS */}
        <div className={styles.tableCard}>
          <h3>Active Visitors</h3>

          {activeVisitors.length === 0 ? (
            <p>No active visitors</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Check-in</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeVisitors.map((v) => (
                  <tr key={v.visitor_code}>
                    <td>{v.visitor_code}</td>
                    <td>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{formatISTTime(v.check_in || v.checkIn)}</td>
                    <td>
                      <button
                        className={styles.checkoutBtn}
                        disabled={checkingOut === v.visitor_code}
                        onClick={() => handleCheckout(v.visitor_code)}
                      >
                        {checkingOut === v.visitor_code
                          ? "Checking out..."
                          : "Checkout"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* CHECKED OUT VISITORS */}
        <div className={styles.tableCard}>
          <h3>Checked-Out Visitors</h3>

          {checkedOutVisitors.length === 0 ? (
            <p>No visitors checked out today</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Check-out</th>
                </tr>
              </thead>
              <tbody>
                {checkedOutVisitors.map((v) => (
                  <tr key={v.visitor_code}>
                    <td>{v.visitor_code}</td>
                    <td>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{formatISTTime(v.check_out || v.checkOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <canvas ref={qrCanvasRef} style={{ display: 'none' }} />
    </div>
  );
}
