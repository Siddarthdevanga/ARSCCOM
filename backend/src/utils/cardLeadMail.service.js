/**
 * utils/cardLeadMail.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tells a card owner that someone scanned their digital visiting card and
 * left their details.
 *
 * Deliberately plain and short. This lands on a phone, minutes after a
 * conversation at a stand or a meeting, and its only job is to let the owner
 * act — call, WhatsApp or email — without opening anything else. Everything
 * that is not a name, a number or what the person wanted is noise.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { sendEmail } from "./mailer.js";

const esc = (v = "") =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Digits only, so wa.me accepts it. Indian numbers are stored either bare
   or with a country code; ten digits means the code is missing. */
const waNumber = (phone = "") => {
  const s = String(phone).trim();
  const d = s.replace(/\D/g, "");
  if (s.startsWith("+")) return d;              // already has its country code
  const local = d.replace(/^0/, "");            // 0-prefixed trunk form, e.g. 074062 08011
  return local.length === 10 ? `91${local}` : d;
};

const row = (label, value) => value
  ? `<tr>
       <td style="padding:6px 14px 6px 0;color:#8d8e97;font-size:13px;white-space:nowrap;">${esc(label)}</td>
       <td style="padding:6px 0;color:#17171a;font-size:14px;font-weight:600;">${esc(value)}</td>
     </tr>`
  : "";

export const sendCardLeadEmail = async (cardOwner, lead) => {
  if (!cardOwner?.email) return;

  const name = lead?.name || "Someone";
  const phone = lead?.phone || "";

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;">

    <div style="background:#0c0c0f;background-image:linear-gradient(158deg,#121214,#050505);
                padding:24px 26px;border-bottom:3px solid #f5a524;border-radius:12px 12px 0 0;">
      <p style="margin:0;color:rgba(255,255,255,.55);font-size:11px;font-weight:800;
                letter-spacing:2px;text-transform:uppercase;">New contact shared</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:800;">
        ${esc(name)} shared their details
      </h1>
    </div>

    <div style="border:1px solid #e7e7ec;border-top:none;border-radius:0 0 12px 12px;padding:22px 26px;">
      <p style="margin:0 0 16px;color:#5f6068;font-size:14px;line-height:1.6;">
        They scanned your digital visiting card and left their contact details.
      </p>

      <table style="border-collapse:collapse;margin-bottom:20px;">
        ${row("Name", lead?.name)}
        ${row("Phone", lead?.phone)}
        ${row("Email", lead?.email)}
        ${row("Company", lead?.company_name)}
      </table>

      ${lead?.message ? `
        <div style="background:#fafafb;border-left:3px solid #f5a524;border-radius:0 8px 8px 0;
                    padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0 0 4px;color:#8d8e97;font-size:11px;font-weight:800;
                    letter-spacing:.06em;text-transform:uppercase;">What they wrote</p>
          <p style="margin:0;color:#17171a;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(lead.message)}</p>
        </div>` : ""}

      ${phone ? `
        <a href="https://wa.me/${waNumber(phone)}"
           style="display:inline-block;background:#f5a524;color:#1c1204;text-decoration:none;
                  font-weight:800;font-size:14px;padding:12px 26px;border-radius:10px;">
          Reply on WhatsApp
        </a>
        <a href="tel:${esc(phone)}"
           style="display:inline-block;margin-left:10px;color:#17171a;text-decoration:none;
                  font-weight:700;font-size:14px;padding:12px 8px;">
          Call
        </a>` : ""}
    </div>

    <p style="margin:16px 0 0;color:#8d8e97;font-size:12px;text-align:center;">
      Sent by Hai Visitor because someone scanned your digital visiting card.
    </p>
  </div>`;

  await sendEmail({
    to: cardOwner.email,
    // Public input in a header: collapse any line breaks to spaces.
    subject: `${String(name).replace(/\s+/g, " ").trim()} shared their contact details with you`,
    html,
  });
};
