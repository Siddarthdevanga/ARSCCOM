/* ======================================================
   SMART FORMS — shared constants
====================================================== */
export const MAX_ACTIVE_FORMS = 2;
export const MAX_FIELDS_PER_FORM = 5;
export const MAX_OPTIONS_PER_FIELD = 20;

export const FIELD_TYPES = [
  "text", "email", "phone", "dropdown", "dependent_dropdown", "rating", "date", "feedback",
];

// Preset light, professional themes — no custom color picker, just pick one.
export const THEMES = {
  purple: { label: "Classic Purple", accent: "#121216", bg: "#f4f4f7" },
  blue:   { label: "Ocean Blue",     accent: "#0369a1", bg: "#f0f9ff" },
  green:  { label: "Emerald Green",  accent: "#047857", bg: "#f0fdf6" },
  slate:  { label: "Slate Neutral",  accent: "#334155", bg: "#f8fafc" },
  amber:  { label: "Warm Amber",     accent: "#b45309", bg: "#fffbeb" },
};
export const THEME_KEYS = Object.keys(THEMES);
export const DEFAULT_THEME = "purple";
