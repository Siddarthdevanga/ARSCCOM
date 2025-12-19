import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

export const sendResetEmail = async (to, code) => {
  await transporter.sendMail({
    from: `"Wheelbrand" <${process.env.SMTP_USER}>`,
    to,
    subject: "Password Reset Code",
    html: `
      <div style="font-family: Arial; padding: 30px; background:#f5f6fa">
        <div style="max-width:520px;margin:auto;background:#fff;
                    padding:30px;border-radius:10px">
          <h2 style="color:#3c007a">Password Reset</h2>
          <p>Use the code below to reset your password:</p>
          <div style="
            font-size:28px;
            letter-spacing:4px;
            font-weight:bold;
            color:#3c007a;
            text-align:center;
            margin:20px 0;
          ">
            ${code}
          </div>
          <p>This code expires in <b>10 minutes</b>.</p>
          <p style="font-size:12px;color:#999">
            If you didn’t request this, ignore this email.
          </p>
        </div>
      </div>
    `
  });
};
