/* ======================================================
   CUSTOMIZABLE VISITOR REGISTRATION FIELDS
   ------------------------------------------------------
   Name, WhatsApp Number, Photo, and Purpose of Visit are always
   collected — they aren't in this list because they're never
   toggleable. Everything below defaults to enabled and can be
   turned off per company via Settings > Form Builder.
====================================================== */

export const TOGGLEABLE_VISITOR_FIELDS = [
  "email",
  "fromCompany",
  "department",
  "designation",
  "address",
  "city",
  "state",
  "postalCode",
  "country",
  "personToMeet",
  "belongings",
  "idProof", // covers both ID Type and ID Number together
];

export const DEFAULT_VISITOR_FORM_FIELDS = Object.fromEntries(
  TOGGLEABLE_VISITOR_FIELDS.map((key) => [key, true])
);

/**
 * Merges a raw stored value (possibly null, a JSON string if the driver
 * ever hands one back unparsed, or a partial/legacy object) against the
 * default so every known key is always present and every unknown key is
 * dropped. Never throws — falls back to all-enabled on anything malformed.
 */
export const normalizeVisitorFormFields = (raw) => {
  let parsed = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }

  const safe = { ...DEFAULT_VISITOR_FORM_FIELDS };
  if (parsed && typeof parsed === "object") {
    for (const key of TOGGLEABLE_VISITOR_FIELDS) {
      if (typeof parsed[key] === "boolean") safe[key] = parsed[key];
    }
  }
  return safe;
};
