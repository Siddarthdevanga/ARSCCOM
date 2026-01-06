import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

/* ======================================================
   PURE IST FORMATTER (No Timezone Conversion)
   Input:  2026-01-06 10:42:44
   Output: 06 Jan 2026, 10:42 AM
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  const parts = value.split(" ");
  if (parts.length < 2) return value;

  const date = parts[0]; // YYYY-MM-DD
  const time = parts[1]; // HH:MM:SS

  const [y, mo, d] = date.split("-");
  let [h, m] = time.split(":");

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
