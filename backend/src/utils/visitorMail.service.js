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
   EMAIL FOOTER — COMPANY BRANDING ONLY
====================================================== */
export const emailFooter = (company = {}) => {
  const companyName = company?.name || "Promeet";
  const companyLogo = company?.logo_url || company?.logo || null;

  return `
<br/>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;margin:10px 0 0 0;">
  Regards,<br/>
  <b>${companyName}</b>
</p>

${companyLogo
  ? `
  <img
    src="${companyLogo}"
    alt="${companyName} Logo"
    style="margin-top:10px;height:60px;border-radius:8px;border:1px solid #eee;background:#fff;padding:6px;display:block;"
  />
`
  : ""
}

<hr style="border:0;border-top:1px solid #ddd;margin:20px 0 10px 0;" />

<p style="font-size:13px;color:#666;margin:0;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
  This email was automatically sent from the <b>PROMEET Visitor Management Platform</b>.
  If you did not perform this action, please contact ${companyName} administrator immediately.
</p>
`;
};

/* ======================================================
   SEND VISITOR PASS EMAIL — PROFESSIONAL VERSION
====================================================== */
export const sendVisitorPassMail = async ({ company = {}, visitor = {} }) => {
  if (!visitor.email) return;

  const companyName = company.name || "Promeet";
  const visitorName = visitor.name || "Visitor";
  const visitorCode = visitor.visitorCode || "-";
  const checkInTime = formatIST(visitor.checkIn);
  const personToMeet = visitor.personToMeet || "Reception";
  const purpose = visitor.purpose || "Visit";

  let imageBuffer = null;

  try {
    imageBuffer = await generateVisitorPassImage({ company, visitor });
  } catch (err) {
    console.error("[VISITOR_PASS_IMAGE] Error:", err.message);
  }

  try {
    await sendEmail({
      to: visitor.email,
      subject: `Welcome to ${companyName} — Your Digital Visitor Pass`,
      html: `
        <p>Hello <b>${visitorName}</b>,</p>

        <p>
          Welcome to <b>${companyName}</b>! Your visitor registration has been successfully processed, 
          and your digital visitor pass is ready.
        </p>

        <div style="background:#e8f5e9;border-left:4px solid #00c853;padding:16px;margin:20px 0;">
          <p style="margin:0;color:#2e7d32;font-weight:600;">
            ✓ Registration Confirmed — Check-in Completed
          </p>
        </div>

        <h3 style="color:#6c2bd9;margin-top:30px;margin-bottom:10px;">
          Visit Details
        </h3>

        <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin-bottom:20px;">
          <tr style="background:#f8f9ff;">
            <td style="padding:12px;border:1px solid #e0e0e0;font-weight:600;color:#6c2bd9;width:35%;">
              Visitor ID
            </td>
            <td style="padding:12px;border:1px solid #e0e0e0;">
              <b style="color:#222;font-size:15px;">${visitorCode}</b>
            </td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #e0e0e0;font-weight:600;color:#6c2bd9;">
              Visitor Name
            </td>
            <td style="padding:12px;border:1px solid #e0e0e0;">
              ${visitorName}
            </td>
          </tr>
          <tr style="background:#f8f9ff;">
            <td style="padding:12px;border:1px solid #e0e0e0;font-weight:600;color:#6c2bd9;">
              Company
            </td>
            <td style="padding:12px;border:1px solid #e0e0e0;">
              ${companyName}
            </td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #e0e0e0;font-weight:600;color:#6c2bd9;">
              Check-in Time
            </td>
            <td style="padding:12px;border:1px solid #e0e0e0;">
              ${checkInTime} <span style="color:#666;font-size:12px;">(IST)</span>
            </td>
          </tr>
          <tr style="background:#f8f9ff;">
            <td style="padding:12px;border:1px solid #e0e0e0;font-weight:600;color:#6c2bd9;">
              Person to Meet
            </td>
            <td style="padding:12px;border:1px solid #e0e0e0;">
              ${personToMeet}
            </td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #e0e0e0;font-weight:600;color:#6c2bd9;">
              Purpose of Visit
            </td>
            <td style="padding:12px;border:1px solid #e0e0e0;">
              ${purpose}
            </td>
          </tr>
        </table>

        <h3 style="color:#6c2bd9;margin-top:30px;margin-bottom:10px;">
          Your Digital Visitor Pass
        </h3>

        <p>
          Your visitor pass is attached to this email as an image. 
          Please <b>show this pass at the reception</b> or security checkpoint when requested.
        </p>

        <div style="background:#fff3e0;border-left:4px solid #ff9800;padding:16px;margin:20px 0;">
          <p style="margin:0;color:#e65100;font-weight:600;">
            📱 Keep this email handy on your mobile device for easy access
          </p>
        </div>

        <h3 style="color:#6c2bd9;margin-top:30px;margin-bottom:10px;">
          Important Guidelines
        </h3>

        <ul style="font-size:14px;line-height:1.8;color:#333;">
          <li>
            <b>Display your visitor pass</b> when entering the premises or when requested by security.
          </li>
          <li>
            <b>Check-out is mandatory</b> — Please inform reception when leaving the premises.
          </li>
          <li>
            <b>Follow company policies</b> — Adhere to all security protocols and visitor guidelines.
          </li>
          <li>
            <b>Report any issues</b> — Contact reception immediately if you face any difficulties.
          </li>
        </ul>

        <div style="background:#f8f9ff;border-left:4px solid #6c2bd9;padding:16px;margin:30px 0;">
          <p style="margin:0;color:#6c2bd9;font-weight:600;">
            📧 Need help? Contact ${companyName} reception or administrator for assistance.
          </p>
        </div>

        <p>
          Thank you for visiting <b>${companyName}</b>. 
          We hope you have a productive and pleasant experience.
        </p>

        ${emailFooter(company)}
      `,
      attachments: imageBuffer
        ? [
            {
              filename: `${visitorCode}-visitor-pass.png`,
              content: imageBuffer,
              contentType: "image/png"
            }
          ]
        : []
    });

    console.log(`[VISITOR_MAIL] Pass sent successfully to ${visitor.email}`);

  } catch (err) {
    console.error("[VISITOR_MAIL] Error sending email:", err.message);
    throw err;
  }
};
