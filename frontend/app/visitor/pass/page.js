"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ================= PURE SAFE IST DISPLAY =================
   ✔ No double +5:30
   ✔ Works for ISO / MySQL / Date
   ✔ Immune to browser timezone
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  const format = (d) =>
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  try {
    /* -------- Date object -------- */
    if (value instanceof Date && !isNaN(value)) return format(value);

    value = String(value);

    /* =====================================================
       ISO WITH timezone
       2026-01-06T11:20:20.000Z
       2026-01-06T16:00:00+05:30
    ====================================================== */
    if (
      value.includes("T") &&
      (value.includes("Z") || /[+-]\d\d:?(\d\d)?$/.test(value))
    ) {
      const d = new Date(value);
      return isNaN(d) ? "-" : format(d);
    }

    /* =====================================================
       ISO WITHOUT timezone  (Treat as IST safely)
       2026-01-06T10:42:44
    ====================================================== */
    if (value.includes("T")) {
      const [datePart, timePart] = value.split("T");
      const [hh, mm] = timePart.split(":");

      const temp = new Date(`${datePart}T${hh}:${mm}:00+05:30`);
      return isNaN(temp) ? "-" : format(temp);
    }

    /* =====================================================
       MYSQL → Already IST
       2026-01-06 10:42:44
    ====================================================== */
    if (value.includes(" ")) {
      const [datePart, timePart] = value.split(" ");
      const [y, m, d] = datePart.split("-");
      const [hh, mm] = timePart.split(":");

      const temp = new Date(`${y}-${m}-${d}T${hh}:${mm}:00+05:30`);
      return isNaN(temp) ? "-" : format(temp);
    }

    return "-";
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

        setCompany(data.company);
        setVisitor(data.visitor);
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

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCard}>Loading Visitor Pass…</div>
      </div>
    );
  }

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

            <div className={styles.row}>
              <span>Check-in</span>
              <b>{formatIST(visitor.checkIn)}</b>
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
