import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

/* ======================================================
   HELPERS
====================================================== */

// Format date strictly in IST for email
const formatIST = (date) => {
  if (!date) return "-";

  const d = new Date(date);
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

  /* ---------- Generate Visitor Pass Image ---------- */
  try {
    imageBuffer = await generateVisitorPassImage({
      company,
      visitor
    });
  } catch (err) {
    // Image generation failure should NOT block email
    console.error("VISITOR PASS IMAGE ERROR:", err.message);
  }

  /* ---------- Send Email ---------- */
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
