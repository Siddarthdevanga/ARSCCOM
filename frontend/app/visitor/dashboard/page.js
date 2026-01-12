"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  
  /* ================= TOAST NOTIFICATION ================= */
  const [toast, setToast] = useState({ show: false, message: "" });

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

  /* ================= SHOW TOAST ================= */
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 3000);
  };

  /* ================= LOAD IMAGE (S3 Compatible) ================= */
  const loadImage = (url) => {
    return new Promise((resolve, reject) => {
      if (!url) {
        resolve(null);
        return;
      }

      const img = new Image();
      
      // Set crossOrigin for S3 images
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      
      img.onerror = (error) => {
        console.warn('[IMAGE_LOAD] Failed to load image:', url);
        // Resolve with null instead of rejecting to continue execution
        resolve(null);
      };
      
      img.src = url;
      
      // Timeout after 8 seconds
      setTimeout(() => {
        console.warn('[IMAGE_LOAD] Timeout loading image:', url);
        resolve(null);
      }, 8000);
    });
  };

  /* ================= DOWNLOAD IMAGE WITH LOGO ================= */
  const downloadImage = async () => {
    if (!qrCodeImage || !company) return;

    try {
      showToast('Generating QR code image...');

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 1000);

      // Header background (purple gradient)
      const gradient = ctx.createLinearGradient(0, 0, 800, 120);
      gradient.addColorStop(0, '#3c007a');
      gradient.addColorStop(1, '#7a00ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 120);

      // Company Name (Left side)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(company.name, 50, 60);

      // Company Logo (Right side) - S3 compatible loading
      if (company.logo_url) {
        try {
          console.log('[LOGO] Attempting to load:', company.logo_url);
          const logoImg = await loadImage(company.logo_url);
          
          if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
            console.log('[LOGO] Successfully loaded');
            
            // Calculate logo dimensions (max 120x80, maintain aspect ratio)
            const maxWidth = 120;
            const maxHeight = 80;
            let width = logoImg.naturalWidth || logoImg.width;
            let height = logoImg.naturalHeight || logoImg.height;
            
            // Scale down if needed
            if (width > maxWidth) {
              const scale = maxWidth / width;
              width = maxWidth;
              height = height * scale;
            }
            
            if (height > maxHeight) {
              const scale = maxHeight / height;
              height = maxHeight;
              width = width * scale;
            }
            
            // Position logo on right side
            const x = 750 - width;
            const y = 20 + (80 - height) / 2;
            
            console.log('[LOGO] Drawing at:', { x, y, width, height });
            ctx.drawImage(logoImg, x, y, width, height);
          } else {
            console.warn('[LOGO] Image loaded but invalid or empty');
          }
        } catch (e) {
          console.error('[LOGO] Error loading logo:', e);
        }
      }

      // Title
      ctx.fillStyle = '#3c007a';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Visitor Registration', 50, 180);

      // Public URL Label
      ctx.font = '18px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText('Scan QR Code or Visit:', 50, 230);

      // Public URL
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillStyle = '#7a00ff';
      
      // Word wrap URL if too long
      const maxUrlWidth = 700;
      if (ctx.measureText(publicUrl).width > maxUrlWidth) {
        const words = publicUrl.split('/');
        let line = '';
        let y = 260;
        
        words.forEach((word, i) => {
          const testLine = line + (i > 0 ? '/' : '') + word;
          if (ctx.measureText(testLine).width > maxUrlWidth && line) {
            ctx.fillText(line, 50, y);
            line = word;
            y += 25;
          } else {
            line = testLine;
          }
        });
        
        if (line) {
          ctx.fillText(line, 50, y);
        }
      } else {
        ctx.fillText(publicUrl, 50, 260);
      }

      // QR Code
      const qrImg = new Image();
      qrImg.src = qrCodeImage;
      await new Promise((resolve) => {
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 250, 300, 300, 300);
          resolve();
        };
        qrImg.onerror = () => {
          console.error('[QR] Failed to load QR code');
          resolve();
        };
      });

      // Instructions
      ctx.font = '16px Arial, sans-serif';
      ctx.fillStyle = '#3c007a';
      ctx.textAlign = 'left';
      ctx.fillText('Instructions for Visitors:', 50, 650);
      
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      
      const instructions = [
        '1. Scan the QR code with your phone camera',
        '2. Or visit the URL above in your browser',
        '3. Enter your email to receive verification code',
        '4. Complete the registration form',
        '5. Capture your photo',
        '6. Receive your digital visitor pass via email'
      ];
      
      instructions.forEach((instruction, index) => {
        ctx.fillText(instruction, 70, 685 + (index * 30));
      });

      // Footer background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 900, 800, 100);

      // Footer text
      ctx.fillStyle = '#7a00ff';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PROMEET', 400, 940);
      
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText('Visitor and Conference Booking Platform', 400, 970);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${company.slug}-visitor-qr-code.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('✓ QR code downloaded successfully!');
      }, 'image/png', 1.0);

    } catch (err) {
      console.error('[DOWNLOAD] Image generation error:', err);
      showToast('✗ Failed to generate image');
    }
  };

  /* ================= COPY URL ================= */
  const copyURL = () => {
    if (!publicUrl) return;
    
    navigator.clipboard.writeText(publicUrl).then(() => {
      showToast('✓ URL copied to clipboard!');
    }).catch((err) => {
      console.error('[COPY] Failed to copy:', err);
      showToast('✗ Failed to copy URL');
    });
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
      {/* ================= TOAST NOTIFICATION ================= */}
      {toast.show && (
        <div className={styles.toast}>
          {toast.message}
        </div>
      )}

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
                onClick={downloadImage}
              >
                📄 Download QR Code Image
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
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt="Company Logo"
              className={styles.companyLogo}
              crossOrigin="anonymous"
            />
          )}

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
    </div>
  );
}
