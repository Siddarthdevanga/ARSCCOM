"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function PublicBookingPage() {
  const { slug } = useParams();

  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    fetch(`${API_BASE}/api/public/conference/company/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Invalid booking link");
        return res.json();
      })
      .then(setCompany)
      .catch(() => setError("Invalid booking link"));
  }, [slug]);

  if (error) {
    return (
      <div className={styles.errorPage}>
        <h2 className={styles.errorText}>{error}</h2>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>{company.name}</h1>
        {company.logo_url && (
          <img
            src={company.logo_url}
            alt="Company Logo"
            className={styles.logo}
          />
        )}
      </header>

      <p className={styles.subtitle}>
        Book a conference room
      </p>

      {/* NEXT STEP: rooms + slots */}
    </div>
  );
}
