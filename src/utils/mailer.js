import nodemailer from "nodemailer";

export const sendEmail = async ({
  to,
  subject,
  html,
  attachments = []
}) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error("SMTP credentials missing");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,      // smtp.zoho.com
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    authMethod: "LOGIN",
    tls: { rejectUnauthorized: false }
  });

  await transporter.sendMail({
    from: `"ARSCCOM Visitor Management" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments
  });
};
