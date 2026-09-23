"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const THEMES = {
  purple: { accent: "#121216", bg: "#f4f4f7" },
  blue:   { accent: "#0369a1", bg: "#f0f9ff" },
  green:  { accent: "#047857", bg: "#f0fdf6" },
  slate:  { accent: "#334155", bg: "#f8fafc" },
  amber:  { accent: "#b45309", bg: "#fffbeb" },
};

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidPhone = (v) => /^\d{10}$/.test(v.replace(/\D/g, ""));

export default function SmartFormPublicPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/public/smart-forms/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { setNotFound(true); return; }
        setForm(d.form);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const theme = THEMES[form?.theme] || THEMES.purple;
  const logoUrl = form?.logoUrl ? `${API}/api/public/smart-forms/${slug}/logo` : (form?.companyId ? `${API}/api/logo/${form.companyId}` : null);

  // Fields that are dependent_dropdown-style, keyed by which parent option
  // is currently selected in their parent field.
  const visibleOptionsFor = (field) => {
    if (!field.parentFieldId) return field.options;
    const parentValue = values[field.parentFieldId];
    return field.options.filter((o) => String(o.parentOptionId) === String(parentValue));
  };

  const handleChange = (fieldId, value) => {
    setValues((prev) => {
      const next = { ...prev, [fieldId]: value };
      // Changing a dropdown clears every dependent field downstream of it,
      // not just its direct child — a chained A→B→C dependency means
      // changing A must also clear C, or C could silently keep a value
      // that's no longer consistent with the new A/B selection.
      const clearDescendants = (parentId) => {
        (form?.fields || []).forEach((f) => {
          if (f.parentFieldId === parentId) {
            next[f.id] = "";
            clearDescendants(f.id);
          }
        });
      };
      clearDescendants(fieldId);
      return next;
    });
    setErrors((prev) => ({ ...prev, [fieldId]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    for (const f of form.fields) {
      const val = (values[f.id] || "").toString().trim();
      if (f.isRequired && !val) { newErrors[f.id] = `${f.label} is required`; continue; }
      if (val && f.fieldType === "email" && !isValidEmail(val)) newErrors[f.id] = "Enter a valid email address";
      if (val && f.fieldType === "phone" && !isValidPhone(val)) newErrors[f.id] = "Enter a valid 10-digit phone number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      // Dropdown/dependent-dropdown values are stored locally as the
      // selected option's id (needed to filter a dependent dropdown's
      // children by parent selection) — translate to the human-readable
      // label before sending, since that's what should appear in reports.
      const valuesForSubmit = {};
      for (const f of form.fields) {
        const raw = values[f.id];
        if (["dropdown", "dependent_dropdown"].includes(f.fieldType) && raw) {
          const opt = f.options.find((o) => String(o.id) === String(raw));
          valuesForSubmit[f.id] = opt?.label || "";
        } else {
          valuesForSubmit[f.id] = raw || "";
        }
      }

      const res = await fetch(`${API}/api/public/smart-forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: valuesForSubmit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to submit");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Centered><p style={{ color: "#9ca3af" }}>Loading…</p></Centered>;
  }

  if (notFound) {
    return (
      <Centered bg="#f8fafc">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#08080c", margin: "0 0 6px" }}>Form Not Found</h1>
          <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 320 }}>
            This QR code is no longer active, or the link is incorrect.
          </p>
        </div>
      </Centered>
    );
  }

  if (submitted) {
    return (
      <Centered bg={theme.bg}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#08080c", margin: "0 0 6px" }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>Your response has been submitted.</p>
        </div>
      </Centered>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: theme.bg, fontFamily: "'Nunito', Arial, sans-serif", padding: "2rem 1rem", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          {logoUrl ? (
            <img src={logoUrl} alt={form.displayName} style={{ width: 64, height: 64, borderRadius: 14, objectFit: "contain", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: 6, marginBottom: 10 }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 14, margin: "0 auto 10px", display: "flex",
              alignItems: "center", justifyContent: "center", background: theme.accent + "22",
              color: theme.accent, fontWeight: 800, fontSize: 26,
            }}>
              {(form.displayName || "?").trim().charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#08080c", margin: form.subtext ? "0 0 4px" : 0 }}>{form.headline}</h1>
          {form.subtext && (
            <p style={{ fontSize: 13.5, color: "#6b7280", margin: 0 }}>{form.subtext}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 18, padding: "1.5rem", boxShadow: "0 8px 30px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {submitError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: 13 }}>
              {submitError}
            </div>
          )}

          {form.fields.map((f) => (
            <FieldInput key={f.id} field={f} value={values[f.id] || ""} error={errors[f.id]}
              options={visibleOptionsFor(f)} accent={theme.accent} onChange={(v) => handleChange(f.id, v)} />
          ))}

          <button type="submit" disabled={submitting}
            style={{ background: theme.accent, color: "#fff", border: "none", padding: "13px", borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: "pointer", marginTop: 4 }}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Centered({ children, bg = "#f4f4f7" }) {
  return (
    <div style={{ minHeight: "100dvh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      {children}
    </div>
  );
}

function FieldInput({ field, value, error, options, accent, onChange }) {
  const baseStyle = {
    width: "100%", padding: "11px 13px", border: `1.5px solid ${error ? "#dc2626" : "#e5e7eb"}`,
    borderRadius: 10, fontSize: 14.5, fontFamily: "inherit", outline: "none",
  };
  const labelStyle = { fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" };

  return (
    <div>
      <label style={labelStyle}>
        {field.label} {field.isRequired && <span style={{ color: "#dc2626" }}>*</span>}
      </label>

      {field.fieldType === "text" && (
        <input style={baseStyle} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.fieldType === "email" && (
        <input type="email" style={baseStyle} value={value} onChange={(e) => onChange(e.target.value)} placeholder="you@example.com" />
      )}
      {field.fieldType === "phone" && (
        <input type="tel" inputMode="numeric" style={baseStyle} value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" />
      )}
      {field.fieldType === "date" && (
        <input type="date" style={baseStyle} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.fieldType === "feedback" && (
        <textarea style={{ ...baseStyle, resize: "vertical", minHeight: 90 }} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.fieldType === "rating" && (
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onChange(String(n))}
              style={{
                width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${accent}`,
                background: Number(value) >= n ? accent : "#fff", color: Number(value) >= n ? "#fff" : accent,
                fontWeight: 800, cursor: "pointer", fontSize: 15,
              }}>
              {n}
            </button>
          ))}
        </div>
      )}
      {(field.fieldType === "dropdown" || field.fieldType === "dependent_dropdown") && (
        <select style={baseStyle} value={value} onChange={(e) => onChange(e.target.value)}
          disabled={field.fieldType === "dependent_dropdown" && options.length === 0}>
          <option value="">
            {field.fieldType === "dependent_dropdown" && options.length === 0 ? "Select the field above first…" : "Select…"}
          </option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 12, fontWeight: 700, margin: "5px 0 0" }}>{error}</p>}
    </div>
  );
}
