import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { getPresignedUrl } from "../services/s3.service.js";

/* ======================================================
   MEETING REMINDER CRON
   Runs every minute — sends reminder emails 10 minutes
   before each upcoming conference booking.
   Requires: conference_bookings.reminder_sent TINYINT(1) DEFAULT 0
====================================================== */

const prettyTime = (t = "") => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");

export const sendMeetingReminders = async () => {
  try {
    // Compute 9m30s–10m30s ahead in IST as "YYYY-MM-DD HH:MM:SS" strings
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const lo = new Date(nowIST.getTime() + 570_000); // +9m30s
    const hi = new Date(nowIST.getTime() + 630_000); // +10m30s
    const fmtDT = (d) => {
      const Y = d.getFullYear(), M = String(d.getMonth()+1).padStart(2,"0"), D = String(d.getDate()).padStart(2,"0");
      const h = String(d.getHours()).padStart(2,"0"), m = String(d.getMinutes()).padStart(2,"0"), s = String(d.getSeconds()).padStart(2,"0");
      return `${Y}-${M}-${D} ${h}:${m}:${s}`;
    };

    // Find bookings starting in exactly 10 minutes (±30s window), not yet reminded
    // reminder_sent IS NULL covers bookings created before the column was added
    const [bookings] = await db.query(
      `SELECT
         cb.id, cb.booked_by, cb.booking_date, cb.start_time, cb.end_time,
         cb.purpose, cb.department,
         cr.room_name, cr.room_number, cr.image_url AS room_image_url,
         c.name AS company_name
       FROM conference_bookings cb
       JOIN conference_rooms cr ON cr.id = cb.room_id
       JOIN companies c ON c.id = cb.company_id
       WHERE cb.status = 'BOOKED'
         AND (cb.reminder_sent = 0 OR cb.reminder_sent IS NULL)
         AND CAST(CONCAT(cb.booking_date, ' ', cb.start_time) AS DATETIME)
             BETWEEN ? AND ?`,
      [fmtDT(lo), fmtDT(hi)]
    );

    for (const booking of bookings) {
      // Resolve room image presigned URL (non-fatal if it fails)
      let roomImageUrl = null;
      if (booking.room_image_url) {
        try { roomImageUrl = await getPresignedUrl(booking.room_image_url, 3600); } catch {}
      }

      // Collect all recipient emails: organiser + team members
      const recipients = new Set();
      if (isEmail(booking.booked_by)) recipients.add(booking.booked_by);

      const [members] = await db.query(
        `SELECT email FROM conference_booking_members WHERE booking_id = ? AND email IS NOT NULL`,
        [booking.id]
      );
      for (const m of members) if (isEmail(m.email)) recipients.add(m.email);

      if (recipients.size === 0) {
        await db.query(`UPDATE conference_bookings SET reminder_sent = 1 WHERE id = ?`, [booking.id]);
        continue;
      }

      const roomImageBlock = roomImageUrl
        ? `<img src="${roomImageUrl}" alt="${booking.room_name}" style="width:100%;max-width:560px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;margin:0 auto 20px;" />`
        : `<div style="width:100%;max-width:560px;aspect-ratio:16/9;background:linear-gradient(135deg,#d97706,#f59e0b);border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
             <span style="color:#fff;font-size:28px;font-weight:800;letter-spacing:1px;">${booking.room_name.charAt(0).toUpperCase()}</span>
           </div>`;

      const subject = `Reminder: Meeting in 10 minutes – ${booking.room_name} | ${booking.company_name}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #fef3c7;">
          <div style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:24px 28px;">
            <div style="color:#fef3c7;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${booking.company_name}</div>
            <h1 style="color:#fff;margin:0;font-size:22px;">Meeting starts in 10 minutes</h1>
            <p style="color:#fef9c3;margin:6px 0 0;font-size:14px;">Your conference room is ready</p>
          </div>
          <div style="padding:24px 28px;">
            ${roomImageBlock}
            <table style="border-collapse:collapse;width:100%;font-size:14px;border-radius:8px;overflow:hidden;border:1px solid #fef3c7;">
              <tr style="background:#d97706;color:#fff;">
                <td colspan="2" style="padding:10px 14px;font-weight:700;font-size:15px;">Meeting Details</td>
              </tr>
              <tr style="border-bottom:1px solid #fef3c7;">
                <td style="padding:10px 14px;font-weight:600;color:#6b7280;width:130px;">Room</td>
                <td style="padding:10px 14px;color:#1f2937;font-weight:600;">${booking.room_name}${booking.room_number ? ` #${booking.room_number}` : ""}</td>
              </tr>
              <tr style="border-bottom:1px solid #fef3c7;background:#fffbeb;">
                <td style="padding:10px 14px;font-weight:600;color:#6b7280;">Date</td>
                <td style="padding:10px 14px;color:#1f2937;">${booking.booking_date instanceof Date ? booking.booking_date.toLocaleDateString("en-CA", { timeZone:"Asia/Kolkata" }) : String(booking.booking_date).split("T")[0]}</td>
              </tr>
              <tr style="border-bottom:1px solid #fef3c7;">
                <td style="padding:10px 14px;font-weight:600;color:#6b7280;">Time</td>
                <td style="padding:10px 14px;color:#1f2937;font-weight:600;">${prettyTime(booking.start_time)} – ${prettyTime(booking.end_time)}</td>
              </tr>
              ${booking.department ? `<tr style="border-bottom:1px solid #fef3c7;background:#fffbeb;"><td style="padding:10px 14px;font-weight:600;color:#6b7280;">Department</td><td style="padding:10px 14px;color:#1f2937;">${booking.department}</td></tr>` : ""}
              ${booking.purpose ? `<tr><td style="padding:10px 14px;font-weight:600;color:#6b7280;">Purpose</td><td style="padding:10px 14px;color:#1f2937;">${booking.purpose}</td></tr>` : ""}
            </table>
          </div>
          <div style="padding:0 28px 24px;font-size:13px;color:#666;">
            This is an automated reminder. Please make your way to the room.
          </div>
        </div>`;

      for (const to of recipients) {
        try {
          await sendEmail({ to, subject, html });
        } catch (mailErr) {
          console.error(`[REMINDER] Failed to email ${to}:`, mailErr.message);
        }
      }

      await db.query(`UPDATE conference_bookings SET reminder_sent = 1 WHERE id = ?`, [booking.id]);
      console.log(`[REMINDER] Sent for booking #${booking.id} (${booking.room_name} @ ${booking.start_time}) → ${recipients.size} recipient(s)`);
    }
  } catch (err) {
    console.error("[REMINDER CRON ERROR]", err.message);
  }
};
