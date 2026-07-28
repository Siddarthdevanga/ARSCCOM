"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import styles from "./style.module.css";

/* ── Field catalogue — keys must match backend TOGGLEABLE_VISITOR_FIELDS ──
   Subtext only where the field isn't self-explanatory or has a side effect
   worth calling out (Person to Meet, ID Proof, Belongings). Everything else
   is label + toggle, nothing more.

   Flattened (not grouped into per-step cards): with only 1 field in Step 1
   and 1 in Step 3 versus 10 in Step 2, per-step cards left two columns
   mostly empty. Instead every field is its own compact tile carrying a
   small step tag, and a CSS multi-column layout balances tile heights
   across columns automatically regardless of screen size or how many
   fields any given step has. */
const STEP_TAGS = {
  1: { label: "Step 1", color: "#6200d6" },
  2: { label: "Step 2", color: "#0284c7" },
  3: { label: "Step 3", color: "#b45309" },
};

const FIELDS = [
  { key: "email",        label: "Email Address", step: 1 },
  { key: "fromCompany",  label: "From Company", step: 2 },
  { key: "department",   label: "Department", step: 2 },
  { key: "designation",  label: "Designation", step: 2 },
  { key: "address",      label: "Organization Address", step: 2 },
  { key: "city",         label: "City", step: 2 },
  { key: "state",        label: "State", step: 2 },
  { key: "postalCode",   label: "Postal Code", step: 2 },
  { key: "country",      label: "Country", step: 2 },
  { key: "personToMeet", label: "Person to Meet", step: 2, sub: "Disabling this also turns off the approval WhatsApp sent to that employee" },
  { key: "belongings",   label: "Belongings Checklist", step: 2, sub: "Laptop, bag, documents, mobile, camera, other" },
  { key: "idProof",      label: "ID Proof", step: 3, sub: "ID type and ID number together" },
];

export default function FormBuilderPage() {
  const router = useRouter();

  const [company, setCompany]   = useState(null);
  const [fields, setFields]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [toast, setToast]       = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/auth/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/auth/login"); return; }
    fetchFields();
  }, [router]);

  const fetchFields = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/visitor-fields`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load form settings");
      setFields(data.fields);
    } catch (err) {
      setError(err.message || "Unable to load form settings");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const toggleField = async (key) => {
    const nextValue = !fields[key];
    const prev = fields;
    setFields({ ...fields, [key]: nextValue });
    setSavingKey(key);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/settings/visitor-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fields: { [key]: nextValue } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save");
      setFields(data.fields);
      showToast(nextValue ? "Field enabled" : "Field disabled");
    } catch (err) {
      setFields(prev); // revert on failure
      showToast(err.message || "Failed to save change", "error");
    } finally {
      setSavingKey("");
    }
  };

  if (loading || !company) {
    return <div className={styles.container}><div className={styles.loading}>Loading…</div></div>;
  }

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`}>
          {toast.msg}
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company?.name}</div>
        </div>
        <div className={styles.rightHeader}>
          {company?.id && (
            <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`} alt="Logo"
              className={styles.companyLogo} onError={e => { e.currentTarget.style.display = "none"; }} />
          )}
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Back</button>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Form <span>Builder</span></h1>
          <p className={styles.heroSub}>
            Choose which fields appear on your visitor registration form — for both the public
            check-in page and when your team registers a visitor manually.
          </p>
          <div className={styles.lockedNote}>
            <Lock size={12} />
            Name, WhatsApp Number, Photo, and Purpose of Visit are always collected and can&apos;t be turned off.
          </div>
        </section>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {fields && (
          <main className={styles.fieldColumns}>
            {FIELDS.map((item) => {
              const tag = STEP_TAGS[item.step];
              return (
                <div key={item.key} className={styles.toggleTile}>
                  <span className={styles.stepTag} style={{ color: tag.color, borderColor: `${tag.color}33`, background: `${tag.color}14` }}>
                    {tag.label}
                  </span>
                  <div className={styles.toggleRow}>
                    <div>
                      <span className={styles.toggleLabel}>{item.label}</span>
                      {item.sub && <span className={styles.toggleSub}>{item.sub}</span>}
                    </div>
                    <label className={`${styles.toggle} ${savingKey === item.key ? styles.toggleBusy : ""}`}>
                      <input
                        type="checkbox"
                        checked={!!fields[item.key]}
                        disabled={savingKey === item.key}
                        onChange={() => toggleField(item.key)}
                      />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>
                </div>
              );
            })}
          </main>
        )}
      </div>
    </div>
  );
}
