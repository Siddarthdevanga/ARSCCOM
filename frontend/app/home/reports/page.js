"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./style.module.css";

export default function HomePage() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const getToken = () => localStorage.getItem("token");

  useEffect(() => {
    const token = getToken();
    const stored = localStorage.getItem("company");
    if (!token) { router.replace("/"); return; }
    if (stored) {
      try { setCompany(JSON.parse(stored)); } catch {}
    }

    fetch("/api/exports/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("company");
    router.replace("/");
  };

  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner} />
    </div>
  );

  return (
    <div className={styles.page}>

      {/* ─── HEADER ─────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {company?.logo && (
            <Image src={company.logo} alt="Logo" width={38} height={38}
              className={styles.logo} unoptimized />
          )}
          <span className={styles.logoText}>{company?.name || "Dashboard"}</span>
          <span className={styles.headerBadge}>HOME</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setNavOpen(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 4, padding: "8px 10px", borderRadius: 10,
              transition: "background 0.2s",
            }}
            aria-label="Menu"
          >
            {[0,1,2].map(i => (
              <span key={i} style={{ display: "block", width: 20, height: 2, background: "#7c3aed", borderRadius: 2 }} />
            ))}
          </button>
        </div>
      </header>

      {/* ─── NAV OVERLAY ────────────────────────────── */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(26,0,56,0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 900, animation: "fadeIn 0.2s ease",
          }}
        />
      )}

      {/* ─── SLIDE PANEL ─────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0,
        width: "min(320px, 85vw)", height: "100vh", height: "100dvh",
        background: "#fff", zIndex: 950,
        transform: navOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: "8px 0 40px rgba(98,0,214,0.15)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Panel Header */}
        <div style={{
          background: "linear-gradient(135deg, #4a00b4, #7a00ff)",
          padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: "1rem", fontFamily: "Nunito, sans-serif" }}>
              {company?.name || "Menu"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.75rem", fontWeight: 600, marginTop: 2 }}>
              Visitor Management
            </div>
          </div>
          <button
            onClick={() => setNavOpen(false)}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
              width: 36, height: 36, borderRadius: "50%", cursor: "pointer",
              fontSize: "1.1rem", fontWeight: 900, display: "flex",
              alignItems: "center", justifyContent: "center", transition: "all 0.25s",
            }}
          >✕</button>
        </div>

        {/* Panel Nav Links */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>

          {/* Section: Management */}
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9980c8", letterSpacing: 1.2, textTransform: "uppercase", padding: "8px 8px 6px", marginBottom: 4 }}>
            Management
          </div>

          {[
            { icon: "🏠", label: "Dashboard", sub: "Overview & stats", href: "/home" },
            { icon: "👥", label: "Visitors", sub: "Live visitor tracking", href: "/visitor/dashboard" },
          ].map(item => (
            <button key={item.href}
              onClick={() => { setNavOpen(false); router.push(item.href); }}
              style={{
                width: "100%", background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12, padding: "12px 10px",
                borderRadius: 14, transition: "background 0.15s", marginBottom: 4,
                textAlign: "left", fontFamily: "Nunito, sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f3f0fb"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <span style={{ fontSize: "1.35rem", width: 36, textAlign: "center" }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#1a0038" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#9980c8", fontWeight: 600 }}>{item.sub}</div>
              </div>
            </button>
          ))}

          <div style={{ height: 1, background: "#ede8f8", margin: "10px 0 14px" }} />

          {/* Section: Analytics */}
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9980c8", letterSpacing: 1.2, textTransform: "uppercase", padding: "0 8px 6px", marginBottom: 4 }}>
            Analytics
          </div>

          <button
            onClick={() => { setNavOpen(false); router.push("/home/reports"); }}
            style={{
              width: "100%", background: "linear-gradient(135deg, #f4eeff, #ede4fa)", border: "1.5px solid #ddd2f0",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px",
              borderRadius: 14, marginBottom: 8, textAlign: "left", fontFamily: "Nunito, sans-serif",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, #ede4fa, #ddd2f0)"; e.currentTarget.style.transform = "translateX(3px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, #f4eeff, #ede4fa)"; e.currentTarget.style.transform = "none"; }}
          >
            <span style={{ fontSize: "1.45rem", width: 36, textAlign: "center" }}>📊</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, color: "#1a0038" }}>Reports & Analytics</div>
              <div style={{ fontSize: 11, color: "#6200d6", fontWeight: 700 }}>Charts, trends &amp; exports</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#6200d6", fontSize: 14 }}>→</span>
          </button>

          <div style={{ height: 1, background: "#ede8f8", margin: "10px 0 14px" }} />

          {/* Section: Settings */}
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9980c8", letterSpacing: 1.2, textTransform: "uppercase", padding: "0 8px 6px", marginBottom: 4 }}>
            Settings
          </div>

          <button
            onClick={() => { setNavOpen(false); router.push("/visitor/admin"); }}
            style={{
              width: "100%", background: "linear-gradient(135deg, #f4eeff, #ede4fa)", border: "1.5px solid #ddd2f0",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px",
              borderRadius: 14, marginBottom: 8, textAlign: "left", fontFamily: "Nunito, sans-serif",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, #ede4fa, #ddd2f0)"; e.currentTarget.style.transform = "translateX(3px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, #f4eeff, #ede4fa)"; e.currentTarget.style.transform = "none"; }}
          >
            <span style={{ fontSize: "1.45rem", width: 36, textAlign: "center" }}>👤</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, color: "#1a0038" }}>Employee Directory</div>
              <div style={{ fontSize: 11, color: "#6200d6", fontWeight: 700 }}>Manage who visitors can meet</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#6200d6", fontSize: 14 }}>→</span>
          </button>

          <div style={{ height: 1, background: "#ede8f8", margin: "10px 0 14px" }} />

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width: "100%", background: "rgba(204,17,0,0.06)", border: "1.5px solid rgba(204,17,0,0.15)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: 14, textAlign: "left", fontFamily: "Nunito, sans-serif",
              transition: "all 0.2s", color: "#cc1100",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(204,17,0,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(204,17,0,0.06)"}
          >
            <span style={{ fontSize: "1.2rem", width: 36, textAlign: "center" }}>🚪</span>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Sign Out</div>
          </button>
        </div>
      </div>

      {/* ─── HERO BANNER ─────────────────────────────── */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBannerContent}>
          <div className={styles.heroBannerGreeting}>
            <span className={styles.heroBannerDot} />
            VISITOR MANAGEMENT
          </div>
          <h1 className={styles.heroBannerTitle}>
            Welcome back, <span>{company?.name || "Admin"}</span>
          </h1>
          <p className={styles.heroBannerSub}>
            Here&apos;s a quick overview of your workspace activity
          </p>
        </div>
      </div>

      {/* ─── MAIN CONTENT ───────────────────────────── */}
      <div className={styles.container}>

        {/* Stats Cards */}
        <div className={styles.card} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
          {[
            { label: "Total Visitors",    value: stats?.visitors?.total  ?? "—", color: "#7c3aed" },
            { label: "Active Now",         value: stats?.visitors?.active ?? "—", color: "#f0a500" },
            { label: "Total Bookings",     value: stats?.bookings?.total  ?? "—", color: "#3b82f6" },
            { label: "Upcoming Bookings",  value: stats?.bookings?.upcoming ?? "—", color: "#00b894" },
          ].map((s, i) => (
            <div key={i} style={{
              background: "linear-gradient(145deg, #f4eeff, #ece4fa)",
              borderRadius: 16, padding: "18px 16px",
              border: "1.5px solid #ddd2f0",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9980c8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                {s.label}
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className={styles.card}>
          <h2 className={styles.title}>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { label: "🧑‍💼 Visitor Dashboard",      href: "/visitor/dashboard", primary: true },
              { label: "📊 Reports & Analytics",    href: "/home/reports",       primary: false },
              { label: "👤 Employee Directory",      href: "/visitor/admin",      primary: false },
            ].map((action) => (
              <button
                key={action.href}
                className={action.primary ? styles.primaryBtn : styles.secondaryBtn}
                onClick={() => router.push(action.href)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20,
          padding: "14px 22px", borderRadius: 14, fontSize: 14, fontWeight: 700,
          zIndex: 10000, minWidth: 240, textAlign: "center",
          background: toast.type === "error" ? "#cc1100" : "#5b00c8",
          color: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          animation: "slideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
