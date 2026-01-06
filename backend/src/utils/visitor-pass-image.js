import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";

/* ================= FONT ================= */
const FONT_PATH = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf";
const FONT_FAMILY = "AppFont";

if (!fs.existsSync(FONT_PATH)) {
  console.error("❌ Font not found:", FONT_PATH);
  throw new Error("Required font missing");
}

registerFont(FONT_PATH, { family: FONT_FAMILY });

/* ================= CONSTANTS ================= */
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 390;

const BRAND_COLOR = "#3c007a";
const TEXT_GRAY = "#666";
const CARD_RADIUS = 18;

/* ======================================================
   SUPER SAFE IST FORMATTER (NO DOUBLE +5:30 ISSUE)
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  const format = (d) =>
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

  /* ---------- CASE 1: Already a valid Date ---------- */
  if (value instanceof Date && !isNaN(value)) {
    return format(value);
  }

  /* ---------- CASE 2: Non-string ---------- */
  if (typeof value !== "string") {
    try {
      const d = new Date(value);
      return isNaN(d) ? "-" : format(d);
    } catch {
      return "-";
    }
  }

  /* ---------- CASE 3: ISO with timezone / Z ---------- */
  if (value.includes("T") && (value.includes("Z") || /[+-]\d\d:?(\d\d)?$/.test(value))) {
    try {
      const d = new Date(value);
      return isNaN(d) ? "-" : format(d);
    } catch {
      return "-";
    }
  }

  /* ---------- CASE 4: ISO WITHOUT timezone ---------- */
  if (value.includes("T")) {
    try {
      // Treat it as IST already — do NOT shift
      const d = new Date(value.replace("T", " ") + " UTC"); 
      return format(d);
    } catch {
      return "-";
    }
  }

  /* ---------- CASE 5: MYSQL "YYYY-MM-DD HH:MM:SS" ---------- */
  try {
    const [date, time] = value.split(" ");
    if (!date || !time) return value;

    const [y, mo, d] = date.split("-");
    let [h, m] = time.split(":");

    let hour = parseInt(h, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;

    const monthNames = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ];

    return `${d} ${monthNames[mo - 1]} ${y}, ${hour}:${m} ${suffix}`;
  } catch {
    return value;
  }
};

/* ================= TEXT TRIM ================= */
const drawEllipsisText = (ctx, text, x, y, maxWidth) => {
  const value = text || "Company";

  if (ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }

  let trimmed = value;
  while (trimmed.length && ctx.measureText(trimmed + "...").width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  ctx.fillText(trimmed + "...", x, y);
};

/* ================= MAIN IMAGE GENERATOR ================= */
export const generateVisitorPassImage = async ({
  company = {},
  visitor = {}
}) => {
  const companyName =
    company?.name ||
    visitor?.companyName ||
    "Company";

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  /* BG */
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  /* CARD */
  const cardX = 20;
  const cardY = 20;
  const cardW = CANVAS_WIDTH - 40;
  const cardH = CANVAS_HEIGHT - 40;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(cardX + CARD_RADIUS, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, CARD_RADIUS);
  ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, CARD_RADIUS);
  ctx.arcTo(cardX, cardY + cardH, cardX, cardY, CARD_RADIUS);
  ctx.arcTo(cardX, cardY, cardX + cardW, cardY, CARD_RADIUS);
  ctx.closePath();
  ctx.fill();

  /* HEADER */
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(cardX, cardY, cardW, 64);

  ctx.fillStyle = "#fff";
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  drawEllipsisText(ctx, companyName, cardX + 20, cardY + 32, cardW - 140);

  /* LOGO */
  if (company.logo_url || company.logo) {
    try {
      const logo = await loadImage(company.logo_url || company.logo);
      const ratio = Math.min(120 / logo.width, 48 / logo.height);

      ctx.drawImage(
        logo,
        cardX + cardW - logo.width * ratio - 20,
        cardY + 8,
        logo.width * ratio,
        logo.height * ratio
      );
    } catch (err) {
      console.error("Logo load failed:", err.message);
    }
  }

  /* DETAILS */
  ctx.fillStyle = BRAND_COLOR;
  ctx.font = `bold 16px ${FONT_FAMILY}`;
  ctx.fillText("Visitor Pass", cardX + 20, cardY + 100);

  ctx.font = `15px ${FONT_FAMILY}`;
  ctx.fillText(`Visitor ID : ${visitor.visitorCode || "-"}`, cardX + 20, cardY + 135);
  ctx.fillText(`Name       : ${visitor.name || "-"}`, cardX + 20, cardY + 165);
  ctx.fillText(`Phone      : ${visitor.phone || "-"}`, cardX + 20, cardY + 195);

  ctx.fillText(
    `Check-in   : ${formatIST(visitor.checkIn)} (IST)`,
    cardX + 20,
    cardY + 225
  );

  /* PHOTO */
  const photoX = cardX + cardW - 190;
  const photoY = cardY + 95;
  const photoW = 150;
  const photoH = 185;

  ctx.strokeStyle = BRAND_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  if (visitor.photoUrl) {
    try {
      const img = await loadImage(visitor.photoUrl);
      const r = Math.min(photoW / img.width, photoH / img.height);

      ctx.drawImage(
        img,
        photoX + (photoW - img.width * r) / 2,
        photoY + (photoH - img.height * r) / 2,
        img.width * r,
        img.height * r
      );
    } catch {
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.fillStyle = "#999";
      ctx.fillText("Photo unavailable", photoX + 20, photoY + photoH / 2);
    }
  }

  /* FOOTER */
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_GRAY;
  ctx.fillText(
    "Please carry this pass during your visit",
    cardX + 20,
    cardY + cardH - 18
  );

  return canvas.toBuffer("image/png");
};
