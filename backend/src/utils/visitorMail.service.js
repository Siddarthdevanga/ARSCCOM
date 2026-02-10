import { sendEmail } from "../utils/mailer.js";
import { generateVisitorPassImage } from "./visitor-pass-image.js";

/* ======================================================
   IST FORMATTER (HANDLES ALL INPUT TYPES)
====================================================== */
const formatIST = (value) => {
  if (!value) return "-";

  try {
    let date;

    // Handle Date objects
    if (value instanceof Date) {
      date = value;
    }
    // Handle MySQL datetime strings (YYYY-MM-DD HH:MM:SS)
    else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      // MySQL datetime is already in IST, just parse it
      const [datePart, timePart] = value.split(" ");
      const [year, month, day] = datePart.split("-");
      const [hour, minute, second] = timePart.split(":");
      
      // Create date object in UTC then treat as IST
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);
    }
    // Handle ISO strings
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
    console.error("[formatIST] Error:", err.message, "| Input:", value);
    return "-";
  }
};

/* ======================================================
   EMAIL FOOTER — COMPANY BRANDING WITH WHATSAPP
====================================================== */
export const emailFooter = (company = {}) => {
  const companyName = company?.name || "Promeet";
  const companyLogo = company?.logo_url || company?.logo || null;
  const whatsappUrl = company?.whatsappUrl || company?.whatsapp_url || null;

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

${whatsappUrl
  ? `
  <div style="margin:20px 0;">
    <a 
      href="${whatsappUrl}" 
      style="display:inline-block;background:#25D366;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:Arial,Helvetica,sans-serif;"
    >
      💬 Join WhatsApp for Updates & Support
    </a>
  </div>
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
  if (!visitor.email) {
    console.log("[VISITOR_MAIL] No email provided, skipping");
    return;
  }

  const companyName = company.name || "Promeet";
  const visitorName = visitor.name || "Visitor";
  const visitorCode = visitor.visitorCode || "-";
  const phone = visitor.phone || "-";
  const personToMeet = visitor.personToMeet || "Reception";
  const purpose = visitor.purpose || "Visit";
  const whatsappUrl = company.whatsappUrl || company.whatsapp_url || null;
  
  // Format check-in time (handles both checkIn and checkInDisplay)
  const checkInTime = visitor.checkInDisplay || formatIST(visitor.checkIn);
  
  console.log(`[VISITOR_MAIL] Preparing email for ${visitor.email}`);
  console.log(`[VISITOR_MAIL] Check-in time: ${checkInTime}`);
  console.log(`[VISITOR_MAIL] WhatsApp URL: ${whatsappUrl ? "Available" : "Not provided"}`);

  let imageBuffer = null;

  // Generate visitor pass image
  try {
    imageBuffer = await generateVisitorPassImage({ company, visitor });
    console.log("[VISITOR_MAIL] Visitor pass image generated successfully");
  } catch (err) {
    console.error("[VISITOR_MAIL] Error generating pass image:", err.message);
  }

  // Send email
  try {
    await sendEmail({
      to: visitor.email,
      subject: `Welcome to ${companyName} — Your Digital Visitor Pass`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #6c2bd9, #8e44ad); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px 20px; background: white; }
            .success-badge { background: #e8f5e9; border-left: 4px solid #00c853; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .warning-badge { background: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .info-badge { background: #f8f9ff; border-left: 4px solid #6c2bd9; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .whatsapp-badge { background: #e7f5ec; border-left: 4px solid #25D366; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .details-table td { padding: 12px; border: 1px solid #e0e0e0; }
            .details-table tr:nth-child(odd) { background: #f8f9ff; }
            .label { font-weight: 600; color: #6c2bd9; width: 35%; }
            .whatsapp-button { display: inline-block; background: #25D366; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 20px 0; transition: background 0.3s ease; }
            .whatsapp-button:hover { background: #20BA5A; }
            h2 { color: #6c2bd9; margin-top: 30px; margin-bottom: 10px; font-size: 20px; }
            ul { font-size: 14px; line-height: 1.8; color: #333; }
            ul li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Welcome to ${companyName}!</h1>
              <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.95;">Your Digital Visitor Pass</p>
            </div>
            
            <div class="content">
              <p>Hello <b>${visitorName}</b>,</p>

              <p>
                Welcome to <b>${companyName}</b>! Your visitor registration has been successfully processed, 
                and your digital visitor pass is ready.
              </p>

              <div class="success-badge">
                <p style="margin:0;color:#2e7d32;font-weight:600;">
                  ✓ Registration Confirmed — Check-in Completed
                </p>
              </div>

              <h2>📋 Visit Details</h2>

              <table class="details-table">
                <tr>
                  <td class="label">Visitor ID</td>
                  <td><b style="color:#222;font-size:15px;">${visitorCode}</b></td>
                </tr>
                <tr>
                  <td class="label">Visitor Name</td>
                  <td>${visitorName}</td>
                </tr>
                <tr>
                  <td class="label">Phone</td>
                  <td>${phone}</td>
                </tr>
                <tr>
                  <td class="label">Company</td>
                  <td>${companyName}</td>
                </tr>
                <tr>
                  <td class="label">Check-in Time</td>
                  <td>${checkInTime} <span style="color:#666;font-size:12px;">(IST)</span></td>
                </tr>
                <tr>
                  <td class="label">Person to Meet</td>
                  <td>${personToMeet}</td>
                </tr>
                <tr>
                  <td class="label">Purpose of Visit</td>
                  <td>${purpose}</td>
                </tr>
              </table>

              <h2>🎫 Your Digital Visitor Pass</h2>

              <p>
                Your visitor pass is attached to this email as an image. 
                Please <b>show this pass at the reception</b> or security checkpoint when requested.
              </p>

              <div class="warning-badge">
                <p style="margin:0;color:#e65100;font-weight:600;">
                  📱 Keep this email handy on your mobile device for easy access
                </p>
              </div>

              ${whatsappUrl
                ? `
                <h2>💬 Stay Connected</h2>

                <div class="whatsapp-badge">
                  <p style="margin:0 0 12px 0;color:#1b5e20;font-weight:600;">
                    Join our WhatsApp group for instant updates, support, and important announcements!
                  </p>
                  <p style="margin:0;text-align:center;">
                    <a href="${whatsappUrl}" class="whatsapp-button">
                      💬 Join WhatsApp Group
                    </a>
                  </p>
                </div>
                `
                : ""
              }

              <h2>📌 Important Guidelines</h2>

              <ul>
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
                ${whatsappUrl
                  ? `<li><b>WhatsApp support</b> — Use the WhatsApp group for quick assistance and updates.</li>`
                  : ""
                }
              </ul>

              <div class="info-badge">
                <p style="margin:0;color:#6c2bd9;font-weight:600;">
                  📧 Need help? Contact ${companyName} reception or administrator for assistance.
                </p>
              </div>

              <p style="margin-top: 30px;">
                Thank you for visiting <b>${companyName}</b>. 
                We hope you have a productive and pleasant experience.
              </p>

              ${emailFooter(company)}
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: imageBuffer
        ? [
            {
              filename: `${visitorCode}-visitor-pass.png`,
              content: imageBuffer,
              contentType: "image/png",
              cid: "visitor-pass-image"
            }
          ]
        : []
    });

    console.log(`✅ [VISITOR_MAIL] Pass sent successfully to ${visitor.email}`);

  } catch (err) {
    console.error("❌ [VISITOR_MAIL] Error sending email:", err.message);
    throw err;
  }
};

[💬 Join WhatsApp for Updates & Support]
