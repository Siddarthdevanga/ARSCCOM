"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./style.module.css";

/* ======================================================
   PURE IST DISPLAY (NO TIMEZONE CONVERSION)
   ✔ MySQL datetime  -> Show as IST
   ✔ ISO with TZ     -> Convert properly
   ✔ ISO without TZ  -> Treat as already IST
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  try {
    const str = String(value).trim();
    if (!str) return "-";

    /* ========= MySQL "YYYY-MM-DD HH:MM:SS" ========= */
    if (str.includes(" ")) {
      const [date, time] = str.split(" "); // already IST

      const [y, mo, d] = date.split("-");
      let [h, m] = time.split(":");
      h = parseInt(h, 10);

      const months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
      ];

      const suffix = h >= 12 ? "PM" : "AM";
      const hh = (h % 12) || 12;

      return `${d.padStart(2,"0")} ${months[mo-1]} ${y}, ${String(hh).padStart(2,"0")}:${m} ${suffix}`;
    }

    /* ========= ISO WITH timezone ========= */
    if (str.includes("T") && (str.endsWith("Z") || /[+-]\d\d:?(\d\d)?$/.test(str))) {
      const d = new Date(str);
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    }

    /* ========= ISO WITHOUT timezone (treat as IST) ========= */
    if (str.includes("T")) {
      const [date, time] = str.split("T");

      const [y, mo, d] = date.split("-");
      const [hRaw, m] = time.split(":");
      const h = parseInt(hRaw, 10);

      const months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
      ];

      const suffix = h >= 12 ? "PM" : "AM";
      const hh = (h % 12) || 12;

      return `${d} ${months[mo-1]} ${y}, ${String(hh).padStart(2,"0")}:${m} ${suffix}`;
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
