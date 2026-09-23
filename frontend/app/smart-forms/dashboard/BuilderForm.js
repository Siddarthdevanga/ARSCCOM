"use client";

import { useState, useRef } from "react";
import layout from "./BuilderForm.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const MAX_FIELDS = 5;
const MAX_OPTIONS = 20;

const FIELD_TYPE_LABELS = {
  text: "Text", email: "Email", phone: "Phone",
  dropdown: "Dropdown", dependent_dropdown: "Dependent Dropdown",
  rating: "Rating (1–5)", date: "Date", feedback: "Feedback (long text)",
};

export const THEMES = {
  purple: { label: "Classic Purple", accent: "#121216", bg: "#f6f1fd" },
  blue:   { label: "Ocean Blue",     accent: "#0369a1", bg: "#f0f9ff" },
  green:  { label: "Emerald Green",  accent: "#047857", bg: "#f0fdf6" },
  slate:  { label: "Slate Neutral",  accent: "#334155", bg: "#f8fafc" },
  amber:  { label: "Warm Amber",     accent: "#b45309", bg: "#fffbeb" },
};

let uidCounter = 0;
const uid = () => `k${Date.now()}_${uidCounter++}`;

const newOption = () => ({ key: uid(), label: "", parentOptionKey: null });
const newField = () => ({ key: uid(), label: "", fieldType: "text", isRequired: false, dependsOnKey: null, options: [] });

const input = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit" };
const label = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 };
const card = { border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem", background: "#fafafa" };

const STEPS = [
  {
    key: "info",
    label: "Basic Info",
    title: "Name, headline & branding",
    explain: "The headline and subtext are the first thing people see when they scan your QR code — keep them short and inviting. The Display Name / Logo Override let this one form look different from your usual company branding — handy for a specific event or campaign. Leave them blank to just use your account's name and logo.",
  },
  {
    key: "theme",
    label: "Theme",
    title: "Pick a color palette",
    explain: "This only changes how the public scan page looks to whoever fills in the form — it has no effect anywhere else in your account. Pick whichever feels closest to your brand.",
  },
  {
    key: "fields",
    label: "Fields",
    title: "What do you want to collect?",
    explain: "Add up to 5 fields — plain text, email or phone (with real format checking), a dropdown, or a Dependent Dropdown, which narrows its own options based on what was picked in an earlier dropdown (e.g. pick a Department, then only see that department's own teams).",
  },
];

export default function BuilderForm({ initial, formId, onSaved, onCancel }) {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [name, setName] = useState(initial?.name || "");
  const [theme, setTheme] = useState(initial?.theme || "purple");
  const [displayNameOverride, setDisplayNameOverride] = useState(initial?.displayNameOverride || "");
  const [headline, setHeadline] = useState(initial?.headline || "");
  const [subtext, setSubtext] = useState(initial?.subtext || "");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(initial?.logoOverrideUrl ? `${API}/api/public/smart-forms/${initial.slug}/logo` : null);
  const fileInputRef = useRef(null);

  const [fields, setFields] = useState(() => {
    if (!initial?.fields?.length) return [newField()];
    // Convert the backend's index-based shape into this component's stable
    // key-based shape, in one pass — all keys are generated up front so
    // dependsOnKey/parentOptionKey can resolve immediately, with no need
    // for a second effect/pass after mount.
    const fieldKeys = initial.fields.map(() => uid());
    const optionKeysByField = initial.fields.map((f) => (f.options || []).map(() => uid()));

    return initial.fields.map((f, i) => ({
      key: fieldKeys[i],
      label: f.label,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      dependsOnKey: typeof f.dependsOnFieldIndex === "number" ? fieldKeys[f.dependsOnFieldIndex] : null,
      options: (f.options || []).map((o, oi) => ({
        key: optionKeysByField[i][oi],
        label: o.label,
        parentOptionKey: typeof o.parentOptionIndex === "number" && typeof f.dependsOnFieldIndex === "number"
          ? optionKeysByField[f.dependsOnFieldIndex][o.parentOptionIndex] ?? null
          : null,
      })),
    }));
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Any field depending on `key` (whether it was removed or just changed
  // away from a dropdown type) falls back to plain text — otherwise it
  // would silently keep pointing at an invalid parent until save time.
  const clearDependentsOn = (list, key) =>
    list.map((f) => (f.dependsOnKey === key ? { ...f, fieldType: "text", dependsOnKey: null, options: [] } : f));

  const updateField = (key, patch) => setFields((prev) => {
    const next = prev.map((f) => (f.key === key ? { ...f, ...patch } : f));
    if ("fieldType" in patch && !["dropdown", "dependent_dropdown"].includes(patch.fieldType)) {
      return clearDependentsOn(next, key);
    }
    return next;
  });

  const addField = () => { if (fields.length < MAX_FIELDS) setFields((prev) => [...prev, newField()]); };

  const removeField = (key) => {
    setFields((prev) => clearDependentsOn(prev.filter((f) => f.key !== key), key));
  };

  // Removing a dropdown option must also drop any dependent-field child
  // options that reference it — otherwise they go invisible (their parent
  // option no longer exists to render them under) but still sit in state,
  // failing validation at save time with no way for the user to see why.
  const removeOptionEverywhere = (fieldKey, optionKey) => {
    setFields((prev) => prev.map((f) => {
      if (f.key === fieldKey) return { ...f, options: f.options.filter((o) => o.key !== optionKey) };
      if (f.dependsOnKey === fieldKey) return { ...f, options: f.options.filter((o) => o.parentOptionKey !== optionKey) };
      return f;
    }));
  };

  const dropdownFieldsBefore = (currentKey) => {
    const idx = fields.findIndex((f) => f.key === currentKey);
    return fields.slice(0, idx).filter((f) => ["dropdown", "dependent_dropdown"].includes(f.fieldType));
  };

  const handleNext = () => {
    if (step === 0 && !name.trim()) { setStepError("Give this Smart Form a name before continuing"); return; }
    setStepError("");
    setError(""); // clear any stale save error from a previous attempt on the last step
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const handleBack = () => {
    setStepError("");
    setError(""); // same — a failed-save message shouldn't linger on an earlier step
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSave = async () => {
    setError("");
    if (!name.trim()) { setError("Give this Smart Form a name"); return; }
    if (fields.some((f) => !f.label.trim())) { setError("Every field needs a label"); return; }
    for (const f of fields) {
      if (["dropdown", "dependent_dropdown"].includes(f.fieldType)) {
        if (!f.options.length || f.options.some((o) => !o.label.trim())) {
          setError(`"${f.label}" needs at least one option, and every option needs a label`);
          return;
        }
      }
      if (f.fieldType === "dependent_dropdown" && !f.dependsOnKey) {
        setError(`"${f.label}" needs a parent dropdown to depend on`);
        return;
      }
      if (f.fieldType === "dependent_dropdown" && f.options.some((o) => !o.parentOptionKey)) {
        setError(`Every option in "${f.label}" must be linked to a parent option`);
        return;
      }
    }

    const fieldIndexByKey = new Map(fields.map((f, i) => [f.key, i]));

    const payload = {
      name: name.trim(),
      theme,
      displayNameOverride: displayNameOverride.trim() || undefined,
      headline: headline.trim() || undefined,
      subtext: subtext.trim() || undefined,
      fields: fields.map((f) => {
        const dependsOnFieldIndex = f.fieldType === "dependent_dropdown" ? fieldIndexByKey.get(f.dependsOnKey) : undefined;
        const parentField = dependsOnFieldIndex !== undefined ? fields[dependsOnFieldIndex] : null;
        const parentOptionIndexByKey = parentField ? new Map(parentField.options.map((o, i) => [o.key, i])) : null;
        return {
          label: f.label.trim(),
          fieldType: f.fieldType,
          isRequired: !!f.isRequired,
          ...(dependsOnFieldIndex !== undefined ? { dependsOnFieldIndex } : {}),
          options: ["dropdown", "dependent_dropdown"].includes(f.fieldType)
            ? f.options.map((o) => ({
                label: o.label.trim(),
                ...(f.fieldType === "dependent_dropdown" ? { parentOptionIndex: parentOptionIndexByKey.get(o.parentOptionKey) } : {}),
              }))
            : undefined,
        };
      }),
    };

    setSaving(true);
    try {
      const url = formId ? `${API}/api/smart-forms/${formId}` : `${API}/api/smart-forms`;
      const res = await fetch(url, {
        method: formId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save Smart Form");

      const savedId = formId || data.form?.id;
      if (logoFile && savedId) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await fetch(`${API}/api/smart-forms/${savedId}/logo`, { method: "PUT", credentials: "include", body: fd });
      }

      onSaved?.(savedId);
    } catch (err) {
      setError(err.message || "Failed to save Smart Form");
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className={layout.wrap}>
      {/* Step indicator */}
      <div className={layout.stepRow}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={`${layout.stepDot} ${i === step ? layout.stepDotActive : ""} ${i < step ? layout.stepDotDone : ""}`}>
              <span className={layout.stepCircle}>{i < step ? "✓" : i + 1}</span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className={layout.stepLine} />}
          </div>
        ))}
      </div>

      {(error || stepError) && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: 13 }}>
          {error || stepError}
        </div>
      )}

      <div className={layout.layout}>
        {/* LEFT — the actual step content */}
        <div className={layout.leftCol}>
          {step === 0 && (
            <div style={card}>
              <label style={label}>Form Name (internal reference)</label>
              <input style={{ ...input, marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trade Show Booth A" />

              <label style={label}>Headline (shown on the scan page)</label>
              <input style={{ ...input, marginBottom: 12 }} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="We'd love your feedback!" maxLength={150} />

              <label style={label}>Subtext</label>
              <input style={{ ...input, marginBottom: 12 }} value={subtext} onChange={(e) => setSubtext(e.target.value)} placeholder="Takes less than a minute" maxLength={300} />

              <label style={label}>Display Name Override (optional — defaults to your company name)</label>
              <input style={{ ...input, marginBottom: 12 }} value={displayNameOverride} onChange={(e) => setDisplayNameOverride(e.target.value)} placeholder={initial?.companyName || "Your company name"} />

              <label style={label}>Logo Override (optional — defaults to your company logo)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {logoPreview && <img src={logoPreview} alt="Logo preview" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid #e5e7eb" }} />}
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ ...input, width: "auto", cursor: "pointer", background: "#fff" }}>
                  Upload Logo
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
                }} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={card}>
              <label style={label}>Theme</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {Object.entries(THEMES).map(([key, t]) => (
                  <button key={key} type="button" onClick={() => setTheme(key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10,
                      border: theme === key ? `2px solid ${t.accent}` : "1.5px solid #e5e7eb",
                      background: t.bg, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#08080c",
                    }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: t.accent, display: "inline-block" }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <label style={{ ...label, marginBottom: 0 }}>Fields ({fields.length}/{MAX_FIELDS})</label>
                <button type="button" onClick={addField} disabled={fields.length >= MAX_FIELDS}
                  style={{ background: fields.length >= MAX_FIELDS ? "#e5e7eb" : "#121216", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: fields.length >= MAX_FIELDS ? "not-allowed" : "pointer" }}>
                  + Add Field
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {fields.map((f, idx) => (
                  <FieldEditor key={f.key} field={f} index={idx}
                    onChange={(patch) => updateField(f.key, patch)}
                    onRemove={fields.length > 1 ? () => removeField(f.key) : null}
                    onRemoveOption={(optionKey) => removeOptionEverywhere(f.key, optionKey)}
                    dependsOnOptions={dropdownFieldsBefore(f.key)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — brief explanation of the current step */}
        <div className={layout.rightCol}>
          <div className={layout.explainCard}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#121216", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
              Step {step + 1} of {STEPS.length}
            </p>
            <h3 style={{ fontSize: 14.5, fontWeight: 800, color: "#08080c", margin: "0 0 8px" }}>{currentStep.title}</h3>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{currentStep.explain}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        {step === 0 && onCancel && (
          <button onClick={onCancel} disabled={saving} style={{ ...input, width: "auto", padding: "10px 20px", background: "#fff", cursor: "pointer" }}>Cancel</button>
        )}
        {step > 0 && (
          <button onClick={handleBack} disabled={saving} style={{ ...input, width: "auto", padding: "10px 20px", background: "#fff", cursor: "pointer" }}>← Back</button>
        )}
        {!isLastStep ? (
          <button onClick={handleNext}
            style={{ background: "linear-gradient(135deg,#121216,#242428)", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Next →
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving}
            style={{ background: "linear-gradient(135deg,#121216,#242428)", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {saving ? "Saving…" : formId ? "Save Changes" : "Create Smart Form"}
          </button>
        )}
      </div>
    </div>
  );
}

function FieldEditor({ field, index, onChange, onRemove, onRemoveOption, dependsOnOptions }) {
  const isDropdownType = ["dropdown", "dependent_dropdown"].includes(field.fieldType);
  const parentField = dependsOnOptions.find((f) => f.key === field.dependsOnKey) || null;

  const addOption = () => {
    if (field.options.length >= MAX_OPTIONS) return;
    onChange({ options: [...field.options, newOption()] });
  };
  const updateOption = (key, patch) => onChange({ options: field.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });

  return (
    <div style={{ border: "1px solid #e9e9ec", borderRadius: 10, padding: "0.85rem", background: "#fff" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 140 }}>
          <label style={label}>Field {index + 1} Label</label>
          <input style={input} value={field.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Full Name" />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={label}>Type</label>
          <select style={input} value={field.fieldType} onChange={(e) => {
            const fieldType = e.target.value;
            onChange({
              fieldType,
              options: ["dropdown", "dependent_dropdown"].includes(fieldType) ? (field.options.length ? field.options : [newOption()]) : [],
              dependsOnKey: fieldType === "dependent_dropdown" ? field.dependsOnKey : null,
            });
          }}>
            {Object.entries(FIELD_TYPE_LABELS).map(([val, lbl]) => (
              <option key={val} value={val} disabled={val === "dependent_dropdown" && dependsOnOptions.length === 0}>{lbl}</option>
            ))}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#374151", paddingBottom: 9 }}>
          <input type="checkbox" checked={field.isRequired} onChange={(e) => onChange({ isRequired: e.target.checked })} />
          Required
        </label>
        {onRemove && (
          <button type="button" onClick={onRemove} style={{ background: "#fef2f2", color: "#b91c1c", border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Remove
          </button>
        )}
      </div>

      {field.fieldType === "dependent_dropdown" && (
        <div style={{ marginTop: 10 }}>
          <label style={label}>Depends On</label>
          <select style={input} value={field.dependsOnKey || ""} onChange={(e) => onChange({ dependsOnKey: e.target.value || null, options: [] })}>
            <option value="">Select parent dropdown…</option>
            {dependsOnOptions.map((f) => <option key={f.key} value={f.key}>{f.label || "(unnamed field)"}</option>)}
          </select>
        </div>
      )}

      {isDropdownType && (
        <div style={{ marginTop: 10 }}>
          <label style={label}>Options</label>
          {field.fieldType === "dependent_dropdown" && !parentField ? (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>Pick a parent dropdown first.</p>
          ) : field.fieldType === "dependent_dropdown" ? (
            <DependentOptionsEditor field={field} parentField={parentField} onChange={onChange} onRemoveOption={onRemoveOption} />
          ) : (
            <>
              {field.options.map((o) => (
                <div key={o.key} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input style={input} value={o.label} onChange={(e) => updateOption(o.key, { label: e.target.value })} placeholder="Option label" />
                  <button type="button" onClick={() => onRemoveOption(o.key)} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "0 10px", cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <button type="button" onClick={addOption} disabled={field.options.length >= MAX_OPTIONS} style={{ fontSize: 12, fontWeight: 700, color: "#121216", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                + Add option
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DependentOptionsEditor({ field, parentField, onChange, onRemoveOption }) {
  const addChild = (parentOptionKey) => {
    if (field.options.length >= MAX_OPTIONS) return;
    onChange({ options: [...field.options, { ...newOption(), parentOptionKey }] });
  };
  const updateChild = (key, patch) => onChange({ options: field.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  // A dependent dropdown can itself be the parent of a further dependent
  // dropdown (chained), so removing one of ITS options must cascade the
  // same way — hence onRemoveOption, not a local-only filter.
  const removeChild = (key) => onRemoveOption(key);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {parentField.options.filter((po) => po.label.trim()).map((po) => (
        <div key={po.key} style={{ border: "1px dashed #d9d9dc", borderRadius: 8, padding: "0.6rem" }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "#121216", textTransform: "uppercase", marginBottom: 6 }}>
            When "{po.label}" is selected:
          </div>
          {field.options.filter((o) => o.parentOptionKey === po.key).map((o) => (
            <div key={o.key} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input style={input} value={o.label} onChange={(e) => updateChild(o.key, { label: e.target.value })} placeholder="Sub-option label" />
              <button type="button" onClick={() => removeChild(o.key)} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "0 10px", cursor: "pointer" }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => addChild(po.key)} style={{ fontSize: 11.5, fontWeight: 700, color: "#121216", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            + Add sub-option
          </button>
        </div>
      ))}
      {!parentField.options.some((po) => po.label.trim()) && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>Add options to the parent dropdown first.</p>
      )}
    </div>
  );
}
