"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "../../../../visitor/primary_details/style.module.css";
import BuilderForm from "../../BuilderForm";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function EditSmartFormPage() {
  const router = useRouter();
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/login"); }
  }, [router]);

  useEffect(() => {
    if (!company || !id) return;
    fetch(`${API}/api/smart-forms/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setForm(d.form); else setError(d.message || "Failed to load"); })
      .catch(() => setError("Failed to load Smart Form"));
  }, [company, id]);

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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a0038", margin: "0 0 1.25rem" }}>Edit Smart Form</h1>
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
          {form && (
            <BuilderForm
              formId={id}
              initial={{ ...form, companyName: company.name }}
              onSaved={() => router.push("/smart-forms/dashboard")}
              onCancel={() => router.push("/smart-forms/dashboard")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
