/**
 * utils/cardPoolMail.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Emails for claimed pool cards: people who picked up a printed Haivisitor
 * card and claimed it, but have no account.
 *
 *   Welcome   the card itself (both faces and the QR, inline and attached,
 *             ready to print or share), and what an account adds.
 *   Teaser    after the first few leads, which are emailed in full through
 *             the normal lead email: "someone shared their details, sign up
 *             to see who". At most one a day; the leads themselves are kept
 *             and are there when they register.
 *
 * No prices here: plans are shown after registration.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { sendEmail } from "./mailer.js";
import { renderCardPngs, qrPng } from "./cardArt.node.js";
import { getS3Object } from "../services/s3.service.js";
import { SITE, cardUrl, phone10 } from "../services/cardPool.service.js";
import { isUploadedPhoto, intl } from "../services/digitalCard.service.js";

const esc = (v = "") =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Registration, prefilled, so what they typed on the card is what the
   account is created with — and the card finds its way into it. */
export const registerLink = (card) => {
  const q = new URLSearchParams();
  if (card.email) q.set("email", card.email);
  const p = phone10(card.phone);
  if (p) q.set("phone", p);
  if (card.company_name) q.set("company", card.company_name);
  // The register page pulls the logo uploaded with the card from here.
  if (card.own_logo_url) q.set("card", card.slug);
  return `${SITE}/register?${q.toString()}`;
};

const fileBase = (card) =>
  (card.name || "card").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "card";

const s3Buffer = async (key) => {
  if (!isUploadedPhoto(key)) return null;
  try { return (await getS3Object(key)).buffer; } catch { return null; }
};

const shell = (eyebrow, title, body) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;color:#17171a;">
    <div style="background:#0c0c0f;background-image:linear-gradient(158deg,#121214,#050505);
                padding:24px 26px;border-bottom:3px solid #f5a524;border-radius:12px 12px 0 0;">
      <p style="margin:0;color:rgba(255,255,255,.55);font-size:11px;font-weight:800;
                letter-spacing:2px;text-transform:uppercase;">${esc(eyebrow)}</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:21px;font-weight:800;line-height:1.35;">${title}</h1>
    </div>
    <div style="border:1px solid #e7e7ec;border-top:none;border-radius:0 0 12px 12px;padding:24px 26px;">
      ${body}
    </div>
    <p style="margin:16px 0 0;color:#8d8e97;font-size:12px;text-align:center;">
      Digital card by Haivisitor
    </p>
  </div>`;

const button = (href, label) => `
  <a href="${esc(href)}"
     style="display:inline-block;background:#f5a524;color:#1c1204;text-decoration:none;
            font-weight:800;font-size:14px;padding:13px 28px;border-radius:10px;">${esc(label)}</a>`;

const row = (label, value) => value
  ? `<tr>
       <td style="padding:5px 14px 5px 0;color:#8d8e97;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
       <td style="padding:5px 0;color:#17171a;font-size:14px;font-weight:600;">${esc(value)}</td>
     </tr>`
  : "";

const FEATURES = [
  ["Edit your card any time", "Change your details, photo, logo and colours whenever you like — the printed QR keeps working."],
  ["Every contact in one place", "See everyone who shared their details, search them and export them."],
  ["Cards for your whole team", "Give each colleague their own digital visiting card, all managed from one dashboard."],
  ["Visitor management", "Check visitors in at reception with digital passes, host alerts and a full visitor log."],
  ["Meeting room booking", "Let your team and guests book conference rooms without the back-and-forth."],
];

/* ── Welcome ── */
export const sendPoolWelcomeEmail = async (card) => {
  if (!card?.email) return;

  const url = cardUrl(card.slug);
  const [photo, logo] = await Promise.all([s3Buffer(card.photo_url), s3Buffer(card.own_logo_url)]);
  const [{ front, back }, qr] = await Promise.all([
    renderCardPngs(card, { cardUrl: url, logoSrc: logo, photoSrc: photo }),
    qrPng(url),
  ]);
  const base = fileBase(card);
  const first = (card.name || "").trim().split(/\s+/)[0] || "there";

  const body = `
    <p style="margin:0 0 18px;color:#5f6068;font-size:14px;line-height:1.65;">
      Hi ${esc(first)}, your card is live. Anyone who scans the QR sees your details and can save you
      to their contacts, WhatsApp you, or share their own details back — and we will email them to you.
    </p>

    <img src="cid:card-front" alt="Front of your card" width="508"
         style="display:block;width:100%;max-width:508px;border-radius:10px;margin:0 0 10px;" />
    <img src="cid:card-back" alt="Back of your card" width="508"
         style="display:block;width:100%;max-width:508px;border-radius:10px;margin:0 0 20px;" />

    <table style="border-collapse:collapse;margin:0 0 18px;">
      ${row("Name", card.name)}
      ${row("Title", card.job_title)}
      ${row("Company", card.company_name)}
      ${row("Phone", card.phone && intl(card.phone))}
      ${row("Email", card.email)}
    </table>

    <div style="display:flex;gap:18px;align-items:center;background:#fafafb;border:1px solid #efeff3;
                border-radius:12px;padding:16px;margin:0 0 24px;">
      <img src="cid:card-qr" alt="Your card's QR code" width="112" height="112"
           style="display:block;width:112px;height:112px;flex-shrink:0;" />
      <div>
        <p style="margin:0 0 6px;font-size:14px;font-weight:800;">Your card's link</p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5;">
          <a href="${esc(url)}" style="color:#b45309;word-break:break-all;">${esc(url)}</a>
        </p>
        <p style="margin:0;color:#8d8e97;font-size:12px;line-height:1.5;">
          Put the QR on your email signature, slides or stand. The card images are attached to print more.
        </p>
      </div>
    </div>

    <div style="border-top:1px solid #efeff3;padding-top:22px;">
      <p style="margin:0 0 4px;color:#b45309;font-size:11px;font-weight:800;letter-spacing:.08em;
                text-transform:uppercase;">Do more with Haivisitor</p>
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:800;">Make it your account</h2>
      <p style="margin:0 0 14px;color:#5f6068;font-size:14px;line-height:1.65;">
        Your card is yours to keep for free. Sign up with this email or phone number and it moves into your
        account automatically — the same QR, and every contact who has shared their details with you.
      </p>
      <table style="border-collapse:collapse;margin:0 0 20px;">
        ${FEATURES.map(([t, d]) => `
          <tr>
            <td style="padding:6px 10px 6px 0;vertical-align:top;color:#f5a524;font-size:15px;font-weight:900;">&#10003;</td>
            <td style="padding:6px 0;">
              <p style="margin:0;font-size:14px;font-weight:700;">${esc(t)}</p>
              <p style="margin:2px 0 0;color:#5f6068;font-size:13px;line-height:1.5;">${esc(d)}</p>
            </td>
          </tr>`).join("")}
      </table>
      ${button(registerLink(card), "See plans")}
    </div>`;

  await sendEmail({
    to: card.email,
    subject: "Your Haivisitor digital card is ready",
    html: shell("Digital visiting card", "Your card is ready", body),
    attachments: [
      { filename: `${base}-front.png`, content: front, contentType: "image/png", cid: "card-front" },
      { filename: `${base}-back.png`,  content: back,  contentType: "image/png", cid: "card-back" },
      { filename: `${base}-qr.png`,    content: qr,    contentType: "image/png", cid: "card-qr" },
    ],
  });
};

/* ── Teaser ── */
export const sendPoolTeaserEmail = async (card, total) => {
  if (!card?.email) return;
  const first = (card.name || "").trim().split(/\s+/)[0] || "there";
  const body = `
    <p style="margin:0 0 14px;color:#5f6068;font-size:14px;line-height:1.65;">
      Hi ${esc(first)}, someone scanned your digital card today and left their name and number for you.
    </p>
    <p style="margin:0 0 20px;color:#5f6068;font-size:14px;line-height:1.65;">
      ${total} ${total === 1 ? "person has" : "people have"} shared their details through your card so far.
      Every one of them is saved. Sign up with this email or phone number to see who they are and get in touch.
    </p>
    ${button(registerLink(card), "Register to see who")}`;

  await sendEmail({
    to: card.email,
    subject: "Someone shared their details with you",
    html: shell("New contact shared", "Someone shared their details with you", body),
  });
};
