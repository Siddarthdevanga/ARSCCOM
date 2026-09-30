/**
 * utils/cardArt.node.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Visiting card artwork, drawn on the server with node-canvas.
 *
 * Two jobs:
 *   - A claimed card's front and back as PNGs, for its welcome email. This
 *     is a port of frontend/app/home/cards/cardArt.js (drawFront/drawBack);
 *     the two are separate deployments, so the drawing is duplicated. Any
 *     change to the card layout there must be made here too.
 *   - The blank pool cards (Haivisitor front, QR back), a company's empty
 *     QR cards (company front, QR back), and the A4 sheet both are printed
 *     from. Those exist only here.
 *
 * Every face is drawn at an origin with a scale, so the same routine paints
 * a 1004x650 PNG or a card on a PDF page in points, as vectors.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage, registerFont } from "canvas";
import QRCode from "qrcode";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const CARD_W = 1004;
export const CARD_H = 650;

/* Segoe UI where it exists (Windows dev); Noto on the Linux servers, as the
   visitor pass does. Pango takes the list and uses the first it has. */
const NOTO = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf";
const NOTO_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf";
try {
  if (fs.existsSync(NOTO)) registerFont(NOTO, { family: "CardSans" });
  if (fs.existsSync(NOTO_BOLD)) registerFont(NOTO_BOLD, { family: "CardSans", weight: "bold" });
} catch { /* the system sans-serif is an acceptable fallback */ }
const FONT = "'Segoe UI', CardSans, Arial, sans-serif";

/* Same presets as the frontend. */
export const THEMES = {
  ink:       { bg: "#0c0c0f", fg: "#ffffff", accent: "#f5a524" },
  amber:     { bg: "#1a1408", fg: "#ffffff", accent: "#ffc75f" },
  sky:       { bg: "#071722", fg: "#ffffff", accent: "#38bdf8" },
  mint:      { bg: "#04150e", fg: "#ffffff", accent: "#34d399" },
  violet:    { bg: "#120c22", fg: "#ffffff", accent: "#a78bfa" },
  paper:     { bg: "#ffffff", fg: "#17171a", accent: "#b45309" },
  cream:     { bg: "#faf5e8", fg: "#1c1917", accent: "#a16207" },
  cloud:     { bg: "#eef0f3", fg: "#111827", accent: "#1d4ed8" },
  skylight:  { bg: "#e8f4fb", fg: "#0b2a3c", accent: "#0369a1" },
  mintlight: { bg: "#e9f7f0", fg: "#0b2e20", accent: "#047857" },
  blush:     { bg: "#fcefed", fg: "#3b0d0c", accent: "#be123c" },
};

const resolveColors = (card = {}) => {
  const preset = THEMES[card.theme] || THEMES.ink;
  return {
    bg:     card.bg_color     || preset.bg,
    fg:     card.text_color   || preset.fg,
    accent: card.accent_color || preset.accent,
  };
};

export const QR_OPTS = {
  width: 600, margin: 0, errorCorrectionLevel: "M",
  color: { dark: "#000000", light: "#FFFFFF" },
};

/* ── Helpers (as in the frontend) ─────────────────────────────────────── */
const toRgb = (hex = "#000") => {
  const h = String(hex).replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const alpha = (hex, a) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const fitText = (ctx, text, maxWidth) => {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
};

const wrapText = (ctx, text, maxLines, widthOf) => {
  if (maxLines < 1) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (!cur || ctx.measureText(next).width <= widthOf(lines.length)) { cur = next; continue; }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines) { lines.push(cur); cur = ""; }
  const out = lines.map((ln, k) => fitText(ctx, ln, widthOf(k)));
  const last = out.length - 1;
  if (i < words.length && !out[last].endsWith("…")) {
    out[last] = fitText(ctx, `${out[last]}…`, widthOf(last)).replace(/……$/, "…");
  }
  return out;
};

/* A missing or corrupt image must never stop a card from rendering. */
export const safeImage = async (src) => {
  if (!src) return null;
  try { return await loadImage(src); } catch { return null; }
};

/* Everything below draws in card units (1004x650) inside a save/restore
   that moves to (x, y) and scales, so callers pick the output size. */
const inCard = (ctx, x, y, scale, fn) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, CARD_W, CARD_H);
  ctx.clip();
  fn();
  ctx.restore();
};

/* ── A person's card: FRONT ───────────────────────────────────────────── */
export function paintFront(ctx, card, { logo = null, photo = null } = {}, x = 0, y0 = 0, scale = 1) {
  inCard(ctx, x, y0, scale, () => {
    const W = CARD_W, H = CARD_H;
    const { bg, fg, accent } = resolveColors(card);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 14, H);

    const left = 74;
    const right = W - 60;
    const maxText = right - left;

    if (logo) {
      const h = 56;
      const w = (logo.width / logo.height) * h;
      ctx.drawImage(logo, left, 58, Math.min(w, 220), h);
    }

    const shownPhoto = card.photo_on_print ? photo : null;
    const D = 176;
    if (shownPhoto) {
      const px = right - D, py = 58, r = D / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + r, py + r, r, 0, Math.PI * 2);
      ctx.clip();
      const k = Math.max(D / shownPhoto.width, D / shownPhoto.height);
      const w = shownPhoto.width * k, h = shownPhoto.height * k;
      ctx.drawImage(shownPhoto, px + (D - w) / 2, py + (D - h) / 2, w, h);
      ctx.restore();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px + r, py + r, r - 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    const headText = shownPhoto ? maxText - D - 28 : maxText;

    let y = logo ? 212 : 180;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = fg;
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText(fitText(ctx, card.name || "", headText), left, y);

    if (card.job_title) {
      y += 52;
      ctx.fillStyle = accent;
      ctx.font = `600 28px ${FONT}`;
      ctx.fillText(fitText(ctx, card.job_title, headText), left, y);
    }
    if (card.company_name) {
      y += 40;
      ctx.fillStyle = alpha(fg, 0.62);
      ctx.font = `500 25px ${FONT}`;
      ctx.fillText(fitText(ctx, card.company_name, headText), left, y);
    }

    const lineY = H - 160;
    if (card.brief?.trim()) {
      const ruleY = y + 30;
      ctx.fillStyle = accent;
      ctx.fillRect(left, ruleY, 44, 3);
      ctx.fillStyle = alpha(fg, 0.7);
      ctx.font = `400 22px ${FONT}`;
      const lineH = 32;
      const first = ruleY + 42;
      const room = Math.floor((lineY - 22 - (first - 21)) / lineH);
      const widthAt = (ly) => (shownPhoto && ly - 21 < 58 + D + 12 ? headText : maxText);
      const lines = wrapText(ctx, card.brief.trim(), Math.min(3, room), (i) => widthAt(first + i * lineH));
      lines.forEach((ln, i) => ctx.fillText(ln, left, first + i * lineH));
    }
    ctx.fillStyle = alpha(fg, 0.16);
    ctx.fillRect(left, lineY, maxText, 1.5);

    const contacts = [card.phone, card.email].filter(Boolean);
    ctx.font = `500 24px ${FONT}`;
    ctx.fillStyle = alpha(fg, 0.85);
    contacts.forEach((line, i) => {
      ctx.fillText(fitText(ctx, line, maxText), left, lineY + 46 + i * 36);
    });
  });
}

/* ── A person's card: BACK ────────────────────────────────────────────── */
export function paintBack(ctx, card, { qr = null } = {}, x = 0, y0 = 0, scale = 1) {
  inCard(ctx, x, y0, scale, () => {
    const W = CARD_W, H = CARD_H;
    const { bg, fg, accent } = resolveColors(card);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 14);

    const box = 300;
    const bx = (W - box) / 2;
    const by = 120;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, bx - 18, by - 18, box + 36, box + 36, 18);
    ctx.fill();
    if (qr) ctx.drawImage(qr, bx, by, box, box);

    ctx.textAlign = "center";
    ctx.fillStyle = alpha(fg, 0.78);
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText("Scan for my details", W / 2, by + box + 78);

    if (card.name) {
      ctx.fillStyle = alpha(fg, 0.45);
      ctx.font = `500 21px ${FONT}`;
      ctx.fillText(fitText(ctx, card.name, W - 120), W / 2, by + box + 116);
    }

    ctx.fillStyle = alpha(fg, 0.34);
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText("Digital card by Haivisitor", W / 2, H - 46);
    ctx.textAlign = "left";
  });
}

/* ── Blank pool card: FRONT ───────────────────────────────────────────────
   The login page's brand block: the V mark, "Zodopt's", and the
   "H[ai] Visitor" wordmark with "ai" in yellow, on near-black. */
const INK = "#0c0c0f";
const AMBER = "#f5a524";
const WORDMARK_AI = "#FAB72A";
let markPromise = null;
const brandMark = () => {
  markPromise ??= safeImage(path.join(HERE, "..", "assets", "haivisitor-mark.png"));
  return markPromise;
};

/* The V mark on its black roundel, for the footer of a company card. */
let vMarkPromise = null;
export const brandVMark = () => {
  vMarkPromise ??= safeImage(path.join(HERE, "..", "assets", "haivisitor-vmark.png"));
  return vMarkPromise;
};

export function paintBlankFront(ctx, { mark = null } = {}, x = 0, y0 = 0, scale = 1) {
  inCard(ctx, x, y0, scale, () => {
    const W = CARD_W, H = CARD_H;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#121214");
    g.addColorStop(1, "#050505");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Amber hairline, as on every other surface in the product.
    ctx.fillStyle = AMBER;
    ctx.fillRect(0, H - 10, W, 10);

    const cx = W / 2;
    if (mark) ctx.drawImage(mark, cx - 105, 70, 210, 210);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255, 255, 255, 0.46)";
    ctx.font = `700 22px ${FONT}`;
    spaced(ctx, "ZODOPT’S", cx, 336, 7);

    // "H" + yellow "ai" + " Visitor", centred as one run.
    ctx.font = `800 86px ${FONT}`;
    const parts = [["H", "#ffffff"], ["ai", WORDMARK_AI], [" Visitor", "#ffffff"]];
    const widths = parts.map(([t]) => ctx.measureText(t).width);
    let tx = cx - widths.reduce((a, b) => a + b, 0) / 2;
    const base = 440;

    ctx.textAlign = "left";
    parts.forEach(([t, colour], i) => {
      ctx.fillStyle = colour;
      ctx.fillText(t, tx, base);
      tx += widths[i];
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(cx - 230, 486, 460, 1.5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = `600 21px ${FONT}`;
    spaced(ctx, "DIGITAL VISITING CARD", cx, 530, 4);
    ctx.textAlign = "left";
  });
}

/* Letter-spaced text, centred on cx. canvas has no letterSpacing in
   node-canvas, so each glyph is placed by hand. */
const spaced = (ctx, text, cx, y, track) => {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - total / 2;
  chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i] + track; });
  ctx.textAlign = prevAlign;
};

/* ── Blank pool card: BACK ────────────────────────────────────────────── */
export function paintBlankBack(ctx, { qr = null, serial = "" } = {}, x = 0, y0 = 0, scale = 1) {
  inCard(ctx, x, y0, scale, () => {
    const W = CARD_W, H = CARD_H;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = AMBER;
    ctx.fillRect(0, 0, W, 14);

    // Bigger than a person's card: this QR is the whole card. Centred a
    // little above the middle, leaving room for the serial underneath.
    const box = 360;
    const bx = (W - box) / 2;
    const by = 120;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, bx - 20, by - 20, box + 40, box + 40, 20);
    ctx.fill();
    if (qr) ctx.drawImage(qr, bx, by, box, box);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (serial) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
      ctx.font = `600 17px ${FONT}`;
      // Clear of the bottom 3 mm, which a print trim can take off.
      ctx.fillText(serial, W / 2, H - 46);
    }
    ctx.textAlign = "left";
  });
}

/* ── A company's empty QR card: FRONT ─────────────────────────────────────
   Handed to an employee before they fill it in, and theirs for good after,
   so it carries only what never changes: the company's logo and name, on
   the colours the admin chose. */
export function paintCompanyBlankFront(ctx, { logo = null, name = "", card = {}, roundLogo = false } = {}, x = 0, y0 = 0, scale = 1) {
  inCard(ctx, x, y0, scale, () => {
    const W = CARD_W, H = CARD_H;
    const { bg, fg, accent } = resolveColors(card);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent;
    ctx.fillRect(0, H - 12, W, 12);

    const cx = W / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Logo in a box that keeps its shape; the name sits under it, or takes
    // the middle on its own when there is no logo.
    if (logo) {
      const maxW = 520, maxH = 180;
      const k = Math.min(maxW / logo.width, maxH / logo.height);
      const w = logo.width * k, h = logo.height * k;
      const lx = cx - w / 2, ly = 92 + (maxH - h) / 2;
      ctx.save();
      // The Hai Visitor V mark is a square image of a roundel: clipped to
      // the circle, so no black box shows around it.
      if (roundLogo) {
        ctx.beginPath();
        ctx.arc(lx + w / 2, ly + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
        ctx.clip();
      }
      drawSharp(ctx, logo, lx, ly, w, h);
      ctx.restore();
    }
    if (name) {
      ctx.fillStyle = fg;
      const { size, lines } = nameLines(ctx, name, W - 140, logo ? 54 : 66, 34);
      const lineH = size * 1.18;
      const mid = logo ? 385 : 270;
      const first = mid - ((lines.length - 1) * lineH) / 2 + size * 0.36;
      lines.forEach((ln, i) => ctx.fillText(ln, cx, first + i * lineH));
    }

    ctx.fillStyle = alpha(fg, 0.16);
    ctx.fillRect(cx - 200, H - 150, 400, 1.5);
    ctx.fillStyle = alpha(fg, 0.62);
    ctx.font = `600 20px ${FONT}`;
    spaced(ctx, "DIGITAL VISITING CARD", cx, H - 104, 4);
    ctx.textAlign = "left";
  });
}

/* ── A company's empty QR card: BACK ─────────────────────────────────────
   The QR, and the Hai Visitor mark and wordmark as a footer. A Hai Visitor
   pool card has no footer (its front is already the brand), so its QR sits
   lower, centred in the space. */
export function paintCompanyBlankBack(ctx, { qr = null, mark = null, card = {}, footer = true } = {}, x = 0, y0 = 0, scale = 1) {
  inCard(ctx, x, y0, scale, () => {
    const W = CARD_W, H = CARD_H;
    const { bg, fg, accent } = resolveColors(card);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 14);

    const box = 320;
    const bx = (W - box) / 2;
    const by = footer ? 84 : 140;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, bx - 20, by - 20, box + 40, box + 40, 20);
    ctx.fill();
    if (qr) drawSharp(ctx, qr, bx, by, box, box);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = alpha(fg, 0.78);
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText("Scan for my details", W / 2, by + box + 70);

    // Clear of the bottom 3 mm, which a print trim can take off.
    if (footer) brandLockup(ctx, { mark, fg, cx: W / 2, base: H - 58 });
    ctx.textAlign = "left";
  });
}

/* The Hai Visitor mark (a black roundel, so it reads on any card colour)
   and "H[ai] Visitor", centred as one run on cx. */
const brandLockup = (ctx, { mark, fg, cx, base }) => {
  const D = 40, gap = 12;
  ctx.font = `800 28px ${FONT}`;
  const parts = [["H", alpha(fg, 0.78)], ["ai", WORDMARK_AI], [" Visitor", alpha(fg, 0.78)]];
  const widths = parts.map(([t]) => ctx.measureText(t).width);
  const textW = widths.reduce((a, b) => a + b, 0);
  let tx = cx - (textW + (mark ? D + gap : 0)) / 2;
  if (mark) {
    const my = base - 10 - D / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(tx + D / 2, my + D / 2, D / 2, 0, Math.PI * 2);
    ctx.clip();
    drawSharp(ctx, mark, tx, my, D, D);
    ctx.restore();
    tx += D + gap;
  }
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  parts.forEach(([t, colour], i) => {
    ctx.fillStyle = colour;
    ctx.fillText(t, tx, base);
    tx += widths[i];
  });
  ctx.textAlign = prev;
};

/* The biggest size, from `max` down to `min`, at which the whole name fits
   on at most two lines; past that, two lines at `min` with an ellipsis. */
const nameLines = (ctx, name, maxW, max, min) => {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = `800 ${size}px ${FONT}`;
    const words = name.trim().split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (!cur || ctx.measureText(next).width <= maxW) cur = next;
      else { lines.push(cur); cur = w; }
    }
    lines.push(cur);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size, lines };
  }
  ctx.font = `800 ${min}px ${FONT}`;
  return { size: min, lines: wrapText(ctx, name.trim(), 2, () => maxW) };
};

/* drawImage with scaling, on a PDF canvas, first shrinks the image to its
   size in points (a logo 124 px wide), which prints soft. Drawing it
   unscaled under a scaled transform embeds it at full resolution. */
const drawSharp = (ctx, img, x, y, w, h) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / img.width, h / img.height);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
};

/* ── Public helpers ──────────────────────────────────────────────────── */
export const qrImage = async (url) => safeImage(await QRCode.toDataURL(url, QR_OPTS));

/* A person's card as two print-resolution PNG buffers. */
export async function renderCardPngs(card, { cardUrl, logoSrc = null, photoSrc = null }) {
  const [logo, photo, qr] = await Promise.all([safeImage(logoSrc), safeImage(photoSrc), qrImage(cardUrl)]);
  const front = createCanvas(CARD_W, CARD_H);
  paintFront(front.getContext("2d"), card, { logo, photo });
  const back = createCanvas(CARD_W, CARD_H);
  paintBack(back.getContext("2d"), card, { qr });
  return { front: front.toBuffer("image/png"), back: back.toBuffer("image/png") };
}

/* A Hai Visitor pool card before anyone claims it: laid out like a
   company's empty card, with the Hai Visitor logo and name on the front in
   the batch's colours, and the QR alone on the back. */
export const POOL_NAME = "Hai Visitor";
const paintPoolFront = (ctx, logo, card, x, y, scale) =>
  paintCompanyBlankFront(ctx, { logo, name: POOL_NAME, card, roundLogo: true }, x, y, scale);
const paintPoolBack = (ctx, qr, card, x, y, scale) =>
  paintCompanyBlankBack(ctx, { qr, card, footer: false }, x, y, scale);

/* An unclaimed pool card as two PNG buffers: the same faces as its row on
   the batch print sheet. */
export async function renderBlankPoolPngs({ cardUrl, card = {} }) {
  const [logo, qr] = await Promise.all([brandVMark(), qrImage(cardUrl)]);
  const front = createCanvas(CARD_W, CARD_H);
  paintPoolFront(front.getContext("2d"), logo, card);
  const back = createCanvas(CARD_W, CARD_H);
  paintPoolBack(back.getContext("2d"), qr, card);
  return { front: front.toBuffer("image/png"), back: back.toBuffer("image/png") };
}

/* The Hai Visitor mark as a PNG path, the logo on a pool card whose owner
   has not added their own. */
export const BRAND_MARK_PATH = path.join(HERE, "..", "assets", "haivisitor-mark.png");

/* Just the QR, as a PNG buffer, for the welcome email. */
export const qrPng = (url) => QRCode.toBuffer(url, { ...QR_OPTS, width: 480, margin: 2 });

/* ── A4 print sheet ────────────────────────────────────────────────────────
   One card per row: front on the left, back on the right, five rows to a
   page at the real 85 x 55 mm size, with the batch header on top and crop
   marks in the margins. Everything is vector except the QR codes and the
   brand mark. */
const MM = 72 / 25.4;
const A4_W = 210 * MM, A4_H = 297 * MM;
const CW = 85 * MM, CH = 55 * MM;
const COL_GAP = 6 * MM;
const ROWS = 5;
const GRID_TOP = 14 * MM;

export async function renderBatchPdf({ header = "", batchName = "", cards = [], cardUrl }) {
  const canvas = createCanvas(A4_W, A4_H, "pdf");
  const ctx = canvas.getContext("2d");
  const logo = await brandVMark();
  const pages = Math.max(1, Math.ceil(cards.length / ROWS));
  // Each card in the batch's colours. The painters draw the logo and QR
  // with drawSharp, so both embed at full resolution and print crisp.
  const paintRow = (c, qr, xf, xb, y, scale) => {
    paintPoolFront(ctx, logo, c, xf, y, scale);
    paintPoolBack(ctx, qr, c, xb, y, scale);
  };

  for (let p = 0; p < pages; p++) {
    if (p > 0) ctx.addPage(A4_W, A4_H);
    const rows = cards.slice(p * ROWS, p * ROWS + ROWS);
    const qrs = await Promise.all(rows.map((c) => qrImage(cardUrl(c.slug))));
    paintSheetPage(ctx, { title: header || batchName || "Hai Visitor cards", page: p + 1, pages, rows, qrs, paintRow });
  }
  return canvas.toBuffer("application/pdf");
}

/* A company's empty QR cards, on the same sheet. `logo` is the company
   logo's bytes; each card carries its own colours. */
export async function renderCompanyBlanksPdf({ company = {}, cards = [], cardUrl }) {
  const canvas = createCanvas(A4_W, A4_H, "pdf");
  const ctx = canvas.getContext("2d");
  const [logo, mark] = await Promise.all([safeImage(company.logo), brandVMark()]);
  const pages = Math.max(1, Math.ceil(cards.length / ROWS));
  const paintRow = (c, qr, xf, xb, y, scale) => {
    paintCompanyBlankFront(ctx, { logo, name: company.name, card: c }, xf, y, scale);
    paintCompanyBlankBack(ctx, { qr, mark, card: c }, xb, y, scale);
  };

  for (let p = 0; p < pages; p++) {
    if (p > 0) ctx.addPage(A4_W, A4_H);
    const rows = cards.slice(p * ROWS, p * ROWS + ROWS);
    const qrs = await Promise.all(rows.map((c) => qrImage(cardUrl(c.slug))));
    paintSheetPage(ctx, { title: `${company.name || "Company"} — QR cards`, page: p + 1, pages, rows, qrs, paintRow });
  }
  return canvas.toBuffer("application/pdf");
}

/* One A4 page, in points. Separate from the PDF so a page can be drawn to
   an image to check the layout. */
export function paintSheetPage(ctx, { title, page, pages, rows, qrs, mark, paintRow = null }) {
  const scale = CW / CARD_W;
  const gridW = CW * 2 + COL_GAP;
  const x0 = (A4_W - gridW) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, A4_W, A4_H);

  // Header: the batch header if set, else its name, and the page count,
  // so a dropped stack can be put back in order.
  ctx.fillStyle = "#17171a";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText(fitText(ctx, title, gridW - 110), x0, 8 * MM);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8d8e97";
  ctx.font = `500 8px ${FONT}`;
  ctx.fillText(`Page ${page} of ${pages}  ·  front | back`, x0 + gridW, 8 * MM);
  ctx.textAlign = "left";

  for (let r = 0; r < rows.length; r++) {
    const y = GRID_TOP + r * CH;
    if (paintRow) {
      paintRow(rows[r], qrs[r], x0, x0 + CW + COL_GAP, y, scale);
      continue;
    }
    paintBlankFront(ctx, { mark }, x0, y, scale);
    paintBlankBack(ctx, { qr: qrs[r], serial: rows[r].serial }, x0 + CW + COL_GAP, y, scale);
  }

  // Crop marks: horizontal cuts in the side margins, vertical cuts above
  // and below the grid. Kept 1 mm off the card so none land on it.
  const yEnd = GRID_TOP + rows.length * CH;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  for (let r = 0; r <= rows.length; r++) {
    const y = GRID_TOP + r * CH;
    ctx.moveTo(x0 - 7 * MM, y); ctx.lineTo(x0 - 1 * MM, y);
    ctx.moveTo(x0 + gridW + 1 * MM, y); ctx.lineTo(x0 + gridW + 7 * MM, y);
  }
  for (const x of [x0, x0 + CW, x0 + CW + COL_GAP, x0 + gridW]) {
    ctx.moveTo(x, GRID_TOP - 5 * MM); ctx.lineTo(x, GRID_TOP - 1 * MM);
    ctx.moveTo(x, yEnd + 1 * MM); ctx.lineTo(x, yEnd + 5 * MM);
  }
  ctx.stroke();
}

export const A4 = { w: A4_W, h: A4_H };
