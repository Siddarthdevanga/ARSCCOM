"use client";

import { useState } from "react";
import styles from "./PurposePicker.module.css";

/* ═══════════════════════════════════════════════════════════════
   PURPOSE OF VISIT — CATEGORY / SUB-PURPOSE PICKER

   Company has zero categories  -> plain free-text input (unchanged
   behavior from before this feature existed).

   Company has categories       -> "Purpose" select (their categories
   + a built-in "Others" option) -> if the chosen category has
   sub-purposes, a second "Sub-purpose" select appears -> if "Others"
   is chosen, a free-text box appears instead.

   Style-agnostic by design: takes the parent page's own input/select
   class names so it visually matches each of the three different
   registration flows without needing its own design system. Pass a
   changing `resetKey` prop to force the component back to a blank
   state (e.g. after the parent's own form-reset), since this is an
   uncontrolled component internally.
═══════════════════════════════════════════════════════════════ */
export default function PurposePicker({
  categories = [],
  onChange,               // ({ purpose, purposeCategory, purposeSubcategory }) => void
  inputClassName,
  selectClassName,
  disabled = false,
  freeTextPlaceholder = "Purpose of Visit *",
}) {
  const [category,    setCategory]    = useState("");
  const [subcategory,  setSubcategory] = useState("");
  const [othersText,  setOthersText]  = useState("");
  const [freeText,    setFreeText]    = useState("");

  const currentCategory = categories.find((c) => c.name === category);
  const hasSubcategories = currentCategory && currentCategory.subcategories.length > 0;
  const isOthers = category === "Others";

  const emit = (next) => {
    onChange?.({
      purpose: next.purpose ?? "",
      purposeCategory: next.purposeCategory ?? null,
      purposeSubcategory: next.purposeSubcategory ?? null,
    });
  };

  /* ── No categories configured — plain free text, same as before ── */
  if (categories.length === 0) {
    return (
      <input
        className={inputClassName}
        value={freeText}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          setFreeText(v);
          emit({ purpose: v });
        }}
        placeholder={freeTextPlaceholder}
      />
    );
  }

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setCategory(value);
    setSubcategory("");
    setOthersText("");

    if (!value) { emit({ purpose: "" }); return; }
    if (value === "Others") { emit({ purpose: "", purposeCategory: "Others" }); return; }

    const cat = categories.find((c) => c.name === value);
    if (cat && cat.subcategories.length === 0) {
      emit({ purpose: value, purposeCategory: value });
    } else {
      emit({ purpose: "", purposeCategory: value });
    }
  };

  const handleSubcategoryChange = (e) => {
    const value = e.target.value;
    setSubcategory(value);
    if (!value) { emit({ purpose: "", purposeCategory: category }); return; }
    emit({ purpose: `${category} — ${value}`, purposeCategory: category, purposeSubcategory: value });
  };

  const handleOthersTextChange = (e) => {
    const value = e.target.value;
    setOthersText(value);
    emit({ purpose: value, purposeCategory: "Others", purposeSubcategory: value });
  };

  return (
    <div className={styles.stack}>
      <select className={selectClassName} value={category} disabled={disabled} onChange={handleCategoryChange}>
        <option value="">Select Purpose *</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
        <option value="Others">Others</option>
      </select>

      {category && !isOthers && hasSubcategories && (
        <select className={selectClassName} value={subcategory} disabled={disabled} onChange={handleSubcategoryChange}>
          <option value="">Select Sub-purpose *</option>
          {currentCategory.subcategories.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      )}

      {isOthers && (
        <input
          className={inputClassName}
          value={othersText}
          disabled={disabled}
          onChange={handleOthersTextChange}
          placeholder="Please specify *"
        />
      )}
    </div>
  );
}
