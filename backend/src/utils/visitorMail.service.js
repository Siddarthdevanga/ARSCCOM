import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

/* ======================================================
   SUPER SAFE IST FORMATTER (NO DOUBLE +5:30)
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

  // Date
  if (value instanceof Date && !isNaN(value)) return format(value);

  // Non-string
  if (typeof value !== "string") {
    try {
      const d = new Date(value);
      return isNaN(d) ? "-" : format(d);
    } catch {
      return "-";
    }
  }

  /* ISO with timezone */
  if (
    value.includes("T") &&
    (value.includes("Z") || /[+-]\d\d:?(\d\d)?$/.test(value))
  ) {
    try {
      const d = new Date(value);
      return isNaN(d) ? "-" : format(d);
    } catch {
      return "-";
    }
  }

  /* ISO without timezone → treat as IST */
  if (value.includes("T")) {
    try {
      const d = new Date(value.replace(" ", "T"));
      return isNaN(d) ? "-" : format(d);
    } catch {
      return "-";
    }
  }

  /* MYSQL FORMAT — already IST */
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

/* ======================================================
   EMAIL FOOTER — WITH LOGO BELOW NAME
====================================================== */
export const emailFooter = (company = {}) => {
  const companyName = company?.name || "Promeet";
  const logo =
    company?.logo_url ||
    company?.logo ||
    null;

  return `
<br/>

<p style="
  font-family:Arial, Helvetica, sans-serif;
  font-size:14px;
  color:#222;
  margin:0;
">
  Regards,<br/>
  <b>${companyName}</b>
</p>

${logo
  ? `
  <img
    src="${logo}"
    alt="${companyName} Logo"
    style="
      margin-top:10px;
      height:60px;
      border-radius:10px;
      border:1px solid #eee;
      background:#fff;
      padding:6px;
      display:block;
    "
  />
`
  : ""
}

<p style="
  font-size:12px;
  color:#666;
  margin-top:16px;
  line-height:1.6;
  font-family:Arial, Helvetica, sans-serif;
">
  This is an auto-generated email from the Promeet Visitor Management Platform.
  If you did not perform this action, please contact your administrator immediately.
</p>
`;
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

  try {
    await sendEmail({
      to: visitor.email,
      subject: `Your Visitor Pass – ${company.name || "Promeet"}`,
      html: `
        <p>Hello <b>${visitor.name || "Visitor"}</b>,</p>

        <p>Your visitor pass has been generated successfully.</p>

        <p>
          <b>Visitor ID:</b> ${visitor.visitorCode || "-"}<br/>
          <b>Company:</b> ${company.name || "Promeet"}<br/>
          <b>Check-in:</b> ${formatIST(visitor.checkIn)} (IST)
        </p>

        <p>Please show the attached visitor pass at the reception.</p>

        ${emailFooter(company)}
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
  } catch (err) {
    console.error("VISITOR MAIL ERROR:", err.message);
  }
};
