import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";
import QRCode from "qrcode";

/* ================= FONT SETUP ================= */
const FONT_PATH = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf";
const FONT_FAMILY = "AppFont";

// Check if font exists, fallback to system fonts if not
if (fs.existsSync(FONT_PATH)) {
  registerFont(FONT_PATH, { family: FONT_FAMILY });
  console.log("✅ Custom font loaded:", FONT_PATH);
} else {
  console.warn("⚠️ Custom font not found, using system default");
}

/* ================= CONSTANTS ================= */
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 390;

const BRAND_COLOR = "#6c2bd9";
const ACCENT_COLOR = "#8e44ad";
const TEXT_GRAY = "#666";
const LIGHT_GRAY = "#f8f9fa";
const WHATSAPP_GREEN = "#25D366";
const CARD_RADIUS = 18;

/* ======================================================
   IST FORMATTER FOR VISITOR PASS
====================================================== */
const formatISTForPass = (value) => {
  if (!value) return "-";

  try {
    let date;

    // Handle Date objects
    if (value instanceof Date && !isNaN(value)) {
      date = value;
    }
    // Handle MySQL datetime strings (YYYY-MM-DD HH:MM:SS)
    else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      // Parse MySQL datetime as IST
      const [datePart, timePart] = value.split(" ");
      const [year, month, day] = datePart.split("-");
      const [hour, minute, second] = timePart.split(":");
      
      // Create date treating MySQL datetime as IST
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);
    }
    // Handle other string formats
    else if (typeof value === "string") {
      date = new Date(value);
    }
    // Handle other types
    else {
      date = new Date(value);
    }

    // Validate date
    if (isNaN(date.getTime())) return "-";

    // Format in IST
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

  } catch (err) {
    console.error("[formatISTForPass] Error:", err.message);
    return "-";
  }
};

/* ================= TEXT UTILITIES ================= */
const drawEllipsisText = (ctx, text, x, y, maxWidth) => {
  const value = text || "";

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

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

/* ================= SHORTEN URL FOR DISPLAY ================= */
const shortenUrl = (url) => {
  if (!url) return "";
  
  try {
    // Remove protocol
    let shortened = url.replace(/^https?:\/\//, "");
    
    // Remove trailing slash
    shortened = shortened.replace(/\/$/, "");
    
    // If still too long, truncate
    if (shortened.length > 30) {
      shortened = shortened.substring(0, 27) + "...";
    }
    
    return shortened;
  } catch {
    return url;
  }
};

/* ================= DRAW WHATSAPP ICON ================= */
const drawWhatsAppIcon = (ctx, x, y, size) => {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2;

  // Green circle background
  ctx.fillStyle = WHATSAPP_GREEN;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // White phone icon (simplified)
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = size * 0.08;

  // Draw phone receiver shape
  ctx.beginPath();
  
  // Bottom curve (receiver bottom)
  ctx.arc(
    centerX - radius * 0.3,
    centerY + radius * 0.3,
    radius * 0.15,
    Math.PI * 0.75,
    Math.PI * 1.5
  );
  
  // Top curve (receiver top)
  ctx.arc(
    centerX + radius * 0.3,
    centerY - radius * 0.3,
    radius * 0.15,
    Math.PI * 1.5,
    Math.PI * 2.25
  );
  
  ctx.stroke();

  // Add chat bubble effect
  ctx.beginPath();
  ctx.arc(centerX + radius * 0.1, centerY - radius * 0.1, radius * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.06;
  ctx.stroke();
};

/* ================= MAIN IMAGE GENERATOR ================= */
export const generateVisitorPassImage = async ({
  company = {},
  visitor = {}
}) => {
  console.log("[VISITOR_PASS_IMAGE] Generating pass for:", visitor.name);
  console.log("[VISITOR_PASS_IMAGE] Check-in time:", visitor.checkIn);
  console.log("[VISITOR_PASS_IMAGE] WhatsApp URL:", company.whatsapp_url || "Not provided");

  const companyName = company?.name || "Company";
  const visitorName = visitor?.name || "Visitor";
  const visitorCode = visitor?.visitorCode || "N/A";
  const phone = visitor?.phone || "N/A";
  const personToMeet = visitor?.personToMeet || "Reception";
  const whatsappUrl = company?.whatsapp_url || null;
  
  // Format check-in time
  const checkInFormatted = formatISTForPass(visitor.checkIn);
  console.log("[VISITOR_PASS_IMAGE] Formatted check-in:", checkInFormatted);

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Set default font (fallback if custom font fails)
  const fontFamily = fs.existsSync(FONT_PATH) ? FONT_FAMILY : "Arial, sans-serif";

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  /* ================= BACKGROUND ================= */
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, BRAND_COLOR);
  gradient.addColorStop(1, ACCENT_COLOR);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  /* ================= MAIN CARD ================= */
  const cardX = 20;
  const cardY = 20;
  const cardW = CANVAS_WIDTH - 40;
  const cardH = CANVAS_HEIGHT - 40;

  // Card shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  drawRoundedRect(ctx, cardX + 3, cardY + 3, cardW, cardH, CARD_RADIUS);
  ctx.fill();

  // Card background
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, CARD_RADIUS);
  ctx.fill();

  /* ================= HEADER SECTION ================= */
  ctx.fillStyle = BRAND_COLOR;
  ctx.beginPath();
  ctx.moveTo(cardX + CARD_RADIUS, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + 70, CARD_RADIUS);
  ctx.lineTo(cardX + cardW, cardY + 70);
  ctx.lineTo(cardX, cardY + 70);
  ctx.arcTo(cardX, cardY, cardX + cardW, cardY, CARD_RADIUS);
  ctx.closePath();
  ctx.fill();

  // Company name
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 24px ${fontFamily}`;
  drawEllipsisText(ctx, companyName, cardX + 20, cardY + 35, cardW - 140);

  // "Visitor Pass" subtitle
  ctx.font = `16px ${fontFamily}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText("VISITOR PASS", cardX + 20, cardY + 55);

  /* ================= COMPANY LOGO ================= */
  if (company.logo_url || company.logo) {
    try {
      const logo = await loadImage(company.logo_url || company.logo);
      const maxLogoW = 120;
      const maxLogoH = 50;
      const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      const logoW = logo.width * ratio;
      const logoH = logo.height * ratio;

      // White background for logo
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cardX + cardW - logoW - 25, cardY + 10, logoW + 10, logoH + 10);

      ctx.drawImage(
        logo,
        cardX + cardW - logoW - 20,
        cardY + 15,
        logoW,
        logoH
      );
      
      console.log("[VISITOR_PASS_IMAGE] Company logo loaded successfully");
    } catch (err) {
      console.error("[VISITOR_PASS_IMAGE] Logo load failed:", err.message);
    }
  }

  /* ================= VISITOR DETAILS ================= */
  const detailsX = cardX + 20;
  let detailsY = cardY + 90;
  const lineHeight = 28;

  // Section title
  ctx.fillStyle = BRAND_COLOR;
  ctx.font = `bold 18px ${fontFamily}`;
  ctx.fillText("VISITOR DETAILS", detailsX, detailsY);
  detailsY += 35;

  // Details
  ctx.font = `15px ${fontFamily}`;
  const details = [
    { label: "Visitor ID", value: visitorCode },
    { label: "Name", value: visitorName },
    { label: "Phone", value: phone },
    { label: "Meeting", value: personToMeet },
    { label: "Check-in", value: `${checkInFormatted} IST` }
  ];

  details.forEach((detail, index) => {
    ctx.fillStyle = TEXT_GRAY;
    ctx.fillText(`${detail.label}:`, detailsX, detailsY + (index * lineHeight));
    
    ctx.fillStyle = "#333";
    ctx.font = `bold 15px ${fontFamily}`;
    drawEllipsisText(ctx, detail.value, detailsX + 85, detailsY + (index * lineHeight), 280);
    
    ctx.font = `15px ${fontFamily}`;
  });

  /* ================= VISITOR PHOTO ================= */
  const photoX = cardX + cardW - 170;
  const photoY = cardY + 90;
  const photoW = 130;
  const photoH = 160;

  // Photo background
  ctx.fillStyle = LIGHT_GRAY;
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.fill();

  // Photo border
  ctx.strokeStyle = BRAND_COLOR;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.stroke();

  // Load and draw visitor photo
  if (visitor.photoUrl) {
    try {
      const img = await loadImage(visitor.photoUrl);
      const ratio = Math.min((photoW - 6) / img.width, (photoH - 6) / img.height);
      const imgW = img.width * ratio;
      const imgH = img.height * ratio;

      // Center the image
      const imgX = photoX + (photoW - imgW) / 2;
      const imgY = photoY + (photoH - imgH) / 2;

      // Create clipping path for rounded photo
      ctx.save();
      drawRoundedRect(ctx, photoX + 3, photoY + 3, photoW - 6, photoH - 6, 5);
      ctx.clip();
      
      ctx.drawImage(img, imgX, imgY, imgW, imgH);
      ctx.restore();
      
      console.log("[VISITOR_PASS_IMAGE] Visitor photo loaded successfully");
    } catch (err) {
      console.error("[VISITOR_PASS_IMAGE] Photo load failed:", err.message);
      
      // Fallback: show placeholder text
      ctx.fillStyle = TEXT_GRAY;
      ctx.font = `12px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText("Photo", photoX + photoW / 2, photoY + photoH / 2 - 10);
      ctx.fillText("Not Available", photoX + photoW / 2, photoY + photoH / 2 + 10);
      ctx.textAlign = "left";
    }
  } else {
    // No photo URL provided
    ctx.fillStyle = TEXT_GRAY;
    ctx.font = `12px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText("No Photo", photoX + photoW / 2, photoY + photoH / 2);
    ctx.textAlign = "left";
  }

  /* ================= WHATSAPP SECTION (IF URL EXISTS) ================= */
  if (whatsappUrl) {
    const whatsappX = cardX + 20;
    const whatsappY = cardY + cardH - 80;
    const iconSize = 32;

    // Background box for WhatsApp section
    ctx.fillStyle = "#e8f5e9";
    drawRoundedRect(ctx, whatsappX, whatsappY, 320, 50, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = WHATSAPP_GREEN;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, whatsappX, whatsappY, 320, 50, 8);
    ctx.stroke();

    // WhatsApp icon
    drawWhatsAppIcon(ctx, whatsappX + 10, whatsappY + 9, iconSize);

    // Text content
    ctx.fillStyle = "#1b5e20";
    ctx.font = `bold 13px ${fontFamily}`;
    ctx.fillText("Join WhatsApp Group", whatsappX + iconSize + 20, whatsappY + 18);

    // URL
    ctx.fillStyle = "#2e7d32";
    ctx.font = `11px ${fontFamily}`;
    const displayUrl = shortenUrl(whatsappUrl);
    drawEllipsisText(ctx, displayUrl, whatsappX + iconSize + 20, whatsappY + 35, 260);

    console.log("[VISITOR_PASS_IMAGE] WhatsApp section added");
  }

  /* ================= FOOTER ================= */
  ctx.fillStyle = LIGHT_GRAY;
  ctx.fillRect(cardX, cardY + cardH - 40, cardW, 40);

  ctx.fillStyle = TEXT_GRAY;
  ctx.font = `12px ${fontFamily}`;
  
  // Adjust footer text position if WhatsApp section exists
  const footerText = whatsappUrl 
    ? "Please carry this pass during your visit"
    : "Please carry this pass during your visit • Valid for today only";
  
  ctx.fillText(footerText, cardX + 20, cardY + cardH - 20);

  // Timestamp
  ctx.textAlign = "right";
  ctx.fillText(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, cardX + cardW - 20, cardY + cardH - 20);
  ctx.textAlign = "left";

  console.log("[VISITOR_PASS_IMAGE] Pass generated successfully");
  
  return canvas.toBuffer("image/png");
};
