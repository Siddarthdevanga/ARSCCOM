"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   FINAL — PURE IST FORMATTER (NO TIMEZONE CONVERSION)
   DB already stores IST → only format nicely
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  try {
    const str = String(value).trim();
    if (!str) return "-";

    const months = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ];

    let y, mo, d, h, m;

    // MySQL: YYYY-MM-DD HH:MM:SS
    if (str.includes(" ")) {
      const [date, time] = str.split(" ");
      [y, mo, d] = date.split("-");
      [h, m] = time.split(":");
      h = parseInt(h, 10);
    }
    // ISO: YYYY-MM-DDTHH:MM:SS...
    else if (str.includes("T")) {
      const [date, timePart] = str.split("T");
      [y, mo, d] = date.split("-");
      const [hr, mn] = timePart.split(":");
      h = parseInt(hr, 10);
      m = mn;
    }
    else return "-";

    if (isNaN(h)) return "-";

    const suffix = h >= 12 ? "PM" : "AM";
    const hh = (h % 12) || 12;

    return `${d.padStart(2,"0")} ${months[mo-1]} ${y}, ${String(hh).padStart(2,"0")}:${m} ${suffix}`;
  } catch {
    return "-";
  }
};

/* ======================================================
   INNER COMPONENT
====================================================== */
function VisitorPassContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const visitorCode = useMemo(
    () => searchParams.get("visitorCode"),
    [searchParams]
  );

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [visitor, setVisitor] = useState(null);
  const [error, setError] = useState("");

  // Resend states
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");

  // Get company from localStorage to access whatsapp_url
  const [localCompany, setLocalCompany] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) {
        setLocalCompany(JSON.parse(stored));
      }
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

  /* ======================================================
     RESEND VISITOR PASS
  ====================================================== */
  const handleResendPass = async () => {
    setResending(true);
    setResendError("");
    setResendSuccess(false);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visitors/${visitorCode}/resend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCard}>Loading Visitor Pass…</div>
      </div>
    );
  }

  /* ---------- Error ---------- */
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCard}>
          <p>{error}</p>
          <button
            className={styles.primaryBtn}
            onClick={() => router.push("/")}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!visitor || !company) return null;

  // Check if WhatsApp URL exists (from localStorage company or fallback)
  const whatsappUrl = localCompany?.whatsapp_url || company?.whatsapp_url || null;

  return (
    <div className={styles.page}>
      <div className={styles.passCard}>
        
        {/* HEADER */}
        <header className={styles.header}>
          <div className={styles.companyName}>{company.name}</div>

          {company.logo && (
            <img
              src={company.logo}
              alt="Company logo"
              className={styles.logo}
            />
          )}
        </header>

        {/* SUCCESS/ERROR MESSAGES */}
        {resendSuccess && (
          <div className={styles.successMessage}>
            ✓ Visitor pass resent successfully to {visitor.email}
          </div>
        )}

        {resendError && (
          <div className={styles.errorMessage}>
            ✕ {resendError}
          </div>
        )}

        {/* BODY */}
        <div className={styles.body}>
          <div className={styles.details}>
            <div className={styles.passTitle}>VISITOR PASS</div>
            <div className={styles.passCode}>{visitor.visitorCode}</div>

            <div className={styles.row}>
              <span>Name</span>
              <b>{visitor.name}</b>
            </div>

            <div className={styles.row}>
              <span>Phone</span>
              <b>{visitor.phone}</b>
            </div>

            {visitor.email && (
              <div className={styles.row}>
                <span>Email</span>
                <b>{visitor.email}</b>
              </div>
            )}

            <div className={styles.row}>
              <span>Check-in</span>
              <b>{formatIST(visitor.checkIn)}</b>
            </div>

            <div className={styles.row}>
              <span>Status</span>
              <b className={visitor.status === "IN" ? styles.statusIn : styles.statusOut}>
                {visitor.status === "IN" ? "Checked In" : "Checked Out"}
              </b>
            </div>
          </div>

          <div className={styles.photoBox}>
            {visitor.photoUrl ? (
              <img
                src={visitor.photoUrl}
                alt="Visitor"
                className={styles.photo}
              />
            ) : (
              <div className={styles.noPhoto}>NO PHOTO</div>
            )}
          </div>
        </div>

        {/* WHATSAPP SECTION */}
        {whatsappUrl && (
          <div className={styles.whatsappSection}>
            <div className={styles.whatsappIcon}>📱</div>
            <div className={styles.whatsappText}>
              <strong>Stay Connected with {company.name}</strong>
              <p>Join our WhatsApp group for updates and support during your visit</p>
            </div>
            
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappBtn}
            >
              Join WhatsApp Group
            </a>
          </div>
        )}

        {/* ACTIONS */}
        <div className={styles.actions}>
          {visitor.email && (
            <button
              className={styles.resendBtn}
              onClick={handleResendPass}
              disabled={resending}
            >
              {resending ? "Sending..." : "📧 Resend Pass"}
            </button>
          )}
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <button
            className={styles.secondaryBtn}
            onClick={() => {
              localStorage.clear();
              router.push("/auth/login");
            }}
          >
            Logout
          </button>

          <button
            className={styles.primaryBtn}
            onClick={() => router.push("/visitor/dashboard")}
          >
            Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}

/* ======================================================
   PAGE EXPORT
====================================================== */
export default function VisitorPassPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.stateCard}>Loading…</div>
        </div>
      }
    >
      <VisitorPassContent />
    </Suspense>
  );
}
