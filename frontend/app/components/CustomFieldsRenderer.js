"use client";

import styles from "./CustomFieldsRenderer.module.css";

/* ═══════════════════════════════════════════════════════════════
   COMPANY-DEFINED CUSTOM FIELDS RENDERER

   Renders a company's custom fields (text / number / dropdown),
   up to 5, each optionally required. Controlled component — the
   parent owns the values object, keyed by field id, since there
   can be several independent fields at once (unlike PurposePicker's
   single uncontrolled purpose value).

   Style-agnostic by design, same as PurposePicker: takes the
   parent page's own input/select class names so it visually
   matches each of the different registration flows.

   Renders nothing when `fields` is empty, so parents can mount it
   unconditionally without an extra guard.
═══════════════════════════════════════════════════════════════ */
export default function CustomFieldsRenderer({
  fields = [],
  values = {},              // { [fieldId]: string }
  onChange,                 // (fieldId, value) => void
  inputClassName,
  selectClassName,
  disabled = false,
}) {
  if (fields.length === 0) return null;

  return (
    <div className={styles.stack}>
      {fields.map((field) => {
        const value = values[field.id] ?? "";
        const label = field.isRequired ? `${field.label} *` : field.label;

        if (field.fieldType === "dropdown") {
          return (
            <select
              key={field.id}
              className={selectClassName}
              value={value}
              disabled={disabled}
              required={field.isRequired}
              onChange={(e) => onChange?.(field.id, e.target.value)}
            >
              <option value="">{`Select ${label}`}</option>
              {field.options.map((opt) => (
                <option key={opt.id} value={opt.label}>{opt.label}</option>
              ))}
            </select>
          );
        }

        return (
          <input
            key={field.id}
            type={field.fieldType === "number" ? "number" : "text"}
            className={inputClassName}
            value={value}
            disabled={disabled}
            required={field.isRequired}
            onChange={(e) => onChange?.(field.id, e.target.value)}
            placeholder={label}
          />
        );
      })}
    </div>
  );
}
