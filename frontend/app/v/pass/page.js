"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
   INNER COMPONENT
====================================================== */
function PublicPassContent() {
  const searchParams = useSearchParams();

  const visitorCode = useMemo(() => {
    const raw = searchParams.get("code") || "";
    // Guard: if WhatsApp passes the full URL as the param value, extract the code from it
    if (raw.startsWith("http")) {
      try {
        const u = new URL(raw);
        return u.searchParams.get("code") || raw;
      } catch { return raw; }
    }
    return raw;
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [visitor, setVisitor] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visitorCode) {
      setError("Invalid visitor pass link");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
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
    load();
    return () => controller.abort();
  }, [visitorCode]);

  /* ===== LOADING ===== */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading visitor pass…</div>
      </div>
    );
  }

  /* ===== ERROR ===== */
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>⚠️</div>
          <h2 className={styles.errorTitle}>Pass Not Found</h2>
          <p className={styles.errorMsg}>{error}</p>
        </div>
        <div className={styles.poweredBy}>Powered by Promeet · Visitor Management</div>
      </div>
    );
  }

  if (!visitor || !company) return null;

  const whatsappUrl = company?.whatsapp_url || null;

  return (
    <div className={styles.page}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <img
          src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`}
          alt={company.name}
          className={styles.logo}
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
        <span className={styles.companyName}>{company.name}</span>
      </header>

      {/* ===== PASS CARD ===== */}
      <main className={styles.card}>
        <div className={styles.badge}>VISITOR PASS</div>

        <div className={styles.photoWrap}>
          {visitor.photoUrl ? (
            <img src={visitor.photoUrl} alt="Visitor" className={styles.photo} />
          ) : (
            <div className={styles.noPhoto}>
              <span>📷</span>
              <small>No Photo</small>
            </div>
          )}
        </div>

        <div className={styles.visitorName}>{visitor.name}</div>
        <div className={styles.code}>{visitor.visitorCode}</div>

        <div className={`${styles.statusBadge} ${visitor.status === "IN" ? styles.statusIn : styles.statusOut}`}>
          {visitor.status === "IN" ? "✓ Checked In" : "Checked Out"}
        </div>

        <div className={styles.divider} />

        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Phone</span>
            <span className={styles.rowValue}>{visitor.phone}</span>
          </div>
          {visitor.email && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Email</span>
              <span className={styles.rowValue}>{visitor.email}</span>
            </div>
          )}
          {visitor.personToMeet && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Meeting</span>
              <span className={styles.rowValue}>{visitor.personToMeet}</span>
            </div>
          )}
          {visitor.purpose && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Purpose</span>
              <span className={styles.rowValue}>{visitor.purpose}</span>
            </div>
          )}
          <div className={styles.row}>
            <span className={styles.rowLabel}>Check-in</span>
            <span className={styles.rowValue}>{formatIST(visitor.checkIn)}</span>
          </div>
          {visitor.checkOut && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Check-out</span>
              <span className={styles.rowValue}>{formatIST(visitor.checkOut)}</span>
            </div>
          )}
        </div>

        {whatsappUrl && (
          <button
            className={styles.whatsappBtn}
            onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
            type="button"
          >
            📱 Join WhatsApp Group
          </button>
        )}
      </main>

      <div className={styles.poweredBy}>Powered by Promeet · Visitor Management</div>
    </div>
  );
}

/* ======================================================
   PAGE WRAPPER WITH SUSPENSE
====================================================== */
export default function PublicPassPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "sans-serif",
          color: "#6c2bd9",
        }}>
          Loading…
        </div>
      }
    >
      <PublicPassContent />
    </Suspense>
  );
}
