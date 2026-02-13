"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   UTILITY: Format MySQL/ISO time without timezone conversion
====================================================== */
const formatISTTime = (value) => {
  if (!value) return "-";
  try {
    const str = String(value).trim();
    let timePart;

    if (str.includes(" ")) timePart = str.split(" ")[1];
    else if (str.includes("T")) timePart = str.split("T")[1];

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

/* ======================================================
   MAIN COMPONENT
====================================================== */
export default function VisitorDashboard() {
  const router = useRouter();

  // Core state
  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState({ today: 0, inside: 0, out: 0 });
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [checkedOutVisitors, setCheckedOutVisitors] = useState([]);
  const [checkingOut, setCheckingOut] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Plan state (NEW - for usage display)
  const [planUsage, setPlanUsage] = useState(null);
  
  // QR Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [loadingQR, setLoadingQR] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  /* ================= TOAST HELPER ================= */
  const showToast = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  }, []);

  /* ================= FETCH DASHBOARD DATA ================= */
  const loadDashboard = useCallback(async (token) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        console.error("Dashboard API error:", res.status, res.statusText);
        
        // Handle subscription errors
        if (res.status === 403) {
          const errorData = await res.json();
          if (errorData.message?.includes("expired") || errorData.message?.includes("inactive")) {
            showToast("Your subscription has expired. Redirecting...", "error");
            setTimeout(() => router.replace("/auth/subscription"), 2000);
            return;
          }
        }
        throw new Error("Failed to load dashboard");
      }

      const data = await res.json();
      console.log("Dashboard data received:", data);

      setStats(data?.stats || { today: 0, inside: 0, out: 0 });
      setActiveVisitors(data?.activeVisitors || data?.insideVisitors || []);
      setCheckedOutVisitors(data?.checkedOutVisitors || data?.outVisitors || data?.todayCheckouts || []);
      
      // Store plan info from dashboard response
      if (data?.plan) {
        setPlanUsage({
          plan: data.plan.plan,
          limit: data.plan.limit,
          used: data.plan.used,
          remaining: data.plan.remaining,
          isUnlimited: data.plan.plan === "ENTERPRISE"
        });
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      showToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

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

  /* ================= INITIAL LOAD ================= */
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

  /* ================= CHECKOUT VISITOR ================= */
  const handleCheckout = useCallback(async (visitorCode) => {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast("Authentication required", "error");
      return;
    }

    try {
      setCheckingOut(visitorCode);
      console.log("Checking out visitor:", visitorCode);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/${visitorCode}/checkout`,
        {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      const data = await res.json();

      if (res.ok) {
        showToast("✓ Visitor checked out successfully!", "success");
        await loadDashboard(token);
      } else {
        if (res.status === 403 && data.message?.includes("expired")) {
          showToast("Subscription expired. Redirecting...", "error");
          setTimeout(() => router.replace("/auth/subscription"), 2000);
          return;
        }
        showToast(data.message || "Failed to checkout visitor", "error");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      showToast("✗ Network error during checkout", "error");
    } finally {
      setCheckingOut(null);
    }
  }, [loadDashboard, router, showToast]);

  /* ================= DOWNLOAD QR IMAGE ================= */
  const downloadImage = useCallback(async () => {
    if (!qrCodeImage || !company) return;

    try {
      showToast('Generating QR code image...', 'info');

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

      // Company Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(company.name, 50, 70);

      // Company Logo
      if (company.logo_url) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          logoImg.src = company.logo_url;
          
          await new Promise((resolve) => {
            logoImg.onload = () => {
              const maxWidth = 120;
              const maxHeight = 80;
              let width = logoImg.width;
              let height = logoImg.height;
              
              if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
              }
              
              if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
              }
              
              const x = 750 - width;
              const y = 20 + (80 - height) / 2;
              
              ctx.drawImage(logoImg, x, y, width, height);
              resolve();
            };
            logoImg.onerror = () => resolve();
            setTimeout(() => resolve(), 5000);
          });
        } catch (e) {
          console.log('Logo error:', e);
        }
      }

      // Title
      ctx.fillStyle = '#3c007a';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Visitor Registration', 50, 180);

      // Public URL Label
      ctx.font = '18px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('Scan QR Code or Visit:', 50, 230);

      // Public URL
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#7a00ff';
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
      ctx.fillStyle = '#3c007a';
      ctx.fillText('Instructions for Visitors:', 50, 650);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#666666';
      const instructions = [
        '1. Scan the QR code with your phone camera',
        '2. Or visit the URL above in your browser',
        '3. Enter your email to receive verification code',
        '4. Complete the registration form',
        '5. Capture your photo',
        '6. Receive your digital visitor pass via email'
      ];
      
      instructions.forEach((text, i) => {
        ctx.fillText(text, 70, 685 + (i * 30));
      });

      // Footer
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 900, 800, 100);

      ctx.fillStyle = '#7a00ff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PROMEET', 400, 940);
      
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.fillText('Visitor and Conference Booking Platform', 400, 970);

      // Download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${company.slug}-visitor-qr-code.png`;
        link.click();
        URL.revokeObjectURL(url);
        
        showToast('✓ QR code downloaded successfully!', 'success');
      });

    } catch (err) {
      console.error('Image generation error:', err);
      showToast('✗ Failed to generate image', 'error');
    }
  }, [qrCodeImage, company, publicUrl, showToast]);

  /* ================= COPY URL ================= */
  const copyURL = useCallback(() => {
    if (!publicUrl) return;
    
    navigator.clipboard.writeText(publicUrl)
      .then(() => showToast('✓ URL copied to clipboard!', 'success'))
      .catch(() => showToast('✗ Failed to copy URL', 'error'));
  }, [publicUrl, showToast]);

  /* ================= NEW VISITOR HANDLER ================= */
  const handleNewVisitor = useCallback(() => {
    if (limitReached) {
      showToast("Trial limit reached. Please upgrade your plan.", "error");
      setTimeout(() => router.push("/auth/subscription"), 1500);
      return;
    }
    router.push("/visitor/primary_details");
  }, [router, showToast]);

  /* ================= PLAN CALCULATIONS ================= */
  const isTrial = planUsage?.plan === "TRIAL";
  const limitReached = isTrial && planUsage?.remaining === 0;

  const planPercentage = useMemo(() => {
    if (!planUsage?.limit || planUsage.limit === 0) return 0;
    if (planUsage.isUnlimited) return 100;
    return Math.min(100, Math.round((planUsage.used / planUsage.limit) * 100));
  }, [planUsage]);

  const planBarColor = useMemo(() => {
    if (planUsage?.isUnlimited) return "#10b981"; // Green for unlimited
    if (planPercentage >= 90) return "#ff1744";   // Red
    if (planPercentage >= 70) return "#ff9800";   // Orange
    return "#00c853";                              // Green
  }, [planPercentage, planUsage]);

  /* ================= LOADING STATE ================= */
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
        <div className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
          {toast.message}
        </div>
      )}

      {/* ================= SLIDING QR PANEL ================= */}
      <div className={`${styles.slidingPanel} ${panelOpen ? styles.panelOpen : ''}`}>
        <div className={styles.panelHeader}>
          <h3>Public Registration</h3>
          <button 
            className={styles.panelCloseBtn}
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
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
              {qrCodeImage && (
                <div className={styles.qrSection}>
                  <img 
                    src={qrCodeImage} 
                    alt="Visitor Registration QR Code" 
                    className={styles.qrImage}
                  />
                  <p className={styles.qrHint}>Scan to register</p>
                </div>
              )}

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
                      aria-label="Copy URL to clipboard"
                    >
                      📋
                    </button>
                  </div>
                </div>
              )}

              <button 
                className={styles.downloadPdfBtn}
                onClick={downloadImage}
              >
                📄 Download QR Code Image
              </button>

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
          title="Show Public Registration QR Code"
          aria-label="Open QR code panel"
        >
          📱 QR Code
        </button>
      )}

      {/* ================= OVERLAY ================= */}
      {panelOpen && (
        <div 
          className={styles.panelOverlay}
          onClick={() => setPanelOpen(false)}
          aria-label="Close panel overlay"
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
            alt={`${company.name} logo`}
            className={styles.companyLogo}
          />

          <button
            className={styles.backBtn}
            onClick={() => router.push("/home")}
            aria-label="Go back to home"
          >
            ← Back
          </button>
        </div>
      </header>

      {/* ================= TITLE BAR ================= */}
      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>Visitor Dashboard</h1>

        <button
          className={styles.newBtn}
          disabled={limitReached}
          style={{
            opacity: limitReached ? 0.5 : 1,
            cursor: limitReached ? "not-allowed" : "pointer"
          }}
          onClick={handleNewVisitor}
          aria-label="Register new visitor"
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

      {/* ================= PLAN USAGE BAR (IMPROVED) ================= */}
      {planUsage && (
        <section className={styles.planBarWrapper}>
          <div className={styles.planHeader}>
            <span className={styles.planName}>
              {planUsage.plan} Plan {planUsage.isUnlimited && '✨'}
            </span>
            <span className={styles.planRemaining}>
              {planUsage.isUnlimited 
                ? `${planUsage.used} Visitors Registered`
                : `${planUsage.remaining} Visitors Remaining`
              }
            </span>
          </div>

          <div className={styles.planBarBg}>
            <div
              className={styles.planBarFill}
              style={{
                width: `${planPercentage}%`,
                background: planBarColor
              }}
            >
              {planUsage.isUnlimited && (
                <span className={styles.planBarText}>Unlimited</span>
              )}
            </div>
          </div>

          <div className={styles.planFooter}>
            <span>
              {planUsage.isUnlimited 
                ? `${planUsage.used} Total Visitors`
                : `${planUsage.used} / ${planUsage.limit} Used`
              }
            </span>
          </div>
        </section>
      )}

      {/* ================= KPI STATS ================= */}
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
          <h4>Checked Out Today</h4>
          <p>{stats.out}</p>
        </div>
      </section>

      {/* ================= VISITOR TABLES ================= */}
      <section className={styles.tablesRow}>
        {/* ACTIVE VISITORS TABLE */}
        <div className={styles.tableCard}>
          <h3>Currently Inside ({activeVisitors.length})</h3>

          {activeVisitors.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No visitors currently inside</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
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
                    <tr key={v.visitor_code || v.id}>
                      <td>{v.visitor_code}</td>
                      <td>{v.name}</td>
                      <td>{v.phone}</td>
                      <td>{formatISTTime(v.check_in || v.checkIn)}</td>
                      <td>
                        <button
                          className={styles.checkoutBtn}
                          disabled={checkingOut === v.visitor_code}
                          onClick={() => handleCheckout(v.visitor_code)}
                          style={{
                            opacity: checkingOut === v.visitor_code ? 0.6 : 1,
                            cursor: checkingOut === v.visitor_code ? 'not-allowed' : 'pointer'
                          }}
                          aria-label={`Checkout ${v.name}`}
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
            </div>
          )}
        </div>

        {/* CHECKED OUT VISITORS TABLE */}
        <div className={styles.tableCard}>
          <h3>Checked Out Today ({checkedOutVisitors.length})</h3>

          {checkedOutVisitors.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No visitors checked out today</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
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
                    <tr key={v.visitor_code || v.id}>
                      <td>{v.visitor_code}</td>
                      <td>{v.name}</td>
                      <td>{v.phone}</td>
                      <td>{formatISTTime(v.check_out || v.checkOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
