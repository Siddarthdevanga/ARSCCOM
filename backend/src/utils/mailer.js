import nodemailer from "nodemailer";

/* ======================================================
   VALIDATE SMTP CONFIG (ONCE)
====================================================== */
const REQUIRED_ENV = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD"
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`❌ Missing SMTP env variable: ${key}`);
  }
}

/* ======================================================
   CREATE TRANSPORTER (SINGLETON)
====================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,          // e.g. smtp.zoho.com
  port: Number(process.env.SMTP_PORT),  // usually 587
  secure: false,                        // MUST be false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  authMethod: "LOGIN",
  tls: {
    rejectUnauthorized: false           // avoids cert issues on EC2
  }
});

/* ======================================================
   VERIFY SMTP ON BOOT (CRITICAL)
====================================================== */
transporter.verify((err) => {
  if (err) {
    console.error("❌ SMTP verification failed:", err.message);
  } else {
    console.log("✅ SMTP server ready to send emails");
  }
});

/* ======================================================
   SEND EMAIL (NO API CHANGE)
====================================================== */
export const sendEmail = async ({
  to,
  subject,
  html,
  attachments = []
}) => {
  if (!to) {
    throw new Error("Recipient email is required");
  }

  try {
    const info = await transporter.sendMail({
      from: `"ARSCCOM Visitor Management" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments
    });

    console.log("📧 Email sent:", {
      to,
      subject,
      messageId: info.messageId
    });

    return info;
  } catch (err) {
    console.error("❌ Email send failed:", {
      to,
      subject,
      error: err.message
    });
    throw err; // IMPORTANT: propagate error
  }
};
