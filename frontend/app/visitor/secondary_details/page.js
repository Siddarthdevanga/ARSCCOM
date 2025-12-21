"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./style.module.css";

export default function SecondaryDetails() {
  const router = useRouter();

  const [company, setCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  /* ================= FORM STATE ================= */
  const [form, setForm] = useState({
    fromCompany: "",
    department: "",
    designation: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    personToMeet: "",
    purpose: "",
    belongings: []
  });

  /* ================= LOAD COMPANY + RESTORE FORM ================= */
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedCompany = localStorage.getItem("company");

      if (!token || !storedCompany) {
        router.replace("/auth/login");
        return;
      }

      setCompany(JSON.parse(storedCompany));

      // ✅ Restore saved secondary details
      const saved = localStorage.getItem("visitor_secondary");
      if (saved) {
        setForm(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Company context error:", error);
      localStorage.clear();
      router.replace("/auth/login");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading || !company) return null;

  /* ================= HANDLERS ================= */
  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleBelonging = (item) => {
    setForm(prev => ({
      ...prev,
      belongings: prev.belongings.includes(item)
        ? prev.belongings.filter(b => b !== item)
        : [...prev.belongings, item]
    }));
  };

  const goBack = () => router.back();

  const goNext = () => {
    // ✅ Save secondary details
    localStorage.setItem(
      "visitor_secondary",
      JSON.stringify(form)
    );

    router.push("/visitor/identity");
  };

  return (
    <div className={styles.container}>

      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.logoText}>{company.name}</div>

        {company.logo && (
          <img
            src={company.logo}
            alt={`${company.name} logo`}
            className={styles.companyLogo}
          />
        )}
      </header>

      {/* ================= FORM CARD ================= */}
      <main className={styles.formCard}>
        <h2 className={styles.title}>Visitor Secondary Details</h2>

        {/* ===== ROW 1 ===== */}
        <div className={styles.row3}>
          <input
            value={form.fromCompany}
            onChange={(e) => updateField("fromCompany", e.target.value)}
            placeholder="From Company"
          />
          <input
            value={form.department}
            onChange={(e) => updateField("department", e.target.value)}
            placeholder="Department"
          />
          <input
            value={form.designation}
            onChange={(e) => updateField("designation", e.target.value)}
            placeholder="Designation"
          />
        </div>

        {/* ===== ADDRESS ===== */}
        <div className={styles.fullRow}>
          <input
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            placeholder="Organization Address"
          />
        </div>

        {/* ===== LOCATION ===== */}
        <div className={styles.row3}>
          <input
            value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="City"
          />
          <input
            value={form.state}
            onChange={(e) => updateField("state", e.target.value)}
            placeholder="State"
          />
          <input
            value={form.postalCode}
            onChange={(e) => updateField("postalCode", e.target.value)}
            placeholder="Postal Code"
          />
        </div>

        {/* ===== VISIT DETAILS ===== */}
        <div className={styles.row3}>
          <input
            value={form.country}
            onChange={(e) => updateField("country", e.target.value)}
            placeholder="Country"
          />
          <input
            value={form.personToMeet}
            onChange={(e) => updateField("personToMeet", e.target.value)}
            placeholder="Person to Meet"
          />
          <input
            value={form.purpose}
            onChange={(e) => updateField("purpose", e.target.value)}
            placeholder="Purpose of Visit"
          />
        </div>

        {/* ===== ASSETS ===== */}
        <div className={styles.checkboxGroup}>
          {["Laptop", "Bag", "Documents"].map(item => (
            <label key={item}>
              <input
                type="checkbox"
                checked={form.belongings.includes(item)}
                onChange={() => toggleBelonging(item)}
              />
              {item}
            </label>
          ))}
        </div>

        {/* ================= BUTTONS ================= */}
        <div className={styles.buttonRow}>
          <button className={styles.prevBtn} onClick={goBack}>
            ← Previous
          </button>

          <button className={styles.nextBtn} onClick={goNext}>
            Next →
          </button>
        </div>
      </main>
    </div>
  );
}
