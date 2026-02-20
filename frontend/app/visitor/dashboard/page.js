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

  /* ================= TOAST STATE ================= */
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  /* ================= FETCH DASHBOARD ================= */
  const loadDashboard = useCallback(async (token) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        if (res.status === 403) {
          const errorData = await res.json();
          if (errorData.message?.includes("expired") || errorData.message?.includes("inactive")) {
            showToast("Your subscription has expired. Redirecting…", "error");
            setTimeout(() => router.replace("/auth/subscription"), 2000);
            return;
          }
        }
        return;
      }

      const data = await res.json();
      setStats(data?.stats || { today: 0, inside: 0, out: 0 });
      setActiveVisitors(data?.activeVisitors || data?.insideVisitors || []);
      setCheckedOutVisitors(data?.checkedOutVisitors || data?.outVisitors || data?.todayCheckouts || []);
      setPlan(data?.plan || null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      showToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [router]);

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
    if (!token) { showToast("Authentication required", "error"); return; }
    try {
      setCheckingOut(visitorCode);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/${visitorCode}/checkout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        }
      );
      const data = await res.json();
      if (res.ok) {
        showToast("✓ Visitor checked out successfully!", "success");
        await loadDashboard(token);
      } else {
        if (res.status === 403 && data.message?.includes("expired")) {
          showToast("Subscription expired. Redirecting…", "error");
          setTimeout(() => router.replace("/auth/subscription"), 2000);
          return;
        }
        showToast(data.message || "Failed to checkout visitor", "error");
      }
    } catch (err) {
      showToast("✗ Network error during checkout", "error");
    } finally {
      setCheckingOut(null);
    }
  };

  /* ================= DOWNLOAD IMAGE ================= */
  const downloadImage = async () => {
    if (!qrCodeImage || !company) return;
    try {
      showToast("Generating QR code image…", "info");
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 800, 1000);

      const gradient = ctx.createLinearGradient(0, 0, 800, 120);
      gradient.addColorStop(0, "#3c007a");
      gradient.addColorStop(1, "#6200d6");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 120);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "left";
      ctx.fillText(company.name, 50, 70);

      if (company.logo_url) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = "anonymous";
          logoImg.src = company.logo_url;
          await new Promise((resolve) => {
            logoImg.onload = () => {
              const maxW = 120, maxH = 80;
              let w = logoImg.width, h = logoImg.height;
              if (w > maxW) { h = (maxW / w) * h; w = maxW; }
              if (h > maxH) { w = (maxH / h) * w; h = maxH; }
              ctx.drawImage(logoImg, 750 - w, 20 + (80 - h) / 2, w, h);
              resolve();
            };
            logoImg.onerror = () => resolve();
            setTimeout(resolve, 5000);
          });
        } catch {}
      }

      ctx.fillStyle = "#3c007a";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "left";
      ctx.fillText("Visitor Registration", 50, 180);
      ctx.font = "18px Arial";
      ctx.fillStyle = "#666666";
      ctx.fillText("Scan QR Code or Visit:", 50, 230);
      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "#6200d6";
      ctx.fillText(publicUrl, 50, 260);

      const qrImg = new Image();
      qrImg.src = qrCodeImage;
      await new Promise((resolve) => {
        qrImg.onload = () => { ctx.drawImage(qrImg, 250, 300, 300, 300); resolve(); };
      });

      ctx.font = "16px Arial";
      ctx.fillStyle = "#3c007a";
      ctx.fillText("Instructions for Visitors:", 50, 650);
      ctx.font = "14px Arial";
      ctx.fillStyle = "#666666";
      ["1. Scan the QR code with your phone camera",
       "2. Or visit the URL above in your browser",
       "3. Enter your email to receive verification code",
       "4. Complete the registration form",
       "5. Capture your photo",
       "6. Receive your digital visitor pass via email"
      ].forEach((line, i) => ctx.fillText(line, 70, 685 + i * 30));

      ctx.fillStyle = "#f8f4ff";
      ctx.fillRect(0, 900, 800, 100);
      ctx.fillStyle = "#6200d6";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("PROMEET", 400, 940);
      ctx.fillStyle = "#666666";
      ctx.font = "14px Arial";
      ctx.fillText("Visitor and Conference Booking Platform", 400, 970);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${company.slug}-visitor-qr-code.png`;
        link.click();
        URL.revokeObjectURL(url);
        showToast("✓ QR code downloaded!", "success");
      });
    } catch (err) {
      showToast("✗ Failed to generate image", "error");
    }
  };

  /* ================= COPY URL ================= */
  const copyURL = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl)
      .then(() => showToast("✓ URL copied to clipboard!", "success"))
      .catch(() => showToast("✗ Failed to copy URL", "error"));
  };

  /* ================= NEW VISITOR ================= */
  const handleNewVisitor = () => {
    if (limitReached) {
      showToast("Trial limit reached. Please upgrade your plan.", "error");
      setTimeout(() => router.push("/auth/subscription"), 1500);
      return;
    }
    router.push("/visitor/primary_details");
  };

  /* ================= PLAN HELPERS ================= */
  const isTrial = plan?.plan === "TRIAL";
  const limitReached = isTrial && plan?.remaining === 0;

  const planPercentage = useMemo(() => {
    if (!plan?.limit || plan.limit === 0) return 0;
    return Math.min(100, Math.round((plan.used / plan.limit) * 100));
  }, [plan]);

  const planBarColor =
    planPercentage >= 90 ? "#d62000" :
    planPercentage >= 70 ? "#f0a500" :
    "#00b894";

  /* ================= LOADING ================= */
  if (loading || !company) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* ================= TOAST ================= */}
      {toast.show && (
        <div className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
          {toast.message}
        </div>
      )}

      {/* ================= SLIDING PANEL ================= */}
      <div className={`${styles.slidingPanel} ${panelOpen ? styles.panelOpen : ""}`}>
        <div className={styles.panelHeader}>
          <h3>Public Registration</h3>
          <button className={styles.panelCloseBtn} onClick={() => setPanelOpen(false)}>✕</button>
        </div>

        <div className={styles.panelContent}>
          {loadingQR ? (
            <div className={styles.panelLoading}>
              <div className={styles.spinner} />
              <p>Loading QR Code…</p>
            </div>
          ) : (
            <>
              {qrCodeImage && (
                <div className={styles.qrSection}>
                  <img src={qrCodeImage} alt="QR Code" className={styles.qrImage} />
                  <p className={styles.qrHint}>Scan to register</p>
                </div>
              )}

              {publicUrl && (
                <div className={styles.urlSection}>
                  <label>Public Registration URL</label>
                  <div className={styles.urlBox}>
                    <input type="text" value={publicUrl} readOnly className={styles.urlInput} />
                    <button className={styles.copyBtn} onClick={copyURL} title="Copy URL">📋</button>
                  </div>
                </div>
              )}

              <button className={styles.downloadPdfBtn} onClick={downloadImage}>
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

      {/* ================= PANEL TOGGLE ================= */}
      {!panelOpen && (
        <button className={styles.panelToggleBtn} onClick={() => setPanelOpen(true)} title="Show Public Registration">
          📱 QR Code
        </button>
      )}

      {/* ================= OVERLAY ================= */}
      {panelOpen && (
        <div className={styles.panelOverlay} onClick={() => setPanelOpen(false)} />
      )}

      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.logoText}>{company.name}</div>
        <div className={styles.rightHeader}>
          <img
            src={company.logo_url || "/logo.png"}
            alt="Company Logo"
            className={styles.companyLogo}
          />
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Back</button>
        </div>
      </header>

      {/* ================= PAGE BODY ================= */}
      <main className={styles.pageBody}>

        {/* TITLE ROW */}
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Visitor Dashboard</h1>
          <button
            className={styles.newBtn}
            disabled={limitReached}
            onClick={handleNewVisitor}
          >
            + New Visitor
          </button>
        </div>

        {/* UPGRADE MESSAGE */}
        {limitReached && (
          <div className={styles.upgradeMsg}>
            Trial limit reached. Please upgrade your plan to register more visitors.
          </div>
        )}

        {/* PLAN BAR */}
        {isTrial && (
          <section className={styles.planBarWrapper}>
            <div className={styles.planHeader}>
              <span className={styles.planName}>Trial Plan</span>
              <span className={styles.planRemaining}>{plan.remaining} Remaining</span>
            </div>
            <div className={styles.planBarBg}>
              <div
                className={styles.planBarFill}
                style={{ width: `${planPercentage}%`, background: planBarColor }}
              />
            </div>
            <div className={styles.planFooter}>
              <span>{plan.used} / {plan.limit} Used</span>
              {plan.trialEndsAt && (
                <span>Expires: {new Date(plan.trialEndsAt).toLocaleDateString()}</span>
              )}
            </div>
          </section>
        )}

        {/* KPI CARDS */}
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

        {/* TABLES */}
        <section className={styles.tablesRow}>

          {/* ACTIVE VISITORS */}
          <div className={styles.tableCard}>
            <h3>Currently Inside ({activeVisitors.length})</h3>
            {activeVisitors.length === 0 ? (
              <div className={styles.emptyState}>No visitors currently inside</div>
            ) : (
              <div className={styles.tableScroll}>
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
                          >
                            {checkingOut === v.visitor_code ? "…" : "Checkout"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CHECKED OUT VISITORS */}
          <div className={styles.tableCard}>
            <h3>Checked Out Today ({checkedOutVisitors.length})</h3>
            {checkedOutVisitors.length === 0 ? (
              <div className={styles.emptyState}>No visitors checked out today</div>
            ) : (
              <div className={styles.tableScroll}>
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

        {/* DEBUG (dev only) */}
        {process.env.NODE_ENV === "development" && (
          <div style={{ background: "#f8f4ff", padding: "10px", margin: "16px 0", fontSize: "12px", borderRadius: "8px", border: "1px solid #e8d8ff", color: "#555" }}>
            <strong>🔧 Debug:</strong> Active: {activeVisitors.length} | Out: {checkedOutVisitors.length} | Stats: {JSON.stringify(stats)}
          </div>
        )}

      </main>
    </div>
  );
}
