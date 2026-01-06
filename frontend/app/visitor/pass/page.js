"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ================= PURE SAFE IST DISPLAY =================
   Handles BOTH:
   1️⃣ 2026-01-06 10:42:44  (already IST)
   2️⃣ 2026-01-06T11:20:20.000Z (UTC ISO → convert to IST manually)
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  /* ---------- CASE 1: ISO UTC TIMESTAMP ---------- */
  if (value.includes("T")) {
    try {
      const [datePart, timePartFull] = value.split("T");
      const timePart = timePartFull.split(".")[0]; // HH:MM:SS
      let [h, m, s] = timePart.split(":").map(Number);

      // Add +5:30 manually
      let totalMinutes = h * 60 + m + 330;

      let finalH = Math.floor(totalMinutes / 60) % 24;
      let finalM = totalMinutes % 60;

      const suffix = finalH >= 12 ? "PM" : "AM";
      finalH = finalH % 12 || 12;

      const [yyyy, mm, dd] = datePart.split("-");
      const monthNames = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
      ];
      const monthName = monthNames[parseInt(mm) - 1];

      return `${dd} ${monthName} ${yyyy}, ${finalH}:${String(finalM).padStart(2,"0")} ${suffix}`;
    } catch {
      return value;
    }
  }

  /* ---------- CASE 2: NORMAL MYSQL ---------- */
  const parts = value.split(" ");
  if (parts.length < 2) return value;

  const date = parts[0];       // YYYY-MM-DD
  const time = parts[1];       // HH:MM:SS

  const [y, mo, d] = date.split("-");
  let [h, m] = time.split(":");

  h = parseInt(h, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;

  const monthNames = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];
  const monthName = monthNames[parseInt(mo, 10) - 1] || "";

  return `${d} ${monthName} ${y}, ${h}:${m} ${suffix}`;
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
