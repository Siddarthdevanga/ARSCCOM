import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

const formatIST = (value) => {
  if (!value) return "-";
  try {
    let date;
    if (value instanceof Date) {
      date = value;
    } else {
      const raw = String(value).trim();
      // "2026-03-09 07:43:00" — no timezone, stored as IST → append +05:30
      // "2026-03-09T07:43:00+05:30" — already tagged, parse as-is
      // Any other ISO string — parse as-is (already has offset or Z)
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
        date = new Date(raw.replace(" ", "T") + "+05:30");
      } else {
        date = new Date(raw);
      }
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

export const emailFooter = (company = {}) => {
  const companyName = company?.name || "Promeet";
  const companyLogo = company?.logo_url || company?.logo || null;
  return `
<br/>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;margin:10px 0 0 0;">
  Regards,<br/><b>${companyName}</b>
</p>
${companyLogo ? `<img src="${companyLogo}" alt="${companyName} Logo" style="margin-top:10px;height:60px;border-radius:8px;border:1px solid #eee;background:#fff;padding:6px;display:block;"/>` : ""}
<hr style="border:0;border-top:1px solid #ddd;margin:20px 0 10px 0;" />
<p style="font-size:13px;color:#666;margin:0;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
  This email was automatically sent from the <b>PROMEET Visitor Management Platform</b>.
  If you did not expect this, please contact ${companyName} administrator.
</p>`;
};

export const sendVisitorPassMail = async ({ company = {}, visitor = {} }) => {
  if (!visitor.email) {
    console.log("[VISITOR_MAIL] No email provided, skipping");
    return;
  }

  const companyName  = company.name || "Promeet";
  const visitorName  = visitor.name || "Visitor";
  const visitorCode  = visitor.visitorCode || "-";
  const phone        = visitor.phone || "-";
  const personToMeet = visitor.personToMeet || "Reception";
  const purpose      = visitor.purpose || "Visit";
  const checkInTime  = visitor.checkInDisplay || formatIST(visitor.checkIn);

  console.log(`[VISITOR_MAIL] Preparing email for ${visitor.email}`);

  let imageBuffer = null;
  try {
    imageBuffer = await generateVisitorPassImage({ company, visitor });
  } catch (err) {
    console.error("[VISITOR_MAIL] Error generating pass image:", err.message);
  }

  await sendEmail({
    to: visitor.email,
    subject: `Welcome to ${companyName} — Your Digital Visitor Pass`,
    html: `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body{font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;}
        .container{max-width:600px;margin:0 auto;}
        .header{background:linear-gradient(135deg,#6c2bd9,#8e44ad);color:white;padding:30px 20px;text-align:center;border-radius:8px 8px 0 0;}
        .content{padding:30px 20px;background:white;}
        .success-badge{background:#e8f5e9;border-left:4px solid #00c853;padding:16px;margin:20px 0;border-radius:4px;}
        .warning-badge{background:#fff3e0;border-left:4px solid #ff9800;padding:16px;margin:20px 0;border-radius:4px;}
        .info-badge{background:#f8f9ff;border-left:4px solid #6c2bd9;padding:16px;margin:20px 0;border-radius:4px;}
        .whatsapp-badge{background:#e8f5e9;border-left:4px solid #25D366;padding:20px;margin:20px 0;border-radius:4px;text-align:center;}
        .details-table{width:100%;border-collapse:collapse;margin:20px 0;}
        .details-table td{padding:12px;border:1px solid #e0e0e0;}
        .details-table tr:nth-child(odd){background:#f8f9ff;}
        .label{font-weight:600;color:#6c2bd9;width:35%;}
        .whatsapp-button{display:inline-block;background:#25D366;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;}
        h2{color:#6c2bd9;margin-top:30px;margin-bottom:10px;font-size:20px;}
        ul{font-size:14px;line-height:1.8;color:#333;}
        ul li{margin-bottom:8px;}
      </style>
      </head><body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Welcome to ${companyName}!</h1>
          <p style="margin:10px 0 0;font-size:16px;opacity:0.95;">Your Digital Visitor Pass</p>
        </div>
        <div class="content">
          <p>Hello <b>${visitorName}</b>,</p>
          <p>Welcome to <b>${companyName}</b>! Your visitor registration has been successfully processed.</p>
          <div class="success-badge">
            <p style="margin:0;color:#2e7d32;font-weight:600;">&#10003; Registration Confirmed — Pass Issued</p>
          </div>
          <h2>Visit Details</h2>
          <table class="details-table">
            <tr><td class="label">Visitor ID</td><td><b style="color:#222;font-size:15px;">${visitorCode}</b></td></tr>
            <tr><td class="label">Visitor Name</td><td>${visitorName}</td></tr>
            <tr><td class="label">Phone</td><td>${phone}</td></tr>
            <tr><td class="label">Company</td><td>${companyName}</td></tr>
            <tr><td class="label">Check-in Time</td><td>${checkInTime} <span style="color:#666;font-size:12px;">(IST)</span></td></tr>
            <tr><td class="label">Person to Meet</td><td>${personToMeet}</td></tr>
            <tr><td class="label">Purpose</td><td>${purpose}</td></tr>
          </table>
          <h2>Your Digital Visitor Pass</h2>
          <p>Your visitor pass is attached to this email. Please <b>show this pass at the reception</b> when requested.</p>
          <div class="warning-badge">
            <p style="margin:0;color:#e65100;font-weight:600;">Keep this email handy on your mobile device</p>
          </div>
          <h2>Important Guidelines</h2>
          <ul>
            <li><b>Display your visitor pass</b> when entering or when requested by security.</li>
            <li><b>Check-out is mandatory</b> — Please inform reception when leaving.</li>
            <li><b>Follow company policies</b> — Adhere to all security protocols.</li>
          </ul>
          ${company.whatsapp_url ? `
          <h2>Stay Connected</h2>
          <div class="whatsapp-badge">
            <p style="margin:0 0 15px 0;color:#2e7d32;font-weight:600;font-size:16px;">Join ${companyName} WhatsApp</p>
            <a href="${company.whatsapp_url}" class="whatsapp-button" target="_blank">Join WhatsApp Group</a>
            <p style="margin:15px 0 0 0;font-size:13px;color:#666;">Get instant updates and support during your visit</p>
          </div>` : ""}
          <div class="info-badge">
            <p style="margin:0;color:#6c2bd9;font-weight:600;">Need help? Contact ${companyName} reception for assistance.</p>
          </div>
          <p style="margin-top:30px;">Thank you for visiting <b>${companyName}</b>.</p>
          ${emailFooter(company)}
        </div>
      </div>
      </body></html>
    `,
    attachments: imageBuffer
      ? [{ filename: `${visitorCode}-visitor-pass.png`, content: imageBuffer, contentType: "image/png", cid: "visitor-pass-image" }]
      : []
  });

  console.log(`[VISITOR_MAIL] Pass sent to ${visitor.email}`);
};

export const sendEmployeeNotificationMail = async ({
  company = {},
  employee = {},
  visitor = {},
  responseToken,
}) => {
  if (!employee.email) {
    console.log("[EMP_MAIL] No employee email, skipping");
    return;
  }

  if (!responseToken) {
    console.log("[EMP_MAIL] No response token, skipping");
    return;
  }

  // BACKEND_URL first — /api/visit-response is an Express route, not a Next.js page
  const baseUrl =
    process.env.BACKEND_URL ||
    process.env.API_BASE_URL ||
    process.env.FRONTEND_URL ||
    "";

  if (!baseUrl) {
    console.error("[EMP_MAIL] WARNING: No BACKEND_URL set — accept/decline links will be broken");
  }

  const acceptUrl  = `${baseUrl}/api/visit-response/${responseToken}/accept`;
  const declineUrl = `${baseUrl}/api/visit-response/${responseToken}/decline`;

  const companyName  = company.name || "Promeet";
  const employeeName = employee.name || "there";
  const visitorName  = visitor.name || "A visitor";
  const checkInTime  = visitor.checkInDisplay || formatIST(visitor.checkIn);

  console.log(`[EMP_MAIL] Sending to ${employee.email}`);
  console.log(`[EMP_MAIL] Accept  → ${acceptUrl}`);
  console.log(`[EMP_MAIL] Decline → ${declineUrl}`);

  await sendEmail({
    to: employee.email,
    subject: `Visitor Notification: ${visitorName} has arrived at reception — ${companyName}`,
    html: `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <style>
        body{font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;}
        .container{max-width:600px;margin:0 auto;}
        .header{background:linear-gradient(135deg,#6c2bd9,#8e44ad);color:white;padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;}
        .content{padding:30px 20px;background:white;}
        .visitor-card{background:#f8f9ff;border:1px solid #e0d7ff;border-radius:8px;padding:20px;margin:20px 0;}
        .details-table{width:100%;border-collapse:collapse;margin:0;}
        .details-table td{padding:10px 12px;border-bottom:1px solid #e8e3ff;}
        .details-table tr:last-child td{border-bottom:none;}
        .label{font-weight:600;color:#6c2bd9;width:40%;font-size:14px;}
        .value{color:#333;font-size:14px;}
        .action-section{margin:28px 0;padding:24px 20px;background:#f8f9ff;border:1px solid #e0d7ff;border-radius:8px;text-align:center;}
        .action-title{font-size:15px;font-weight:700;color:#2d2d2d;margin:0 0 4px 0;letter-spacing:0.2px;}
        .action-sub{font-size:13px;color:#666;margin:0 0 22px 0;}
        .btn{display:inline-block;padding:13px 34px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;letter-spacing:0.3px;vertical-align:middle;}
        .btn-accept{background:#00c853;color:#ffffff;margin-right:10px;}
        .btn-decline{background:#ffffff;color:#c62828;border:2px solid #c62828;}
        .action-note{margin:20px 0 0 0;font-size:12px;color:#999;line-height:1.6;}
        .notice{background:#fff8e1;border-left:4px solid #ffc107;padding:14px 16px;border-radius:4px;margin:20px 0;font-size:13px;color:#795548;line-height:1.6;}
        .photo-wrap{text-align:center;margin:16px 0;}
        .photo-wrap img{width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #6c2bd9;}
      </style>
      </head><body>
      <div class="container">

        <div class="header">
          ${company.logo ? `<img src="${company.logo}" alt="${companyName}" style="height:46px;border-radius:6px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;background:#fff;padding:4px;"/>` : ""}
          <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.3px;">Visitor Arrival Notification</h1>
          <p style="margin:8px 0 0;font-size:14px;opacity:0.85;font-weight:400;">${companyName}</p>
        </div>

        <div class="content">

          <p style="font-size:15px;margin:0 0 8px 0;">Dear <b>${employeeName}</b>,</p>
          <p style="font-size:14px;color:#444;margin:0 0 4px 0;">
            A visitor has checked in at the reception desk and is waiting to meet you.
            The details of the visit are provided below for your reference.
          </p>

          ${visitor.photoUrl ? `
          <div class="photo-wrap">
            <img src="${visitor.photoUrl}" alt="${visitorName}" />
          </div>` : ""}

          <div class="visitor-card">
            <table class="details-table">
              <tr>
                <td class="label">Visitor Name</td>
                <td class="value"><b>${visitorName}</b></td>
              </tr>
              <tr>
                <td class="label">Contact Number</td>
                <td class="value">${visitor.phone || "-"}</td>
              </tr>
              ${visitor.email ? `
              <tr>
                <td class="label">Email Address</td>
                <td class="value">${visitor.email}</td>
              </tr>` : ""}
              ${visitor.fromCompany ? `
              <tr>
                <td class="label">Organisation</td>
                <td class="value">${visitor.fromCompany}</td>
              </tr>` : ""}
              <tr>
                <td class="label">Purpose of Visit</td>
                <td class="value">${visitor.purpose || "Not specified"}</td>
              </tr>
              <tr>
                <td class="label">Arrival Time</td>
                <td class="value">${checkInTime} <span style="color:#999;font-size:12px;">(IST)</span></td>
              </tr>
              <tr>
                <td class="label">Visitor Code</td>
                <td class="value"><span style="font-family:monospace;background:#f0ebff;padding:2px 8px;border-radius:4px;font-size:13px;">${visitor.visitorCode || "-"}</span></td>
              </tr>
            </table>
          </div>

          <div class="action-section">
            <p class="action-title">Action Required</p>
            <p class="action-sub">Kindly confirm whether you would like to receive this visitor.</p>
            <a href="${acceptUrl}" class="btn btn-accept">Accept Visit</a>
            <a href="${declineUrl}" class="btn btn-decline">Decline Visit</a>
            <p class="action-note">
              No login is required. Selecting an option above will immediately update the visitor's status at reception.<br/>
              If no response is received, the reception team may update the status directly from the dashboard.
            </p>
          </div>

          <div class="notice">
            These response links are valid for <b>48 hours</b> from the time of this notification.
            After expiry, please coordinate with reception or use the admin dashboard to update the visitor status.
          </div>

          ${emailFooter(company)}
        </div>

      </div>
      </body></html>
    `,
  });

  console.log(`[EMP_MAIL] Notification sent to ${employee.email}`);
};
