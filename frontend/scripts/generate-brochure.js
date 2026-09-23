/**
 * One-off generator for the Hai Visitor sales brochure / setup guide PDF.
 * Draws real vector PDF content directly (text, shapes, images) instead of
 * rasterizing HTML/CSS — avoids the html2canvas layout bugs (overlapping
 * text, wrong page heights) that broke the earlier browser-based approach.
 *
 * Run with: node scripts/generate-brochure.js
 * Output:   public/Hai-Visitor-Brochure.pdf
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const OUT_PATH = path.join(__dirname, "..", "public", "Hai-Visitor-Brochure.pdf");
const LOGO_PATH = path.join(__dirname, "..", "public", "v-mark.png");

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLOR = {
  ink: "#241247",
  inkSoft: "#5B4E80",
  inkFaint: "#8578A8",
  line: "#E1D8F2",
  purple900: "#2D0070",
  purple800: "#4A00A0",
  purple700: "#6A0DAD",
  purple600: "#7B1FCC",
  purple500: "#8B2BE2",
  purple100: "#EDE9FE",
  purple50: "#F5F3FF",
  orange: "#F97316",
  amber600: "#D97706",
  success: "#059669",
  successBg: "#D1FAE5",
  danger: "#B91C1C",
  dangerBg: "#FEF2F2",
  greenBg: "#F0FDF6",
  white: "#FFFFFF",
};

const F = { reg: "Helvetica", bold: "Helvetica-Bold" };

/* ================= DRAW HELPERS ================= */

function brandGradientRect(doc, x, y, w, h, r = 0) {
  const grad = doc.linearGradient(x, y, x + w, y + h);
  grad.stop(0, COLOR.purple800).stop(0.35, COLOR.purple700).stop(0.7, COLOR.purple500).stop(1, "#A855F7");
  if (r) doc.roundedRect(x, y, w, h, r).fill(grad);
  else doc.rect(x, y, w, h).fill(grad);
}

// A small rounded, gradient-filled icon square — used in place of flat
// color fills so mockup icons feel like the app's real branded modules.
function iconSquare(doc, x, y, size, colorA, colorB, radius = size * 0.28) {
  const grad = doc.linearGradient(x, y, x + size, y + size);
  grad.stop(0, colorA).stop(1, colorB);
  doc.roundedRect(x, y, size, size, radius).fill(grad);
}

function kicker(doc, x, y, label) {
  doc.circle(x + 3, y + 4, 3).fill(COLOR.orange);
  doc.font(F.bold).fontSize(10.5).fillColor(COLOR.purple700)
    .text(label.toUpperCase(), x + 14, y, { characterSpacing: 1 });
}

// The exact font/size checklistItem() draws its wrapped text in — exported
// so callers can set it before heightOfString() when pre-measuring a box's
// height, since heightOfString() measures using the doc's *currently set*
// font, not whatever checklistItem() will use internally.
const CHECKLIST_FONT = F.reg;
const CHECKLIST_SIZE = 11;

function checklistItem(doc, x, y, w, text, color = COLOR.purple600) {
  doc.font(F.bold).fontSize(10).fillColor(color).text("+", x, y);
  doc.font(CHECKLIST_FONT).fontSize(CHECKLIST_SIZE).fillColor(COLOR.inkSoft).text(text, x + 12, y, { width: w - 12, lineGap: 2 });
}

function routePill(doc, x, y, text) {
  const w = doc.font(F.bold).fontSize(9).widthOfString(text) + 16;
  doc.roundedRect(x, y, w, 18, 4).fill(COLOR.purple100);
  doc.font(F.bold).fontSize(9).fillColor(COLOR.purple700).text(text, x + 8, y + 5);
  return w;
}

// A soft, layered drop-shadow simulation (pdfkit has no blur filter) — a
// few progressively lighter, larger offset rects stacked behind the card.
function softShadow(doc, x, y, w, h, r) {
  const layers = [[6, "#2D0070", 0.05], [3, "#2D0070", 0.06], [1, "#2D0070", 0.08]];
  layers.forEach(([offset, color, opacity]) => {
    doc.save();
    doc.fillOpacity(opacity);
    doc.roundedRect(x - offset / 2, y + offset, w + offset, h, r).fill(color);
    doc.restore();
  });
}

// Browser-chrome URL bar: three traffic-light dots + the address pill —
// makes a mockup read as an actual screenshot rather than a plain box.
function windowChrome(doc, x, y, w, url) {
  const barH = 22;
  doc.roundedRect(x, y, w, barH, 6).fill(COLOR.white);
  const dotColors = ["#F87171", "#FBBF24", "#34D399"];
  dotColors.forEach((c, i) => doc.circle(x + 14 + i * 13, y + barH / 2, 3.5).fill(c));
  doc.roundedRect(x + 56, y + 4, w - 68, barH - 8, 4).fill(COLOR.purple50);
  doc.font(F.reg).fontSize(7.5).fillColor(COLOR.inkFaint).text(url, x + 64, y + 7.5, { lineBreak: false });
  return barH;
}

// Small footer for every page except the cover — a thin rule plus the
// "Hai Visitor" wordmark, centered, so the brand stays present throughout.
function pageFooter(doc) {
  const footerY = PAGE_H - 44;
  doc.moveTo(MARGIN, footerY).lineTo(PAGE_W - MARGIN, footerY).lineWidth(1).stroke(COLOR.line);
  const word1 = "Hai"; const word2 = "Visitor";
  doc.font(F.bold).fontSize(9);
  const w1 = doc.widthOfString(word1 + " "), w2 = doc.widthOfString(word2);
  let cx = (PAGE_W - (w1 + w2)) / 2;
  const textY = footerY + 14;
  doc.fillColor(COLOR.orange).text(word1 + " ", cx, textY, { lineBreak: false }); cx += w1;
  doc.fillColor(COLOR.inkFaint).text(word2, cx, textY, { lineBreak: false });
}

/* ================= BUILD ================= */

async function build() {
  const qrDataUrl = await QRCode.toDataURL("https://haivisitor.zodopt.com", {
    width: 240, margin: 1, color: { dark: "#241247", light: "#ffffff" },
  });
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true });
  doc.pipe(fs.createWriteStream(OUT_PATH));

  /* ===== PAGE 1 — COVER ===== */
  doc.addPage();
  brandGradientRect(doc, 0, 0, PAGE_W, PAGE_H);

  // Logo placed directly on the gradient, large — it already carries the
  // "Hai Visitor" wordmark baked into the artwork, so there's no separate
  // text wordmark drawn beneath it (that was a redundant second logo line).
  const logoSize = 230;
  const logoX = (PAGE_W - logoSize) / 2;
  const logoY = 90;
  try {
    doc.image(LOGO_PATH, logoX, logoY, { fit: [logoSize, logoSize], align: "center", valign: "center" });
  } catch { /* logo optional */ }

  doc.font(F.bold).fontSize(34).fillColor(COLOR.ink)
    .text("Visitor & Conference Management, Simplified.", MARGIN + 20, logoY + logoSize + 30, { width: CONTENT_W - 40, align: "center", lineGap: 4 });

  doc.font(F.reg).fontSize(14.5).fillColor("rgba(255,255,255,0.88)")
    .text("Turn every walk-in, meeting and guest into an organised, secure digital record — live in under 15 minutes, with no dedicated hardware required.",
      MARGIN + 40, 470, { width: CONTENT_W - 80, align: "center", lineGap: 3 });

  const stats = [["15 min", "TO GO LIVE"], ["Rs. 49", "15-DAY TRIAL"], ["Zero", "HARDWARE NEEDED"]];
  const statCardW = 140;
  const statCardH = 74;
  const statGap = 14;
  const statsTotalW = statCardW * 3 + statGap * 2;
  let sx = (PAGE_W - statsTotalW) / 2;
  const statsY = 560;
  stats.forEach(([big, small]) => {
    // fillAndStroke() with two rgba() strings doesn't parse reliably in
    // pdfkit (unlike single .fill()/.stroke() calls) — use fillOpacity /
    // strokeOpacity with a solid color instead, scoped with save/restore
    // so the opacity doesn't leak into whatever draws next.
    doc.save();
    doc.roundedRect(sx, statsY, statCardW, statCardH, 12);
    doc.fillOpacity(0.12).fillColor(COLOR.white).fill();
    doc.roundedRect(sx, statsY, statCardW, statCardH, 12);
    doc.strokeOpacity(0.3).lineWidth(1).strokeColor(COLOR.white).stroke();
    doc.restore();
    doc.font(F.bold).fontSize(22).fillColor(COLOR.white).text(big, sx, statsY + 16, { width: statCardW, align: "center" });
    doc.font(F.bold).fontSize(9).fillColor("rgba(255,255,255,0.8)").text(small, sx, statsY + 46, { width: statCardW, align: "center", characterSpacing: 0.5 });
    sx += statCardW + statGap;
  });

  doc.font(F.bold).fontSize(10).fillColor("rgba(255,255,255,0.65)")
    .text("haivisitor.zodopt.com", 0, PAGE_H - 60, { width: PAGE_W, align: "center", characterSpacing: 0.5 });

  /* ===== PAGE 2 — WHY HAI VISITOR + FEATURES ===== */
  doc.addPage();
  pageFooter(doc);
  let y = MARGIN;
  kicker(doc, MARGIN, y, "Why Hai Visitor");
  y += 22;
  doc.font(F.bold).fontSize(23).fillColor(COLOR.ink)
    .text("Your front desk deserves better than a paper register", MARGIN, y, { width: CONTENT_W, lineGap: 3 });
  y += 56;
  doc.font(F.reg).fontSize(11.5).fillColor(COLOR.inkSoft)
    .text("Walk-in visitors, client meetings and guest data are some of the most valuable — and most frequently lost — records a business generates. Hai Visitor replaces the sign-in book and the scattered spreadsheets with one connected system your whole team already knows how to use: WhatsApp.",
      MARGIN, y, { width: CONTENT_W, lineGap: 2 });
  y += 66;

  // Simplified "home dashboard" preview box
  const dashH = 144;
  softShadow(doc, MARGIN, y, CONTENT_W, dashH, 12);
  doc.roundedRect(MARGIN, y, CONTENT_W, dashH, 12).fillAndStroke(COLOR.purple50, COLOR.line);
  windowChrome(doc, MARGIN + 12, y + 12, CONTENT_W - 24, "haivisitor.zodopt.com/home");
  const cardW = (CONTENT_W - 24 - 12) / 2;
  const cardY = y + 52;
  [["Visitor Management", "Check-ins, passes & history", COLOR.purple600, "#A855F7"],
   ["Conference Booking", "Rooms & meeting schedules", COLOR.amber600, "#FBBF24"]].forEach(([title, sub, colorA, colorB], i) => {
    const cx2 = MARGIN + 12 + i * (cardW + 12);
    doc.roundedRect(cx2, cardY, cardW, 74, 8).fillAndStroke(COLOR.white, COLOR.line);
    iconSquare(doc, cx2 + 12, cardY + 12, 26, colorA, colorB);
    doc.font(F.bold).fontSize(10.5).fillColor(COLOR.ink).text(title, cx2 + 12, cardY + 46);
    doc.font(F.reg).fontSize(9).fillColor(COLOR.inkFaint).text(sub, cx2 + 12, cardY + 60, { width: cardW - 24 });
  });
  y += dashH + 20;

  // Problem / solution band
  const bandH = 92;
  const halfW = (CONTENT_W - 16) / 2;
  doc.roundedRect(MARGIN, y, halfW, bandH, 8).fill(COLOR.dangerBg);
  doc.roundedRect(MARGIN + halfW + 16, y, halfW, bandH, 8).fill(COLOR.greenBg);
  doc.font(F.bold).fontSize(9.5).fillColor(COLOR.danger).text("WITHOUT HAI VISITOR", MARGIN + 14, y + 14, { characterSpacing: 0.5 });
  doc.font(F.reg).fontSize(9.5).fillColor(COLOR.ink)
    .text("Illegible sign-in registers, no record of who a visitor met, hosts caught off guard, and zero visibility into footfall trends.", MARGIN + 14, y + 31, { width: halfW - 28, lineGap: 1.5 });
  doc.font(F.bold).fontSize(9.5).fillColor(COLOR.success).text("WITH HAI VISITOR", MARGIN + halfW + 30, y + 14, { characterSpacing: 0.5 });
  doc.font(F.reg).fontSize(9.5).fillColor(COLOR.ink)
    .text("Every visit is digital, timestamped and searchable — hosts get an instant WhatsApp alert, and every visitor leaves with a digital pass.", MARGIN + halfW + 30, y + 31, { width: halfW - 28, lineGap: 1.5 });
  y += bandH + 22;

  const features = [
    ["V", "Visitor Management", "QR self-registration, instant WhatsApp host approval, and a live digital pass for every visitor.", COLOR.purple600],
    ["C", "Conference Booking", "Rooms with live slot availability — bookable by staff or the public, your choice.", COLOR.purple600],
    ["E", "Employee Directory", "A searchable staff list so visitors can pick exactly who they're here to meet.", COLOR.purple600],
    ["R", "Reports & Analytics", "Real-time KPIs, footfall trends, and one-click Excel exports for any period.", COLOR.purple600],
    ["F", "Form Builder", "Fully custom registration fields and your own \"Purpose of Visit\" categories.", COLOR.purple600],
    ["S", "Smart Forms", "Standalone QR data collectors for event feedback, lead capture, or sign-up sheets.", COLOR.purple600],
  ];
  const fCardW = (CONTENT_W - 16) / 2;
  const fCardH = 78;
  features.forEach(([letter, title, desc], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const fx = MARGIN + col * (fCardW + 16);
    const fy = y + row * (fCardH + 12);
    doc.roundedRect(fx, fy, fCardW, fCardH, 10).fillAndStroke(COLOR.purple50, COLOR.line);
    iconSquare(doc, fx + 14, fy + 14, 26, COLOR.purple600, "#A855F7");
    doc.font(F.bold).fontSize(12).fillColor(COLOR.white).text(letter, fx + 14, fy + 21, { width: 26, align: "center" });
    doc.font(F.bold).fontSize(11).fillColor(COLOR.ink).text(title, fx + 48, fy + 15, { width: fCardW - 62 });
    doc.font(F.reg).fontSize(9).fillColor(COLOR.inkSoft).text(desc, fx + 48, fy + 31, { width: fCardW - 62, lineGap: 1.5 });
  });

  /* ===== PAGE 3 — FEATURE DEEP DIVE ===== */
  doc.addPage();
  pageFooter(doc);
  y = MARGIN;
  kicker(doc, MARGIN, y, "Feature Deep Dive");
  y += 22;
  doc.font(F.bold).fontSize(23).fillColor(COLOR.ink).text("What your team and your visitors actually experience", MARGIN, y, { width: CONTENT_W, lineGap: 3 });
  y += 56;
  doc.font(F.reg).fontSize(11.5).fillColor(COLOR.inkSoft)
    .text("Hai Visitor is built around two people at once — the staff member managing the front desk, and the visitor on their own phone. Neither one needs to install anything.",
      MARGIN, y, { width: CONTENT_W, lineGap: 2 });
  y += 48;

  const dualW = (CONTENT_W - 20) / 2;
  const teamItems = [
    "A live visitor list, updating automatically, with colour-coded status",
    "Accept or decline a visitor request straight from WhatsApp",
    "Auto checkout at day's end — nothing is ever left dangling \"IN\"",
    "Full visit history, including photo and ID proof if required",
  ];
  const visitorItems = [
    "Scan a QR code and fill in details in under a minute — no app, no login",
    "Returning visitors are recognised automatically — nothing to re-type",
    "A digital pass shows their live status as the visit progresses",
    "A quick WhatsApp feedback rating is requested after the meeting",
  ];
  // Height computed from actual content, not a guessed constant — a fixed
  // height silently let bullet text run past the box's bottom border
  // whenever the wrapped item text was taller than the guess (worse once
  // font sizes go up), so measure first the same way the page 4 cards do.
  let dualH = 0;
  doc.font(CHECKLIST_FONT).fontSize(CHECKLIST_SIZE);
  [["For your team", teamItems], ["For the visitor", visitorItems]].forEach(([, items]) => {
    let h = 38;
    items.forEach((it) => { h += doc.heightOfString(it, { width: dualW - 44, lineGap: 2 }) + 10; });
    dualH = Math.max(dualH, h + 10);
  });
  [["For your team", teamItems], ["For the visitor", visitorItems]].forEach(([title, items], i) => {
    const dx = MARGIN + i * (dualW + 20);
    doc.roundedRect(dx, y, dualW, dualH, 8).stroke(COLOR.line);
    doc.font(F.bold).fontSize(12.5).fillColor(COLOR.purple700).text(title, dx + 16, y + 14);
    let iy = y + 40;
    items.forEach((it) => {
      checklistItem(doc, dx + 16, iy, dualW - 32, it);
      iy += doc.heightOfString(it, { width: dualW - 44, lineGap: 2 }) + 10;
    });
  });
  y += dualH + 20;

  // Simplified mockup row: dashboard/table + WhatsApp/pass
  // Tall enough that the pass card's subtitle and its "Accepted" pill never
  // collide (passH = mockH - waH - 12 needs real room for both).
  const mockH = 220;
  const mockLeftW = dualW;
  softShadow(doc, MARGIN, y, mockLeftW, mockH, 10);
  doc.roundedRect(MARGIN, y, mockLeftW, mockH, 10).fillAndStroke(COLOR.purple50, COLOR.line);
  windowChrome(doc, MARGIN + 12, y + 12, mockLeftW - 24, "haivisitor.zodopt.com/visitor/dashboard");
  doc.roundedRect(MARGIN + 12, y + 40, 50, 50, 8).fillAndStroke(COLOR.white, COLOR.line);
  doc.font(F.reg).fontSize(6).fillColor(COLOR.inkFaint).text("QR", MARGIN + 30, y + 62);
  const rows = [["RH", "Ramesh H.", "Accepted", COLOR.success], ["VM", "Vikram M.", "Checked In", "#2563EB"], ["MI", "Mohan I.", "Pending", COLOR.amber600]];
  let ry = y + 100;
  rows.forEach(([initials, name, status, color]) => {
    iconSquare(doc, MARGIN + 14, ry - 2, 16, COLOR.purple700, COLOR.purple500, 8);
    doc.font(F.bold).fontSize(6).fillColor(COLOR.white).text(initials, MARGIN + 14, ry + 3, { width: 16, align: "center" });
    doc.font(F.reg).fontSize(8).fillColor(COLOR.ink).text(name, MARGIN + 38, ry + 1);
    const pillW = doc.font(F.bold).fontSize(7).widthOfString(status) + 14;
    doc.roundedRect(MARGIN + mockLeftW - pillW - 14, ry - 3, pillW, 16, 8).fill(color === COLOR.success ? COLOR.successBg : "#FFF");
    doc.font(F.bold).fontSize(7).fillColor(color).text(status, MARGIN + mockLeftW - pillW - 7, ry + 1);
    ry += 26;
  });

  const mockRightX = MARGIN + mockLeftW + 20;
  const waH = 88;
  softShadow(doc, mockRightX, y, dualW, waH, 10);
  doc.roundedRect(mockRightX, y, dualW, waH, 10).fill(COLOR.greenBg);
  doc.circle(mockRightX + 22, y + 20, 8).fill("#25D366");
  doc.font(F.bold).fontSize(9).fillColor(COLOR.white).text("W", mockRightX + 18, y + 15);
  doc.font(F.bold).fontSize(9).fillColor(COLOR.ink).text("New Visitor Request", mockRightX + 38, y + 15);
  doc.font(F.reg).fontSize(8).fillColor(COLOR.inkSoft).text("Ramesh H. is here for \"Sofa Enquiry\" — meet now?", mockRightX + 14, y + 34, { width: dualW - 28, lineGap: 2 });
  doc.roundedRect(mockRightX + 14, y + 60, (dualW - 36) / 2, 20, 6).fill("#25D366");
  doc.font(F.bold).fontSize(8).fillColor(COLOR.white).text("Accept", mockRightX + 14, y + 66, { width: (dualW - 36) / 2, align: "center" });
  doc.roundedRect(mockRightX + 14 + (dualW - 36) / 2 + 8, y + 60, (dualW - 36) / 2, 20, 6).fillAndStroke(COLOR.white, "#F0C0C0");
  doc.font(F.bold).fontSize(8).fillColor(COLOR.danger).text("Decline", mockRightX + 14 + (dualW - 36) / 2 + 8, y + 66, { width: (dualW - 36) / 2, align: "center" });

  const passY = y + waH + 12;
  const passH = mockH - waH - 12;
  softShadow(doc, mockRightX, passY, dualW, passH, 10);
  brandGradientRect(doc, mockRightX, passY, dualW, passH, 10);
  doc.circle(mockRightX + dualW / 2, passY + 26, 16).fill("rgba(255,255,255,0.25)");
  doc.font(F.bold).fontSize(10).fillColor(COLOR.white).text("Ramesh H.", mockRightX, passY + 50, { width: dualW, align: "center" });
  doc.font(F.reg).fontSize(7).fillColor("rgba(255,255,255,0.8)").text("Sofa Enquiry · Host: Suresh", mockRightX, passY + 64, { width: dualW, align: "center" });
  const passPillW = 60;
  doc.roundedRect(mockRightX + (dualW - passPillW) / 2, passY + passH - 24, passPillW, 16, 8).fill("rgba(255,255,255,0.2)");
  doc.font(F.bold).fontSize(7).fillColor(COLOR.white).text("Accepted", mockRightX + (dualW - passPillW) / 2, passY + passH - 20, { width: passPillW, align: "center" });

  y += mockH + 20;
  const diffH = 62;
  brandGradientRect(doc, MARGIN, y, CONTENT_W, diffH, 10);
  const diffs = [["No hardware", "Works on any phone"], ["WhatsApp-native", "No new app to learn"], ["Live in 15 min", "From sign-up to go-live"], ["Every plan", "Smart Forms included free"]];
  const diffColW = CONTENT_W / 4;
  diffs.forEach(([big, small], i) => {
    const dxp = MARGIN + i * diffColW;
    doc.font(F.bold).fontSize(10.5).fillColor(COLOR.white).text(big, dxp, y + 16, { width: diffColW, align: "center" });
    doc.font(F.reg).fontSize(8.5).fillColor("rgba(255,255,255,0.8)").text(small, dxp, y + 33, { width: diffColW, align: "center" });
  });

  /* ===== PAGE 4 — MORE POWERFUL TOOLS ===== */
  doc.addPage();
  pageFooter(doc);
  y = MARGIN;
  kicker(doc, MARGIN, y, "Beyond Check-In");
  y += 22;
  {
    const toolsTitle = "Everything else that keeps your operation running";
    doc.font(F.bold).fontSize(23);
    const titleH = doc.heightOfString(toolsTitle, { width: CONTENT_W, lineGap: 3 });
    doc.fillColor(COLOR.ink).text(toolsTitle, MARGIN, y, { width: CONTENT_W, lineGap: 3 });
    y += titleH + 16;
  }
  doc.font(F.reg).fontSize(11.5).fillColor(COLOR.inkSoft)
    .text("Beyond the front-desk flow, four more tools shape exactly how information is collected and how your space is used.",
      MARGIN, y, { width: CONTENT_W, lineGap: 2 });
  y += 40;

  const toolCardW = (CONTENT_W - 20) / 2;
  const tools = [
    ["Employee Directory", [
      "Add employees one at a time, or bulk-upload a whole team via Excel with row-level error checking",
      "Mark someone Inactive instead of deleting them, to preserve their full visit history",
      "Restrict conference booking to logged-in employees only, or leave the public link open",
    ]],
    ["Form Builder", [
      "Field Toggles: turn any optional field on or off per registration step (Email, Company, Department, ID Proof, and more)",
      "Purpose of Visit: build up to 10 categories with up to 10 sub-categories each",
      "Custom Fields: add up to 5 fully custom fields — Text, Number, or Dropdown with up to 20 options",
      "Every change applies to the very next registration — no publish step",
    ]],
    ["Smart Forms", [
      "A standalone QR-based data collector, separate from your visitor QR — for feedback, leads, or sign-ups",
      "Up to 2 active forms at once, each with unlimited responses",
      "Up to 5 fields per form, including dependent dropdowns that narrow options based on an earlier answer",
      "5 theme presets, an optional logo/name override, and a downloadable branded QR card",
      "Retiring a form frees a slot but keeps every response fully intact and exportable",
    ]],
    ["Conference Booking", [
      "Add each room with a name, photo, and capacity from Manage Rooms",
      "Share one link — bookers pick a room, date, and a 15-minute slot from that day's live availability grid",
      "Every booking is reviewed centrally, with the option to cancel or reassign a room",
      "Restrict booking to employees only, or leave it open to anyone with the link",
    ]],
  ];
  const toolStartY = y;
  let maxColBottom = [toolStartY, toolStartY];
  tools.forEach(([title, items], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const tx = MARGIN + col * (toolCardW + 20);
    let ty2 = row === 0 ? toolStartY : maxColBottom[col] + 16;
    const cardTopY = ty2;
    doc.font(F.bold).fontSize(12.5).fillColor(COLOR.purple700).text(title, tx + 16, ty2 + 14);
    let iy = ty2 + 38;
    items.forEach((it) => {
      checklistItem(doc, tx + 16, iy, toolCardW - 32, it);
      iy += doc.heightOfString(it, { width: toolCardW - 44, lineGap: 2 }) + 8;
    });
    const cardH = iy - cardTopY + 8;
    doc.roundedRect(tx, cardTopY, toolCardW, cardH, 10).stroke(COLOR.line);
    maxColBottom[col] = cardTopY + cardH;
  });

  /* ===== PAGE 5 — SETUP GUIDE ===== */
  doc.addPage();
  pageFooter(doc);
  y = MARGIN;
  kicker(doc, MARGIN, y, "Getting Started");
  y += 22;
  doc.font(F.bold).fontSize(23).fillColor(COLOR.ink).text("From sign-up to your first check-in", MARGIN, y, { width: CONTENT_W });
  y += 34;
  doc.font(F.reg).fontSize(11).fillColor(COLOR.inkSoft)
    .text("Most teams are fully live — QR code printed and at reception — within 15 minutes of paying. Here's exactly what that looks like.",
      MARGIN, y, { width: CONTENT_W, lineGap: 1.5 });
  y += 34;

  const stepColW = CONTENT_W - 190;
  const steps = [
    ["Sign up and start your trial", "Pay Rs. 49 for a 15-day trial from the landing page (email + phone only), or register directly with your full company details if you're ready to commit.", "haivisitor.zodopt.com -> /register"],
    ["Complete your company profile", "Set your real company name, upload your logo, and add your WhatsApp number — this is what visitors and hosts see on every pass and notification.", "/complete-registration -> /home"],
    ["Configure Form Builder", "Turn on only the fields you need, and build your own \"Purpose of Visit\" categories (e.g. Sales Enquiry -> Sofa / Tiles / Modular Kitchen).", "/home/form-builder"],
    ["Add your team", "Add employees one at a time or bulk-upload an Excel sheet, so visitors can search for exactly who they're meeting.", "/visitor/admin"],
    ["Share your QR code", "Print your unique registration QR code or display it on a tablet at reception — anyone who scans it can register in seconds.", "/visitor/dashboard"],
    ["Optional — set up Conference Rooms", "Open Conference Booking -> Manage Rooms and add each room with a name, photo, and capacity. Share the booking link — anyone with it (or employees only, if restricted) can pick a room, date, and time slot.", "/conference/dashboard"],
    ["Optional — launch a Smart Form", "Build a standalone QR data collector with up to 5 fields, pick a theme, and download its branded QR card to collect feedback, leads, or sign-ups — completely separate from your visitor QR.", "/smart-forms/dashboard"],
  ];
  const stepStartY = y;
  steps.forEach(([title, desc, route], i) => {
    doc.roundedRect(MARGIN, y, 22, 22, 6).fill(COLOR.purple700);
    doc.font(F.bold).fontSize(10.5).fillColor(COLOR.white).text(String(i + 1), MARGIN, y + 5.5, { width: 22, align: "center" });
    doc.font(F.bold).fontSize(11).fillColor(COLOR.ink).text(title, MARGIN + 32, y, { width: stepColW - 32 });
    const titleH = doc.heightOfString(title, { width: stepColW - 32 });
    doc.font(F.reg).fontSize(9.5).fillColor(COLOR.inkSoft).text(desc, MARGIN + 32, y + titleH + 3, { width: stepColW - 32, lineGap: 1.2 });
    const descH = doc.heightOfString(desc, { width: stepColW - 32, lineGap: 1.2 });
    routePill(doc, MARGIN + 32, y + titleH + descH + 7, route);
    y += Math.max(22, titleH + descH + 27) + 8;
  });

  // Right-side mockup stack
  const mockX = MARGIN + stepColW + 16;
  const mockW = PAGE_W - MARGIN - mockX;
  let my = stepStartY;
  softShadow(doc, mockX, my, mockW, 116, 10);
  doc.roundedRect(mockX, my, mockW, 116, 10).fillAndStroke(COLOR.purple50, COLOR.line);
  windowChrome(doc, mockX + 10, my + 10, mockW - 20, "/home/form-builder");
  const toggles = [["Email Address", true], ["Person to Meet", true], ["ID Proof", false]];
  let ty = my + 42;
  toggles.forEach(([label, on]) => {
    doc.font(F.bold).fontSize(7.5).fillColor(COLOR.ink).text(label, mockX + 12, ty);
    doc.roundedRect(mockX + mockW - 38, ty - 2, 26, 13, 6.5).fill(on ? COLOR.purple600 : COLOR.line);
    doc.circle(mockX + mockW - (on ? 15 : 32), ty + 4.5, 5).fill(COLOR.white);
    ty += 24;
  });
  my += 130;
  softShadow(doc, mockX, my, mockW, 96, 10);
  doc.roundedRect(mockX, my, mockW, 96, 10).fillAndStroke(COLOR.purple50, COLOR.line);
  windowChrome(doc, mockX + 10, my + 10, mockW - 20, "/visitor/admin");
  const emps = [["SR", "Suresh R."], ["DK", "Divya K."]];
  let ey = my + 44;
  emps.forEach(([initials, name]) => {
    iconSquare(doc, mockX + 12, ey - 2, 16, COLOR.purple700, COLOR.purple500, 8);
    doc.font(F.bold).fontSize(6).fillColor(COLOR.white).text(initials, mockX + 12, ey + 3, { width: 16, align: "center" });
    doc.font(F.reg).fontSize(8).fillColor(COLOR.ink).text(name, mockX + 34, ey + 1);
    doc.roundedRect(mockX + mockW - 46, ey - 3, 40, 15, 7.5).fill(COLOR.successBg);
    doc.font(F.bold).fontSize(6.5).fillColor(COLOR.success).text("Active", mockX + mockW - 46, ey + 1, { width: 40, align: "center" });
    ey += 26;
  });

  y = Math.max(y, my + 106) + 6;
  const footerH = 44;
  doc.roundedRect(MARGIN, y, CONTENT_W, footerH, 10).dash(4, { space: 3 }).stroke(COLOR.purple500);
  doc.undash();
  doc.font(F.bold).fontSize(10).fillColor(COLOR.purple700)
    .text("That's it — no IT team, no installation, no dedicated hardware. Just sign up, configure, and print your QR code.",
      MARGIN + 16, y + 13, { width: CONTENT_W - 32, align: "center", lineGap: 2 });

  /* ===== PAGE 6 — PRICING + CONTACT ===== */
  doc.addPage();
  pageFooter(doc);
  y = MARGIN;
  kicker(doc, MARGIN, y, "Plans & Contact");
  y += 22;
  doc.font(F.bold).fontSize(23).fillColor(COLOR.ink).text("Plans that scale with you", MARGIN, y, { width: CONTENT_W });
  y += 36;
  doc.font(F.reg).fontSize(11.5).fillColor(COLOR.inkSoft)
    .text("Every plan includes Smart Forms and the full visitor registration flow — upgrade any time as your team grows.", MARGIN, y, { width: CONTENT_W, lineGap: 2 });
  y += 44;

  const priceFrameH = 252;
  softShadow(doc, MARGIN, y, CONTENT_W, priceFrameH, 12);
  doc.roundedRect(MARGIN, y, CONTENT_W, priceFrameH, 12).fillAndStroke(COLOR.purple50, COLOR.line);
  windowChrome(doc, MARGIN + 12, y + 12, CONTENT_W - 24, "haivisitor.zodopt.com/home/plans");

  const plans = [
    ["TRIAL", "Rs. 49", "/15 days", ["100 Visitor Bookings", "2 Conference Rooms", "Email Support"], false],
    ["BUSINESS", "Rs. 500", "/mo · Rs. 5,500/yr", ["Unlimited Visitors", "Custom Registration Fields", "Priority Support"], true],
    ["ENTERPRISE", "Rs. 1,000", "/mo · Rs. 10,000/yr", ["Unlimited Visitors & Bookings", "Unlimited Conference Rooms", "Dedicated Support"], false],
  ];
  const pCardW = (CONTENT_W - 24 - 24) / 3;
  const pCardY = y + 42;
  const pCardH = priceFrameH - 54;
  plans.forEach(([name, amt, period, items, popular], i) => {
    const px = MARGIN + 12 + i * (pCardW + 12);
    doc.roundedRect(px, pCardY, pCardW, pCardH, 8).fillAndStroke(COLOR.white, popular ? COLOR.purple500 : COLOR.line);
    if (popular) {
      const badgeW = 74;
      doc.roundedRect(px + 12, pCardY - 8, badgeW, 16, 8).fill(COLOR.orange);
      doc.font(F.bold).fontSize(6.5).fillColor(COLOR.white).text("MOST POPULAR", px + 12, pCardY - 4, { width: badgeW, align: "center" });
    }
    doc.font(F.bold).fontSize(10.5).fillColor(COLOR.ink).text(name, px + 12, pCardY + 14);
    // Stack the period under the amount rather than beside it — Enterprise's
    // longer text ("Rs. 1,000 /mo · Rs. 10,000/yr") overflowed the card's
    // right edge when placed inline; stacking is safe at any text length.
    doc.font(F.bold).fontSize(17).fillColor(COLOR.purple700).text(amt, px + 12, pCardY + 32, { width: pCardW - 24, lineBreak: false });
    doc.font(F.reg).fontSize(9).fillColor(COLOR.inkFaint).text(period, px + 12, pCardY + 53, { width: pCardW - 24 });
    let liY = pCardY + 70;
    items.forEach((it) => {
      checklistItem(doc, px + 12, liY, pCardW - 24, it, COLOR.success);
      liY += doc.heightOfString(it, { width: pCardW - 36 }) + 6;
    });
  });
  y += priceFrameH + 20;

  const ctaH = 60;
  brandGradientRect(doc, MARGIN, y, CONTENT_W, ctaH);
  doc.font(F.bold).fontSize(13.5).fillColor(COLOR.white).text("Start your 15-day trial today for Rs. 49", MARGIN, y + 15, { width: CONTENT_W, align: "center" });
  doc.font(F.reg).fontSize(9.5).fillColor("rgba(255,255,255,0.8)").text("No commitment — cancel any time before it renews", MARGIN, y + 36, { width: CONTENT_W, align: "center" });
  y += ctaH + 30;

  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(1).stroke(COLOR.line);
  y += 22;
  const contacts = [["EMAIL", "admin@haivisitor.zodopt.com"], ["PHONE", "+91 8647878785"], ["SUPPORT", "Mon–Fri, 9AM–6PM IST"], ["WEBSITE", "haivisitor.zodopt.com"]];
  let cy = y;
  contacts.forEach(([label, val]) => {
    doc.font(F.bold).fontSize(8.5).fillColor(COLOR.inkFaint).text(label, MARGIN, cy, { width: 76, characterSpacing: 0.5 });
    doc.font(F.bold).fontSize(11).fillColor(COLOR.ink).text(val, MARGIN + 84, cy);
    cy += 25;
  });

  const qrSize = 96;
  const qrX = PAGE_W - MARGIN - qrSize;
  softShadow(doc, qrX - 8, y - 8, qrSize + 16, qrSize + 16, 10);
  doc.roundedRect(qrX - 8, y - 8, qrSize + 16, qrSize + 16, 10).fillAndStroke(COLOR.white, COLOR.line);
  doc.image(qrBuffer, qrX, y, { width: qrSize, height: qrSize });
  doc.font(F.bold).fontSize(8.5).fillColor(COLOR.inkFaint).text("Scan to visit haivisitor.zodopt.com", qrX - 20, y + qrSize + 14, { width: qrSize + 40, align: "center" });

  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));
  console.log("Brochure written to", OUT_PATH);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
