import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

/* ─────────────────────────────────────────────
   DATE FORMATTER — IST
───────────────────────────────────────────── */
const formatIST = (value) => {
  if (!value) return "-";
  try {
    let date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      const [datePart, timePart] = value.split(" ");
      const [year, month, day]   = datePart.split("-");
      const [hour, minute, second] = timePart.split(":");
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);
    } else {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch (err) {
    console.error("[formatIST] Error:", err.message);
    return "-";
  }
};

/* ─────────────────────────────────────────────
   SHARED DESIGN TOKENS (inline, email-safe)
───────────────────────────────────────────── */
const T = {
  purple:      "#5b21b6",
  purpleMid:   "#7c3aed",
  purpleLight: "#ede9fe",
  purpleBorder:"#c4b5fd",
  green:       "#15803d",
  greenBg:     "#f0fdf4",
  greenBorder: "#86efac",
  greenBtn:    "#16a34a",
  greenBtnHov: "#15803d",
  red:         "#b91c1c",
  redBg:       "#fef2f2",
  redBorder:   "#fca5a5",
  redBtn:      "#dc2626",
  amber:       "#92400e",
  amberBg:     "#fffbeb",
  amberBorder: "#fcd34d",
  grey:        "#6b7280",
  greyLight:   "#f9fafb",
  greyBorder:  "#e5e7eb",
  text:        "#111827",
  textSub:     "#374151",
  textMuted:   "#6b7280",
  white:       "#ffffff",
  fontStack:   "Georgia, 'Times New Roman', serif",
  fontSans:    "'Helvetica Neue', Arial, Helvetica, sans-serif",
};

/* ─────────────────────────────────────────────
   SHARED EMAIL SHELL
   Wraps any inner HTML in a consistent branded
   outer layout: logo bar + content card + footer
───────────────────────────────────────────── */
const emailShell = ({ company = {}, preheader = "", body = "" }) => {
  const companyName = company?.name || "Promeet";
  const logoUrl     = company?.logo_url || company?.logo || null;
  const year        = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${preheader}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, html { margin:0; padding:0; width:100%; background:#f3f4f6; }
    body { font-family:${T.fontSans}; font-size:15px; color:${T.text}; -webkit-font-smoothing:antialiased; }
    a { color:${T.purpleMid}; }
    img { border:0; display:block; }
    .preheader { display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; color:#f3f4f6; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; padding:0 !important; }
      .email-card    { border-radius:0 !important; }
      .btn-cell      { display:block !important; width:100% !important; padding:6px 0 !important; }
      .btn           { display:block !important; width:100% !important; box-sizing:border-box !important; margin:0 !important; }
    }
  </style>
</head>
<body>
<span class="preheader">${preheader}</span>

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr>
    <td align="center">

      <!-- Card -->
      <table class="email-card" width="600" cellpadding="0" cellspacing="0" border="0"
             style="background:${T.white};border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- Header bar -->
        <tr>
          <td style="background:linear-gradient(135deg,${T.purple} 0%,${T.purpleMid} 100%);
                     padding:32px 40px;text-align:center;">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="${companyName}" height="48"
                      style="border-radius:8px;background:rgba(255,255,255,0.15);
                             padding:8px 12px;margin:0 auto 16px;"/>`
              : ""}
            <p style="margin:0;font-family:${T.fontStack};font-size:22px;font-weight:700;
                      color:${T.white};letter-spacing:-0.3px;">
              ${companyName}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${T.greyLight};border-top:1px solid ${T.greyBorder};
                     padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:${T.textMuted};font-family:${T.fontSans};">
              This message was sent automatically by the
              <strong style="color:${T.textSub};">Promeet Visitor Management Platform</strong>.
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;font-family:${T.fontSans};">
              If you did not expect this email, please contact your ${companyName} administrator.
              &copy; ${year} ${companyName}. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td>
  </tr>
</table>
</body>
</html>`;
};

/* ─────────────────────────────────────────────
   HELPER: detail row for visit summary table
───────────────────────────────────────────── */
const detailRow = (label, value, shade = false) => `
<tr style="background:${shade ? T.purpleLight : T.white};">
  <td style="padding:11px 16px;font-size:13px;font-weight:600;color:${T.purple};
             width:38%;border-bottom:1px solid ${T.greyBorder};font-family:${T.fontSans};
             white-space:nowrap;vertical-align:top;">
    ${label}
  </td>
  <td style="padding:11px 16px;font-size:14px;color:${T.textSub};
             border-bottom:1px solid ${T.greyBorder};font-family:${T.fontSans};
             vertical-align:top;">
    ${value || "-"}
  </td>
</tr>`;

/* ─────────────────────────────────────────────
   HELPER: section heading
───────────────────────────────────────────── */
const sectionHeading = (text) => `
<p style="margin:28px 0 12px;font-size:11px;font-weight:700;letter-spacing:1.2px;
          text-transform:uppercase;color:${T.purple};font-family:${T.fontSans};
          border-bottom:2px solid ${T.purpleLight};padding-bottom:6px;">
  ${text}
</p>`;

/* ─────────────────────────────────────────────
   HELPER: info badge
───────────────────────────────────────────── */
const badge = (text, { bg, border, color }) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
  <tr>
    <td style="background:${bg};border-left:4px solid ${border};border-radius:0 6px 6px 0;
               padding:14px 18px;font-size:14px;color:${color};font-family:${T.fontSans};
               line-height:1.6;">
      ${text}
    </td>
  </tr>
</table>`;

/* ═══════════════════════════════════════════════
   1. VISITOR PASS EMAIL
   Sent to the visitor upon successful check-in.
═══════════════════════════════════════════════ */
export const sendVisitorPassMail = async ({ company = {}, visitor = {} }) => {
  if (!visitor.email) {
    console.log("[VISITOR_MAIL] No email — skipping");
    return;
  }

  const companyName  = company.name  || "Promeet";
  const visitorName  = visitor.name  || "Visitor";
  const visitorCode  = visitor.visitorCode || "-";
  const phone        = visitor.phone || "-";
  const personToMeet = visitor.personToMeet || "Reception";
  const purpose      = visitor.purpose || "Visit";
  const checkInTime  = visitor.checkInDisplay || formatIST(visitor.checkIn);

  console.log(`[VISITOR_MAIL] Preparing pass for ${visitor.email}`);

  let imageBuffer = null;
  try {
    imageBuffer = await generateVisitorPassImage({ company, visitor });
  } catch (err) {
    console.error("[VISITOR_MAIL] Pass image error:", err.message);
  }

  const body = `
    <!-- Greeting -->
    <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:${T.text};font-family:${T.fontSans};">
      Dear ${visitorName},
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:${T.textSub};line-height:1.7;font-family:${T.fontSans};">
      Your visitor registration at <strong>${companyName}</strong> has been successfully
      completed. Please find your digital visitor pass details below.
    </p>

    <!-- Confirmation badge -->
    ${badge(
      `Registration confirmed. Your visitor pass has been issued and is attached to this email.`,
      { bg: T.greenBg, border: T.greenBtn, color: T.green }
    )}

    <!-- Visitor ID callout -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:20px 0;background:${T.purpleLight};border:1px solid ${T.purpleBorder};
                  border-radius:8px;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1.4px;
                    text-transform:uppercase;color:${T.purple};font-family:${T.fontSans};">
            Visitor ID
          </p>
          <p style="margin:0;font-size:28px;font-weight:700;color:${T.purple};
                    letter-spacing:4px;font-family:${T.fontStack};">
            ${visitorCode}
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:${T.textMuted};font-family:${T.fontSans};">
            Present this ID at the reception desk when requested
          </p>
        </td>
      </tr>
    </table>

    ${sectionHeading("Visit Details")}
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid ${T.greyBorder};border-radius:8px;overflow:hidden;">
      ${detailRow("Visitor Name",    visitorName,  false)}
      ${detailRow("Phone",           phone,         true)}
      ${detailRow("Organization",    companyName,   false)}
      ${detailRow("Person to Meet",  personToMeet,  true)}
      ${detailRow("Purpose",         purpose,       false)}
      ${detailRow("Check-in Time",   `${checkInTime} <span style="color:${T.textMuted};font-size:12px;">(IST)</span>`, true)}
    </table>

    ${sectionHeading("Visitor Guidelines")}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
      ${[
        ["Display your pass", "Present this visitor pass at the entrance and whenever requested by security personnel."],
        ["Check-out required", "Please inform the reception desk when you are leaving the premises."],
        ["Follow protocols", "Adhere to all company security and safety policies during your visit."],
        ["Keep email handy", "Keep this email accessible on your mobile device throughout your visit."],
      ].map(([title, desc], i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${T.greyBorder};font-family:${T.fontSans};">
          <p style="margin:0;font-size:14px;">
            <strong style="color:${T.textSub};">${title}.</strong>
            <span style="color:${T.textMuted};">&ensp;${desc}</span>
          </p>
        </td>
      </tr>`).join("")}
    </table>

    ${company.whatsapp_url ? `
    ${sectionHeading("Stay Connected")}
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;margin:0 0 8px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#14532d;font-family:${T.fontSans};">
            Join ${companyName} on WhatsApp
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:#166534;font-family:${T.fontSans};line-height:1.6;">
            Receive instant updates and support during your visit.
          </p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#16a34a;border-radius:6px;">
                <a href="${company.whatsapp_url}"
                   style="display:inline-block;padding:11px 28px;font-size:14px;font-weight:700;
                          color:${T.white};text-decoration:none;font-family:${T.fontSans};
                          letter-spacing:0.2px;">
                  Join WhatsApp Group
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : ""}

    <p style="margin:28px 0 0;font-size:14px;color:${T.textMuted};line-height:1.7;font-family:${T.fontSans};">
      Thank you for visiting <strong style="color:${T.textSub};">${companyName}</strong>.
      We hope you have a productive visit. If you require any assistance, please approach the reception desk.
    </p>
  `;

  await sendEmail({
    to: visitor.email,
    subject: `Visitor Pass Issued — ${companyName} | Ref: ${visitorCode}`,
    html: emailShell({
      company,
      preheader: `Your visitor pass for ${companyName} is ready. Visitor ID: ${visitorCode}`,
      body,
    }),
    attachments: imageBuffer
      ? [{
          filename:    `${visitorCode}-visitor-pass.png`,
          content:     imageBuffer,
          contentType: "image/png",
          cid:         "visitor-pass-image",
        }]
      : [],
  });

  console.log(`[VISITOR_MAIL] Pass sent to ${visitor.email}`);
};

/* ═══════════════════════════════════════════════
   2. EMPLOYEE NOTIFICATION EMAIL
   Sent to the employee being visited.
   Contains Accept / Decline action buttons.
═══════════════════════════════════════════════ */
export const sendEmployeeNotificationMail = async ({
  company = {},
  employee = {},
  visitor = {},
  responseToken,
}) => {
  if (!employee.email) {
    console.log("[EMP_MAIL] No employee email — skipping");
    return;
  }
  if (!responseToken) {
    console.log("[EMP_MAIL] No response token — skipping");
    return;
  }

  const baseUrl =
    process.env.BACKEND_URL  ||
    process.env.API_BASE_URL ||
    process.env.FRONTEND_URL ||
    "";

  if (!baseUrl) {
    console.error("[EMP_MAIL] WARNING: No BACKEND_URL — accept/decline links will be broken");
  }

  const acceptUrl  = `${baseUrl}/api/visit-response/${responseToken}/accept`;
  const declineUrl = `${baseUrl}/api/visit-response/${responseToken}/decline`;

  const companyName  = company.name    || "Promeet";
  const employeeName = employee.name   || "there";
  const visitorName  = visitor.name    || "A Visitor";
  const checkInTime  = visitor.checkInDisplay || formatIST(visitor.checkIn);

  console.log(`[EMP_MAIL] Sending to ${employee.email}`);
  console.log(`[EMP_MAIL] Accept  → ${acceptUrl}`);
  console.log(`[EMP_MAIL] Decline → ${declineUrl}`);

  const body = `
    <!-- Greeting -->
    <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:${T.text};font-family:${T.fontSans};">
      Dear ${employeeName},
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:${T.textSub};line-height:1.7;font-family:${T.fontSans};">
      A visitor has arrived at the reception desk and is waiting to meet you.
      Please review the details below and respond at your earliest convenience.
    </p>

    <!-- Visitor photo -->
    ${visitor.photoUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td align="center">
          <img src="${visitor.photoUrl}" alt="${visitorName}"
               width="88" height="88"
               style="width:88px;height:88px;border-radius:50%;object-fit:cover;
                      border:3px solid ${T.purpleBorder};
                      box-shadow:0 2px 12px rgba(91,33,182,0.18);" />
          <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:${T.text};
                    font-family:${T.fontSans};">${visitorName}</p>
        </td>
      </tr>
    </table>` : ""}

    <!-- Arrival notice -->
    ${badge(
      `<strong>${visitorName}</strong> checked in at <strong>${checkInTime} (IST)</strong>
       and is waiting at the reception desk.`,
      { bg: T.purpleLight, border: T.purpleMid, color: T.purple }
    )}

    ${sectionHeading("Visitor Information")}
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid ${T.greyBorder};border-radius:8px;overflow:hidden;">
      ${detailRow("Full Name",      `<strong>${visitorName}</strong>`,  false)}
      ${detailRow("Phone",           visitor.phone || "-",               true)}
      ${visitor.email
        ? detailRow("Email",         visitor.email,                      false)
        : ""}
      ${visitor.fromCompany
        ? detailRow("Organisation",  visitor.fromCompany,                true)
        : ""}
      ${visitor.designation
        ? detailRow("Designation",   visitor.designation,                false)
        : ""}
      ${detailRow("Purpose",         visitor.purpose || "Visit",         true)}
      ${detailRow("Arrived At",
        `${checkInTime} <span style="color:${T.textMuted};font-size:12px;">(IST)</span>`,
        false)}
      ${detailRow("Visitor Code",
        `<span style="font-family:monospace;background:${T.purpleLight};
                      color:${T.purple};padding:2px 10px;border-radius:4px;
                      font-weight:700;font-size:13px;">
           ${visitor.visitorCode || "-"}
         </span>`,
        true)}
    </table>

    ${sectionHeading("Action Required")}

    <!-- Action buttons -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${T.greyLight};border:1px solid ${T.greyBorder};
                  border-radius:10px;margin:0 0 8px;">
      <tr>
        <td style="padding:28px 24px;text-align:center;">

          <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:${T.text};
                    font-family:${T.fontSans};">
            Please confirm whether you will receive this visitor.
          </p>
          <p style="margin:0 0 24px;font-size:13px;color:${T.textMuted};font-family:${T.fontSans};">
            Clicking either button below does not require you to log in.
          </p>

          <!-- Two-button row -->
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <!-- Accept -->
              <td class="btn-cell" style="padding:0 8px 0 0;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:${T.greenBtn};border-radius:7px;
                               box-shadow:0 2px 8px rgba(22,163,74,0.28);">
                      <a href="${acceptUrl}" class="btn"
                         style="display:inline-block;padding:14px 36px;
                                font-size:15px;font-weight:700;color:${T.white};
                                text-decoration:none;font-family:${T.fontSans};
                                letter-spacing:0.2px;white-space:nowrap;">
                        Accept Visit
                      </a>
                    </td>
                  </tr>
                </table>
              </td>

              <!-- Decline -->
              <td class="btn-cell" style="padding:0 0 0 8px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:${T.redBtn};border-radius:7px;
                               box-shadow:0 2px 8px rgba(220,38,38,0.22);">
                      <a href="${declineUrl}" class="btn"
                         style="display:inline-block;padding:14px 36px;
                                font-size:15px;font-weight:700;color:${T.white};
                                text-decoration:none;font-family:${T.fontSans};
                                letter-spacing:0.2px;white-space:nowrap;">
                        Decline Visit
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Fallback plain links -->
          <p style="margin:20px 0 0;font-size:12px;color:${T.textMuted};font-family:${T.fontSans};">
            If buttons do not work, copy and paste one of these links into your browser:<br/>
            <span style="color:${T.green};">Accept:</span>
            <a href="${acceptUrl}" style="color:${T.green};font-size:11px;word-break:break-all;">${acceptUrl}</a><br/>
            <span style="color:${T.red};">Decline:</span>
            <a href="${declineUrl}" style="color:${T.red};font-size:11px;word-break:break-all;">${declineUrl}</a>
          </p>

        </td>
      </tr>
    </table>

    <!-- Expiry notice -->
    ${badge(
      `These response links are valid for <strong>48 hours</strong>. After expiry, the visit status
       can still be updated directly from the admin dashboard.`,
      { bg: T.amberBg, border: T.amberBorder, color: T.amber }
    )}

    <p style="margin:24px 0 0;font-size:14px;color:${T.textMuted};line-height:1.7;
              font-family:${T.fontSans};">
      If you have any questions, please contact the reception desk directly or reach out
      to your ${companyName} administrator.
    </p>
  `;

  await sendEmail({
    to:      employee.email,
    subject: `Visitor Arrival: ${visitorName} is at reception — ${companyName}`,
    html: emailShell({
      company,
      preheader: `${visitorName} has arrived at ${companyName} reception and is waiting to meet you.`,
      body,
    }),
  });

  console.log(`[EMP_MAIL] Notification sent to ${employee.email}`);
};
