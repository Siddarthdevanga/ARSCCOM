import nodemailer from "nodemailer";

/* ======================================================
   VALIDATE SMTP CONFIG (ONCE ON BOOT)
====================================================== */
const REQUIRED_ENV = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD"
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing SMTP env variable: ${key}`);
    throw new Error(`SMTP configuration incomplete`);
  }
}

/* ======================================================
   CREATE TRANSPORTER (SINGLETON)
====================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,            // smtp.zoho.com
  port: Number(process.env.SMTP_PORT),    // 587
  secure: false,                          // MUST be false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD       // APP PASSWORD ONLY
  },
  tls: {
    rejectUnauthorized: false             // EC2 / cert-safe
  }
});

/* ======================================================
   VERIFY SMTP ON SERVER START
====================================================== */
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP verification failed");
    console.error(err);
  } else {
    console.log("✅ SMTP server ready to send emails");
  }
});

/* ======================================================
   SEND EMAIL
====================================================== */
export const sendEmail = async ({
  to,
  subject,
  html,
  attachments = []
}) => {
  if (!to || !subject || !html) {
    throw new Error("Email requires to, subject and html");
  }

  try {
    const info = await transporter.sendMail({
      from: `"PROMEET" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments
    });

    console.log("📧 Email sent successfully", {
      to,
      subject,
      messageId: info.messageId
    });

    return info;

  } catch (err) {
    console.error("❌ Email sending failed", {
      to,
      subject,
      error: err.message
    });
    throw err; // propagate to caller
  }
};
