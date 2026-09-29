/* ============================================================================
   CARD VALIDATION
   Shared by the card editor and the public share form. The API applies the
   same rules (services/digitalCard.service.js); these exist so the admin
   sees the problem beside the field instead of after a round trip.

   India is the default country: a bare 10-digit number is taken as +91.
   Any other country needs its code, written with a leading "+".
   ========================================================================== */

const PHONE_CHARS = /^\+?[\d\s\-().]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// A web address: optional http(s)://, a dotted host, then an optional path.
const LINK = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i;

export const phoneError = (v = "") => {
  const s = String(v).trim();
  if (!s) return "";
  if (!PHONE_CHARS.test(s)) return "Use digits only, with an optional + country code";
  const d = s.replace(/\D/g, "");
  if (s.startsWith("+")) {
    if (d.startsWith("91")) return d.length === 12 ? "" : "An Indian number has 10 digits after +91";
    return d.length >= 8 && d.length <= 15 ? "" : "Enter a valid number with its country code";
  }
  const local = d.replace(/^0/, "");
  if (local.length === 10) return "";
  if (d.length === 12 && d.startsWith("91")) return "";
  return "Enter a 10-digit number, or add the country code with +";
};

export const emailError = (v = "") =>
  !String(v).trim() || EMAIL.test(String(v).trim()) ? "" : "Enter a valid email address";

export const linkError = (v = "") =>
  !String(v).trim() || LINK.test(String(v).trim()) ? "" : "Enter a web address, like example.com/page";

/* Every problem on the card form, keyed by field. Empty means valid. */
export function validateCard(form, { waSame = true, briefWords = 0, briefLimit = Infinity } = {}) {
  const e = {};
  if (!form.name?.trim()) e.name = "Name is required";
  if (!form.phone?.trim()) e.phone = "Phone is required";
  else if (phoneError(form.phone)) e.phone = phoneError(form.phone);
  if (!waSame) {
    if (!form.whatsapp?.trim()) e.whatsapp = "Add the WhatsApp number, or tick the box above";
    else if (phoneError(form.whatsapp)) e.whatsapp = phoneError(form.whatsapp);
  }
  if (emailError(form.email)) e.email = emailError(form.email);
  if (linkError(form.linkedin)) e.linkedin = linkError(form.linkedin);
  if (briefWords > briefLimit) e.brief = `Keep the brief to ${briefLimit} words or fewer`;

  for (const n of [1, 2]) {
    const label = form[`custom${n}_label`]?.trim();
    const value = form[`custom${n}_value`]?.trim();
    // Half a custom field is never shown on the card, so it is almost
    // certainly a mistake rather than a choice.
    if (label && !value) e[`custom${n}_value`] = "Add a value, or clear the label";
    else if (value && !label) e[`custom${n}_label`] = "Add a label for this value";
    else if (value && form[`custom${n}_type`] === "link" && linkError(value)) {
      e[`custom${n}_value`] = linkError(value);
    }
  }
  return e;
}
