"use client";
/* ============================================================================
   CARD DOWNLOAD
   One action, both print files: <name>-front.png and <name>-back.png.
   Kept apart from cardArt so the public card page, which imports the
   themes from there, does not pull the QR library into its bundle.
   ========================================================================== */
import QRCode from "qrcode";
import { downloadFace } from "./cardArt";

/* Black modules on white: decoding depends on contrast, and a tinted code
   fails on a meaningful share of scanners. */
export const QR_OPTS = {
  width: 600, margin: 0, errorCorrectionLevel: "M",
  color: { dark: "#000000", light: "#FFFFFF" },
};

/* A name in a non-Latin script strips to nothing; fall back to "card". */
export const fileBase = (name = "") =>
  name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "card";

/* Browsers drop a second download started in the same instant as the
   first, so the back follows a moment later. */
export async function downloadCard(card, { cardUrl, logoSrc, photoSrc, qrSrc }) {
  const qr = qrSrc || await QRCode.toDataURL(cardUrl, QR_OPTS);
  const base = fileBase(card.name);
  const opts = { logoSrc, photoSrc, qrSrc: qr };
  await downloadFace("front", card, opts, `${base}-front.png`);
  await new Promise((r) => setTimeout(r, 400));
  await downloadFace("back", card, opts, `${base}-back.png`);
}
