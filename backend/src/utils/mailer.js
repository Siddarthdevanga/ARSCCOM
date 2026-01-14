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
    throw new Error("SMTP configuration incomplete");
  }
}

/* ======================================================
   CREATE TRANSPORTER (SINGLETON)
====================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // MUST be false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD // APP PASSWORD ONLY
  },
  tls: {
    rejectUnauthorized: false
  }
});

/* ======================================================
   VERIFY SMTP ON SERVER START
====================================================== */
transporter.verify((err) => {
  if (err) {
    console.error("❌ SMTP verification failed", err.message);
  } else {
    console.log("✅ SMTP server ready to send emails");
  }
});

/* ======================================================
   NORMALIZE EMAIL INPUT (STRICT FORMAT)
====================================================== */
function normalizeEmailPayload(input) {
  // Allow legacy call: sendEmail(to, subject, html)
  if (typeof input === "string") {
    throw new Error(
      "❌ sendEmail now requires an object: { to, subject, html }"
    );
  }

  const {
    to,
    subject,
    html,
    attachments = []
  } = input || {};

  if (!to || !subject || !html) {
    throw new Error(
      "Email requires { to, subject, html } — received invalid payload"
    );
  }

  return { to, subject, html, attachments };
}

/* ======================================================
   SEND EMAIL (STRICT + SAFE)
====================================================== */
export const sendEmail = async (payload) => {
  const { to, subject, html, attachments } =
    normalizeEmailPayload(payload);

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
    throw err;
  }
};
