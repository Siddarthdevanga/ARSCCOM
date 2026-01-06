import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

/* ======================================================
   HELPERS – SMART IST FORMATTER (Prevents Double Shift)
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  // Strings without timezone (DB already IST) → DON'T reapply TZ
  if (typeof value === "string") {
    const hasTZ =
      value.includes("Z") ||
      value.includes("+") ||
      value.toLowerCase().includes("gmt");

    if (!hasTZ) {
      const d = new Date(value);
      if (isNaN(d)) return "-";

      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    }
  }

  // Normal UTC → IST conversion
  const d = new Date(value);
  if (isNaN(d)) return "-";

  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
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
