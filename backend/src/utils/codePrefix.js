/**
 * Derives a 3-letter, all-caps visitor-code prefix from a company name.
 *   1 word   -> first 3 letters                  ("Zodopt" -> "ZOD")
 *   2 words  -> first 2 letters of word 1 + first letter of word 2
 *               ("Acme Corp" -> "ACC")
 *   3+ words -> first letter of the first 3 words ("Good Business Lab" -> "GBL")
 * Non-letters are stripped before splitting into words. If the cleaned
 * name has fewer letters than needed, the last available letter is
 * repeated to pad out to 3 characters.
 */
export const deriveCodePrefix = (companyName) => {
  const words = String(companyName || "")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);

  let letters = "";
  if (words.length >= 3) {
    letters = words.slice(0, 3).map((w) => w[0]).join("");
  } else if (words.length === 2) {
    letters = words[0].slice(0, 2) + words[1][0];
  } else if (words.length === 1) {
    letters = words[0].slice(0, 3);
  }

  letters = letters.toUpperCase();

  while (letters.length < 3) {
    letters += letters.length > 0 ? letters[letters.length - 1] : "X";
  }

  return letters.slice(0, 3);
};
