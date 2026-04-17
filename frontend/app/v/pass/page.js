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
      setError({ message: "Invalid visitor pass link", expired: false });
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
        if (!res.ok) {
          const err = new Error(data?.message || "Visitor not found");
          err.status = res.status;
          throw err;
        }
        setCompany(data.company || null);
        setVisitor(data.visitor || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError({ message: err.message || "Unable to load visitor pass", expired: err.status === 410 });
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
          <div className={styles.errorIcon}>{error.expired ? "⏰" : "⚠️"}</div>
          <h2 className={styles.errorTitle}>
            {error.expired ? "Pass Expired" : "Pass Not Found"}
          </h2>
          <p className={styles.errorMsg}>{error.message}</p>
          {error.expired && (
            <p className={styles.errorMsg} style={{ marginTop: 8, fontSize: 12 }}>
              Visitor passes are valid for 12 hours from check-in.
            </p>
          )}
        </div>
        <div className={styles.poweredBy}>Powered by Promeet · Visitor Management</div>
      </div>
    );
  }

  if (!visitor || !company) return null;

  const whatsappUrl = company?.whatsappUrl || null;

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
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style={{ flexShrink: 0 }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Join {company?.name} Community
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
