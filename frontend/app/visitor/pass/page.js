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
   JOIN COMMUNITY BUTTON — compact outlined pill
====================================================== */
function JoinCommunityButton({ whatsappUrl, companyName }) {
  if (!whatsappUrl) return null;
  return (
    <button
      onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
      className={styles.whatsappBtn}
      type="button"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Join {companyName} Community
    </button>
  );
}

/* ======================================================
   INNER COMPONENT
====================================================== */
function VisitorPassContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const visitorCode = useMemo(() => {
    const raw = searchParams.get("code") || searchParams.get("visitorCode") || "";
    // If the param is a full URL (WhatsApp sometimes passes the URL as the code value),
    // extract the actual code from it
    if (raw.startsWith("http")) {
      try {
        const u = new URL(raw);
        return u.searchParams.get("code") || u.searchParams.get("visitorCode") || raw;
      } catch { return raw; }
    }
    return raw;
  }, [searchParams]);

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
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/public/code/${encodeURIComponent(visitorCode)}`,
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/${visitorCode}/resend`,
        { method: "POST", credentials: "include" }
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
          {(company?.id || localCompany?.id) && (
            <img
              src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company?.id || localCompany?.id}`}
              alt="Company Logo"
              className={styles.companyLogo}
              onError={e => { e.currentTarget.style.display = "none"; }}
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
                {visitor.purpose && (
                  <div className={styles.passRow}>
                    <span>Purpose</span>
                    <b>{visitor.purpose}</b>
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

              {/* Photo + Join Community */}
              <div className={styles.photoCol}>
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
                <JoinCommunityButton whatsappUrl={whatsappUrl} companyName={displayCompanyName} />
              </div>
            </div>

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
                onClick={async () => {
                  try { await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" }); } catch {}
                  localStorage.removeItem("company");
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
