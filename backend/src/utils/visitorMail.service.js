import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

/* ======================================================
   SAFE IST FORMATTER
   Supports:
   1️⃣ 2026-01-06 10:42:44        (already IST)
   2️⃣ 2026-01-06T11:20:20.000Z   (UTC ISO → convert to IST)
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  /* ---------- CASE 1: ISO UTC ---------- */
  if (value.includes("T")) {
    try {
      const [datePart, timePartFull] = value.split("T");
      const timePart = timePartFull.split(".")[0]; // HH:MM:SS

      let [h, m] = timePart.split(":").map(Number);

      // Add +5:30 → 330 mins
      let totalMinutes = h * 60 + m + 330;
      let finalH = Math.floor(totalMinutes / 60) % 24;
      let finalM = totalMinutes % 60;

      const suffix = finalH >= 12 ? "PM" : "AM";
      finalH = finalH % 12 || 12;

      const [yyyy, mm, dd] = datePart.split("-");

      const monthNames = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
      ];
      const monthName = monthNames[parseInt(mm, 10) - 1];

      return `${dd} ${monthName} ${yyyy}, ${finalH}:${String(finalM).padStart(2,"0")} ${suffix}`;
    } catch {
      return value;
    }
  }

  /* ---------- CASE 2: Already IST (MySQL Format) ---------- */
  const parts = value.split(" ");
  if (parts.length < 2) return value;

  const [y, mo, d] = parts[0].split("-");
  let [h, m] = parts[1].split(":");

  let hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  const monthNames = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];
  const monthName = monthNames[parseInt(mo, 10) - 1] || "";

  return `${d} ${monthName} ${y}, ${hour}:${m} ${suffix}`;
};

/* ======================================================
   SEND VISITOR PASS EMAIL
====================================================== */
export const sendVisitorPassMail = async ({ company = {}, visitor = {} }) => {
  if (!visitor.email) return;

  let imageBuffer = null;

  try {
    imageBuffer = await generateVisitorPassImage({ company, visitor });
  } catch (err) {
    console.error("VISITOR PASS IMAGE ERROR:", err.message);
  }

  await sendEmail({
    to: visitor.email,
    subject: `Your Visitor Pass – ${company.name || "ARSCCOM"}`,
    html: `
      <p>Hello <b>${visitor.name || "Visitor"}</b>,</p>

      <p>Your visitor pass has been generated successfully.</p>

      <p>
        <b>Visitor ID:</b> ${visitor.visitorCode || "-"}<br/>
        <b>Company:</b> ${company.name || "-"}<br/>
        <b>Check-in:</b> ${formatIST(visitor.checkIn)} (IST)
      </p>

      <p>Please show the attached visitor pass at the reception.</p>

      <br/>
      <p>
        Regards,<br/>
        <b>${company.name || "ARSCCOM"}</b><br/>
        ARSCCOM Visitor Management
      </p>
    `,
    attachments: imageBuffer
      ? [
          {
            filename: "visitor-pass.png",
            content: imageBuffer,
            contentType: "image/png"
          }
        ]
      : []
  });
};
