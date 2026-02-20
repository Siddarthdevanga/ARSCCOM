"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   PURE IST FORMATTER (NO TIMEZONE CONVERSION)
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";
  try {
    const str = String(value).trim();
    if (!str) return "-";
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let y, mo, d, h, m;
    if (str.includes(" ")) {
      const [date, time] = str.split(" ");
      [y, mo, d] = date.split("-");
      [h, m] = time.split(":");
      h = parseInt(h, 10);
    } else if (str.includes("T")) {
      const [date, timePart] = str.split("T");
      [y, mo, d] = date.split("-");
      const [hr, mn] = timePart.split(":");
      h = parseInt(hr, 10);
      m = mn;
    } else return "-";
    if (isNaN(h)) return "-";
    const suffix = h >= 12 ? "PM" : "AM";
    const hh = (h % 12) || 12;
    return `${d.padStart(2, "0")} ${months[mo - 1]} ${y}, ${String(hh).padStart(2, "0")}:${m} ${suffix}`;
  } catch {
    return "-";
  }
};

/* ======================================================
   WHATSAPP SECTION
====================================================== */
function WhatsAppSection({ whatsappUrl, companyName }) {
  if (!whatsappUrl) return null;
  return (
    <div className={styles.whatsappSection}>
      <div className={styles.whatsappIcon}>📱</div>
      <div className={styles.whatsappText}>
        <strong>Stay Connected with {companyName}</strong>
        <p>Join our WhatsApp group for updates and support during your visit</p>
      </div>
      <button
        onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
        className={styles.whatsappBtn}
        type="button"
      >
        Join WhatsApp Group
      </button>
    </div>
  );
}

/* ======================================================
   INNER COMPONENT
====================================================== */
function VisitorPassContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const visitorCode = useMemo(() => searchParams.get("visitorCode"), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [visitor, setVisitor] = useState(null);
  const [error, setError] = useState("");

  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");

  const [localCompany, setLocalCompany] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) setLocalCompany(JSON.parse(stored));
    } catch (err) {
      console.error("Failed to parse company from localStorage:", err);
    }
  }, []);

  useEffect(() => {
    if (!visitorCode) {
      setError("Visitor pass not found");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const loadPass = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/public/code/${visitorCode}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Visitor not found");
        setCompany(data.company || null);
        setVisitor(data.visitor || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load visitor pass");
        }
      } finally {
        setLoading(false);
      }
    };
    loadPass();
    return () => controller.abort();
  }, [visitorCode]);

  const handleResendPass = async () => {
    setResending(true);
    setResendError("");
    setResendSuccess(false);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/${visitorCode}/resend`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to resend pass");
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      console.error("RESEND ERROR:", err);
      setResendError(err.message || "Failed to resend visitor pass");
      setTimeout(() => setResendError(""), 5000);
    } finally {
      setResending(false);
    }
  };

  /* ===== LOADING STATE ===== */
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading Visitor Pass…</div>
      </div>
    );
  }

  /* ===== ERROR STATE ===== */
  if (error) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.logoText}>Visitor Pass</div>
          </div>
          <div className={styles.rightHeader}>
            <button className={styles.backBtn} onClick={() => router.push("/visitor/dashboard")}>
              ← Home
            </button>
          </div>
        </header>
        <div className={styles.scrollBody}>
          <div className={styles.errorStatePage}>
            <div className={styles.errorStateIcon}>⚠️</div>
            <p>{error}</p>
            <button className={styles.dashboardBtn} onClick={() => router.push("/visitor/dashboard")}>
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!visitor || !company) return null;

  const whatsappUrl = localCompany?.whatsapp_url || company?.whatsapp_url || null;
  const displayCompanyName = localCompany?.name || company?.name || "Company";

  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{displayCompanyName}</div>
        </div>
        <div className={styles.rightHeader}>
          {(company.logo || localCompany?.logo_url) && (
            <img
              src={company.logo || localCompany?.logo_url || "/logo.png"}
              alt="Company Logo"
              className={styles.companyLogo}
            />
          )}
          <button
            className={styles.backBtn}
            onClick={() => router.push("/visitor/identity")}
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
            Visitor <span>Pass</span>
          </h1>
          <p className={styles.heroSub}>Digital visitor pass generated successfully</p>

          {/* Step indicator — all done */}
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
            <div className={`${styles.step} ${styles.stepDone}`}>
              <span className={styles.stepNum}>✓</span>
              <span className={styles.stepLabel}>Identity</span>
            </div>
          </div>
        </section>

        {/* ===== PASS CARD ===== */}
        <main className={styles.mainContent}>
          <div className={styles.passCard}>

            {/* Messages */}
            {resendSuccess && (
              <div className={styles.successMsg}>
                ✓ Visitor pass resent successfully to {visitor.email}
              </div>
            )}
            {resendError && (
              <div className={styles.errorMsg}>✕ {resendError}</div>
            )}

            {/* Pass body */}
            <div className={styles.passBody}>

              {/* Details */}
              <div className={styles.passDetails}>
                <div className={styles.sectionHeader}>
                  <span className={styles.cardDot} />
                  <h3 className={styles.cardTitle}>VISITOR PASS</h3>
                </div>

                <div className={styles.passCode}>{visitor.visitorCode}</div>

                <div className={styles.passRow}>
                  <span>Name</span>
                  <b>{visitor.name}</b>
                </div>
                <div className={styles.passRow}>
                  <span>Phone</span>
                  <b>{visitor.phone}</b>
                </div>
                {visitor.email && (
                  <div className={styles.passRow}>
                    <span>Email</span>
                    <b>{visitor.email}</b>
                  </div>
                )}
                <div className={styles.passRow}>
                  <span>Check-in</span>
                  <b>{formatIST(visitor.checkIn)}</b>
                </div>
                <div className={styles.passRow}>
                  <span>Status</span>
                  <b className={visitor.status === "IN" ? styles.statusIn : styles.statusOut}>
                    {visitor.status === "IN" ? "Checked In" : "Checked Out"}
                  </b>
                </div>
              </div>

              {/* Photo */}
              <div className={styles.photoBox}>
                {visitor.photoUrl ? (
                  <img src={visitor.photoUrl} alt="Visitor" className={styles.photo} />
                ) : (
                  <div className={styles.noPhoto}>
                    <span>📷</span>
                    NO PHOTO
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <WhatsAppSection whatsappUrl={whatsappUrl} companyName={company.name} />

            {/* Actions */}
            <div className={styles.actions}>
              {visitor.email && (
                <button
                  className={styles.resendBtn}
                  onClick={handleResendPass}
                  disabled={resending}
                >
                  {resending ? "Sending…" : "📧 Resend Pass"}
                </button>
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button
                className={styles.logoutBtn}
                onClick={() => {
                  localStorage.clear();
                  router.push("/auth/login");
                }}
              >
                Logout
              </button>
              <button
                className={styles.dashboardBtn}
                onClick={() => router.push("/visitor/dashboard")}
              >
                Dashboard
              </button>
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}

/* ======================================================
   PAGE WRAPPER WITH SUSPENSE
====================================================== */
export default function VisitorPassPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.loading}>Loading…</div>
        </div>
      }
    >
      <VisitorPassContent />
    </Suspense>
  );
}
