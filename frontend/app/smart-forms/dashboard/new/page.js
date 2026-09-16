"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../visitor/primary_details/style.module.css";
import BuilderForm from "../BuilderForm";

export default function NewSmartFormPage() {
  const router = useRouter();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/login"); }
  }, [router]);

  if (!company) return <div className={styles.container}><div className={styles.loading}>Loading…</div></div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}><div className={styles.logoText}>{company.name}</div></div>
        <div className={styles.rightHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/smart-forms/dashboard")}>← Back</button>
        </div>
      </header>
      <div className={styles.scrollBody}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a0038", margin: "0 0 1.25rem" }}>New Smart Form</h1>
          <BuilderForm
            initial={{ companyName: company.name }}
            onSaved={() => router.push("/smart-forms/dashboard")}
            onCancel={() => router.push("/smart-forms/dashboard")}
          />
        </div>
      </div>
    </div>
  );
}
