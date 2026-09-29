"use client";
/* ============================================================================
   CARD ARTWORK
   Draws both faces of a visiting card onto a canvas.

   The same routine produces the on-screen preview and the downloaded PNG —
   only the scale differs. Rendering the preview in CSS and the download on a
   canvas would mean maintaining two descriptions of one design, and they
   drift: someone lines up a preview, downloads it, and gets something else.
   At 500 cards from a printer that is an expensive difference.

   Card is 85x55mm, the ISO/India standard. At 300dpi that is 1004x650.
   ========================================================================== */

export const CARD_W = 1004;
export const CARD_H = 650;

/* `page` is the backdrop behind the card on the public web view.
   Light-theme accents are deliberately deep: the job title is set in the
   accent colour, so a pale accent on a pale card would be unreadable. */
export const THEMES = {
  // Dark
  ink:       { tone: "dark",  bg: "#0c0c0f", fg: "#ffffff", accent: "#f5a524", page: "#050505", label: "Ink" },
  amber:     { tone: "dark",  bg: "#1a1408", fg: "#ffffff", accent: "#ffc75f", page: "#0d0a04", label: "Amber" },
  sky:       { tone: "dark",  bg: "#071722", fg: "#ffffff", accent: "#38bdf8", page: "#040d14", label: "Sky" },
  mint:      { tone: "dark",  bg: "#04150e", fg: "#ffffff", accent: "#34d399", page: "#020b07", label: "Mint" },
  violet:    { tone: "dark",  bg: "#120c22", fg: "#ffffff", accent: "#a78bfa", page: "#090616", label: "Violet" },
  // Light
  paper:     { tone: "light", bg: "#ffffff", fg: "#17171a", accent: "#b45309", page: "#f4f4f6", label: "White" },
  cream:     { tone: "light", bg: "#faf5e8", fg: "#1c1917", accent: "#a16207", page: "#f1ead8", label: "Cream" },
  cloud:     { tone: "light", bg: "#eef0f3", fg: "#111827", accent: "#1d4ed8", page: "#e2e5ea", label: "Cloud" },
  skylight:  { tone: "light", bg: "#e8f4fb", fg: "#0b2a3c", accent: "#0369a1", page: "#d6eaf5", label: "Sky Light" },
  mintlight: { tone: "light", bg: "#e9f7f0", fg: "#0b2e20", accent: "#047857", page: "#d5efe2", label: "Mint Light" },
  blush:     { tone: "light", bg: "#fcefed", fg: "#3b0d0c", accent: "#be123c", page: "#f6dedb", label: "Blush" },
};

/* An override only counts when it is actually set — an empty picker value
   must fall back to the preset rather than paint the card black. */
export const resolveColors = (card = {}) => {
  const preset = THEMES[card.theme] || THEMES.ink;
  return {
    bg:     card.bg_color     || preset.bg,
    fg:     card.text_color   || preset.fg,
    accent: card.accent_color || preset.accent,
  };
};

/* Text to set on an accent-filled surface (buttons, the initial badge):
   whichever of near-black or white reads better on it. */
export const onColor = (hex) =>
  contrastRatio("#0c0c0f", hex) >= contrastRatio("#ffffff", hex) ? "#0c0c0f" : "#ffffff";

/* ── Contrast ────────────────────────────────────────────────────────────
   Free colour pickers mean someone will eventually choose light grey on
   white and print five hundred of them. We warn rather than block: it is
   their brand, and a warning respects that while making the risk visible. */
const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

const toRgb = (hex = "#000") => {
  const h = String(hex).replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};

export const contrastRatio = (a, b) => {
  const la = luminance(a) + 0.05;
  const lb = luminance(b) + 0.05;
  return Math.max(la, lb) / Math.min(la, lb);
};

/* 4.5:1 is the AA floor for body text. A printed card is read at arm's
   length in whatever light the room has, so it is a floor here too. */
export const contrastVerdict = (fg, bg) => {
  const r = contrastRatio(fg, bg);
  if (r >= 4.5) return { ok: true, ratio: r };
  if (r >= 3)   return { ok: false, ratio: r, note: "Hard to read at normal size" };
  return { ok: false, ratio: r, note: "Very hard to read — most people will struggle" };
};

/* ── Drawing helpers ─────────────────────────────────────────────────────── */
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const alpha = (hex, a) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/* Truncates to fit rather than overflowing the card edge. A name that runs
   off the artwork is worse than one that is shortened. */
const fitText = (ctx, text, maxWidth) => {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
};

/* Word-wraps into at most maxLines; widthOf(i) gives line i's width. Text
   that does not fit ends the last line with an ellipsis. */
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
  // A single word wider than its line is cut there, not left to overflow.
  const out = lines.map((ln, k) => fitText(ctx, ln, widthOf(k)));
  const last = out.length - 1;
  if (i < words.length && !out[last].endsWith("…")) {
    out[last] = fitText(ctx, `${out[last]}…`, widthOf(last)).replace(/……$/, "…");
  }
  return out;
};

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    // A missing logo must not stop the card rendering.
    img.onerror = () => resolve(null);
    img.src = src;
  });

/* ── FRONT: logo and the person's details ────────────────────────────────── */
export async function drawFront(canvas, card, opts = {}) {
  const scale = opts.scale ?? 1;
  const W = CARD_W * scale;
  const H = CARD_H * scale;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  const { bg, fg, accent } = resolveColors(card);
  const s = (n) => n * scale;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Accent bar down the left edge — the one piece of furniture that makes
  // the card read as designed rather than typeset.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, s(14), H);

  const left = s(74);
  const right = W - s(60);
  const maxText = right - left;

  const logo = await loadImage(opts.logoSrc);
  if (logo) {
    const h = s(56);
    const w = (logo.width / logo.height) * h;
    ctx.drawImage(logo, left, s(58), Math.min(w, s(220)), h);
  }

  // Photo, only when the admin has asked for it on print: top right, in a
  // circle ringed with the accent. Cropped to fill, never stretched.
  const photo = card.photo_on_print ? await loadImage(opts.photoSrc) : null;
  const D = s(176);
  if (photo) {
    const px = right - D, py = s(58), r = D / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px + r, py + r, r, 0, Math.PI * 2);
    ctx.clip();
    const k = Math.max(D / photo.width, D / photo.height);
    const w = photo.width * k, h = photo.height * k;
    ctx.drawImage(photo, px + (D - w) / 2, py + (D - h) / 2, w, h);
    ctx.restore();
    ctx.strokeStyle = accent;
    ctx.lineWidth = s(5);
    ctx.beginPath();
    ctx.arc(px + r, py + r, r - s(2.5), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Name, title and company stop short of the photo.
  const headText = photo ? maxText - D - s(28) : maxText;

  let y = s(logo ? 212 : 180);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fg;
  ctx.font = `800 ${s(58)}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillText(fitText(ctx, card.name || "", headText), left, y);

  if (card.job_title) {
    y += s(52);
    ctx.fillStyle = accent;
    ctx.font = `600 ${s(28)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(fitText(ctx, card.job_title, headText), left, y);
  }

  if (card.company_name) {
    y += s(40);
    ctx.fillStyle = alpha(fg, 0.62);
    ctx.font = `500 ${s(25)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(fitText(ctx, card.company_name, headText), left, y);
  }

  // Hairline above the contact block.
  const lineY = H - s(160);

  // Brief, in the space between the heading and the contacts. Up to three
  // lines, then an ellipsis: at 60 words it can outrun the card, and the
  // full text is always on the web card. Lines level with the photo stop
  // short of it, like the heading.
  if (card.brief?.trim()) {
    ctx.fillStyle = alpha(fg, 0.72);
    ctx.font = `italic 400 ${s(21)}px 'Segoe UI', Arial, sans-serif`;
    const lineH = s(30);
    const first = y + s(46);
    const room = Math.floor((lineY - s(22) - (first - s(21))) / lineH);
    const widthAt = (ly) => (photo && ly - s(21) < s(58) + D + s(12) ? headText : maxText);
    const lines = wrapText(ctx, card.brief.trim(), Math.min(3, room), (i) => widthAt(first + i * lineH));
    lines.forEach((ln, i) => ctx.fillText(ln, left, first + i * lineH));
  }
  ctx.fillStyle = alpha(fg, 0.16);
  ctx.fillRect(left, lineY, maxText, Math.max(1, s(1.5)));

  // Phone and email only. A URL on paper is not something anyone types in;
  // the QR on the back is the link.
  const contacts = [card.phone, card.email].filter(Boolean);
  ctx.font = `500 ${s(24)}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillStyle = alpha(fg, 0.85);
  contacts.forEach((line, i) => {
    ctx.fillText(fitText(ctx, line, maxText), left, lineY + s(46) + i * s(36));
  });

  return canvas;
}

/* ── BACK: QR only ───────────────────────────────────────────────────────── */
export async function drawBack(canvas, card, opts = {}) {
  const scale = opts.scale ?? 1;
  const W = CARD_W * scale;
  const H = CARD_H * scale;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  const { bg, fg, accent } = resolveColors(card);
  const s = (n) => n * scale;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, s(14));

  const qr = await loadImage(opts.qrSrc);
  const box = s(300);
  const x = (W - box) / 2;
  const y = s(120);

  // The QR always sits on white with a quiet zone, whatever the card
  // colours are. Scanners need the contrast, and a dark theme would
  // otherwise make the code unreadable.
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x - s(18), y - s(18), box + s(36), box + s(36), s(18));
  ctx.fill();

  if (qr) {
    ctx.drawImage(qr, x, y, box, box);
  } else {
    ctx.fillStyle = "#8d8e97";
    ctx.font = `600 ${s(22)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("QR", W / 2, y + box / 2);
    ctx.textAlign = "left";
  }

  ctx.textAlign = "center";
  ctx.fillStyle = alpha(fg, 0.78);
  ctx.font = `700 ${s(26)}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillText("Scan for my details", W / 2, y + box + s(78));

  if (card.name) {
    ctx.fillStyle = alpha(fg, 0.45);
    ctx.font = `500 ${s(21)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(fitText(ctx, card.name, W - s(120)), W / 2, y + box + s(116));
  }

  ctx.fillStyle = alpha(fg, 0.34);
  ctx.font = `600 ${s(17)}px 'Segoe UI', Arial, sans-serif`;
  // Kept clear of the bottom 3 mm, which a print trim can take off.
  ctx.fillText("Digital card by Haivisitor", W / 2, H - s(46));
  ctx.textAlign = "left";

  return canvas;
}

/* Downloads a face at full print resolution, regardless of the scale the
   preview happens to be showing. */
export async function downloadFace(face, card, opts, filename) {
  const draw = face === "back" ? drawBack : drawFront;
  const render = async (o) => {
    const canvas = document.createElement("canvas");
    await draw(canvas, card, { ...o, scale: 1 });
    return canvas.toDataURL("image/png");
  };

  // A logo (or a pasted photo URL) served without CORS headers taints the
  // canvas and export throws SecurityError. Drop the logo first, then the
  // photo: a card missing one of them beats no card at all. Each attempt
  // uses a fresh canvas, since a tainted one stays tainted however it is
  // redrawn.
  let url;
  try {
    url = await render(opts);
  } catch {
    try {
      url = await render({ ...opts, logoSrc: "" });
    } catch {
      url = await render({ ...opts, logoSrc: "", photoSrc: "" });
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
