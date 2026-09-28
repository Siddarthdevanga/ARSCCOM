/**
 * services/digitalCard.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Digital visiting cards: the card itself, its public view, the scan counter
 * and the details a scanner chooses to share back.
 *
 * Two rules shape most of what follows:
 *
 *   A card is never hard-deleted. Its QR may be printed on a few hundred
 *   physical cards already handed out, and breaking that URL punishes the
 *   person holding the card rather than the company that deactivated it.
 *   Deactivating or locking makes the page say the details are not
 *   available; the URL itself keeps resolving.
 *
 *   Scans are counted per viewer per day, not per page load. Bots, link
 *   previews and the owner checking their own card would otherwise inflate
 *   the number until nobody trusts it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import crypto from "crypto";
import { db } from "../config/db.js";
import { cardLimitFor } from "../constants/pricing.js";

/* Ambiguous characters left out: these get read aloud, typed from a printed
   card, and dictated over the phone. */
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SLUG_LENGTH = 10;

const newSlug = () => {
  const bytes = crypto.randomBytes(SLUG_LENGTH);
  let out = "";
  for (let i = 0; i < SLUG_LENGTH; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
};

/* Collisions are vanishingly unlikely at 31^10, but a duplicate slug would
   hand one person another person's card — so it is checked, not assumed. */
const uniqueSlug = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newSlug();
    const [[hit]] = await db.execute("SELECT id FROM digital_cards WHERE slug = ? LIMIT 1", [slug]);
    if (!hit) return slug;
  }
  throw new Error("Could not allocate a unique card address");
};

/* ======================================================
   PLAN LIMITS
   Only active, unlocked cards count. Deactivating frees the slot.
====================================================== */
export const getCardUsage = async (companyId, plan) => {
  const [[row]] = await db.execute(
    `SELECT COUNT(*) AS used FROM digital_cards
      WHERE company_id = ? AND is_active = 1 AND is_locked = 0`,
    [companyId]
  );
  const limit = cardLimitFor(plan);
  return { used: row.used, limit, remaining: Math.max(0, limit - row.used) };
};

/* ======================================================
   ADMIN CRUD
====================================================== */
const CARD_FIELDS = [
  "name", "job_title", "company_name", "phone", "whatsapp", "email",
  "linkedin", "brief", "photo_url",
  "custom1_label", "custom1_value", "custom1_type",
  "custom2_label", "custom2_value", "custom2_type",
  "theme", "bg_color", "text_color", "accent_color",
];

const clean = (body) => {
  const out = {};
  for (const f of CARD_FIELDS) {
    let v = body[f];
    if (v === undefined) continue;
    if (typeof v === "string") v = v.trim();
    out[f] = v === "" ? null : v;
  }
  // "WhatsApp is the same as my phone" is the normal case, and storing NULL
  // says exactly that — rather than duplicating the number and letting the
  // two drift apart on the next edit.
  if (out.whatsapp && out.phone && out.whatsapp === out.phone) out.whatsapp = null;
  return out;
};

export const listCards = async (companyId) => {
  const [rows] = await db.execute(
    `SELECT c.*,
            (SELECT COUNT(*) FROM card_scans s WHERE s.card_id = c.id) AS scan_count,
            (SELECT COUNT(*) FROM card_leads l WHERE l.card_id = c.id) AS lead_count
       FROM digital_cards c
      WHERE c.company_id = ?
      ORDER BY c.created_at DESC`,
    [companyId]
  );
  return rows;
};

export const createCard = async (companyId, plan, body) => {
  const data = clean(body);
  if (!data.name || !data.phone) throw Object.assign(new Error("Name and phone are required"), { code: 400 });

  const { remaining, limit } = await getCardUsage(companyId, plan);
  if (remaining <= 0) {
    throw Object.assign(
      new Error(`Your plan allows ${limit} active card${limit === 1 ? "" : "s"}. Deactivate one to add another.`),
      { code: 403 }
    );
  }

  const slug = await uniqueSlug();
  const cols = ["company_id", "slug", ...Object.keys(data)];
  const vals = [companyId, slug, ...Object.values(data)];

  const [res] = await db.execute(
    `INSERT INTO digital_cards (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    vals
  );
  return { id: res.insertId, slug };
};

export const updateCard = async (companyId, id, body) => {
  const data = clean(body);
  if (!Object.keys(data).length) return false;

  // A locked card is read-only: the plan no longer covers it, so the admin
  // must release it before editing.
  const [[card]] = await db.execute(
    "SELECT id, is_locked FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1",
    [id, companyId]
  );
  if (!card) return false;
  if (card.is_locked) throw Object.assign(new Error("This card is locked. Release it first."), { code: 403 });

  const sets = Object.keys(data).map((k) => `${k} = ?`);
  await db.execute(
    `UPDATE digital_cards SET ${sets.join(", ")} WHERE id = ? AND company_id = ?`,
    [...Object.values(data), id, companyId]
  );
  return true;
};

/* Activate / deactivate. Never deletes: the public URL must keep resolving
   so a printed QR shows "details not available" rather than a dead link. */
export const setCardActive = async (companyId, id, active, plan) => {
  if (active) {
    const { remaining, limit } = await getCardUsage(companyId, plan);
    if (remaining <= 0) {
      throw Object.assign(
        new Error(`Your plan allows ${limit} active card${limit === 1 ? "" : "s"}.`),
        { code: 403 }
      );
    }
  }
  const [res] = await db.execute(
    "UPDATE digital_cards SET is_active = ? WHERE id = ? AND company_id = ?",
    [active ? 1 : 0, id, companyId]
  );
  return res.affectedRows > 0;
};

/* Lock / release, used when a downgrade leaves more cards than the plan
   allows. The admin chooses which — they know who is client-facing. */
export const setCardLocked = async (companyId, id, locked, plan) => {
  if (!locked) {
    const { remaining } = await getCardUsage(companyId, plan);
    if (remaining <= 0) {
      throw Object.assign(
        new Error("Releasing this card would exceed your plan. Lock another one first."),
        { code: 403 }
      );
    }
  }
  const [res] = await db.execute(
    "UPDATE digital_cards SET is_locked = ? WHERE id = ? AND company_id = ?",
    [locked ? 1 : 0, id, companyId]
  );
  return res.affectedRows > 0;
};

/* ======================================================
   PUBLIC VIEW
====================================================== */
export const getPublicCard = async (slug) => {
  const [[card]] = await db.execute(
    `SELECT c.*, co.logo_url AS company_logo_url, co.name AS owner_company_name, co.id AS company_id
       FROM digital_cards c
       JOIN companies co ON co.id = c.company_id
      WHERE c.slug = ? LIMIT 1`,
    [slug]
  );
  if (!card) return null;

  // Unavailable is deliberately indistinguishable between "taken offline"
  // and "locked by a downgrade": which of the two it is tells a stranger
  // something about the company's billing, and is none of their business.
  if (!card.is_active || card.is_locked) {
    return { unavailable: true, company_name: card.owner_company_name };
  }

  return {
    slug: card.slug,
    name: card.name,
    job_title: card.job_title,
    company_name: card.company_name || card.owner_company_name,
    company_logo_url: card.company_logo_url ? `/api/logo/${card.company_id}` : null,
    phone: card.phone,
    whatsapp: card.whatsapp || card.phone,   // NULL means "same as phone"
    email: card.email,
    linkedin: card.linkedin,
    brief: card.brief,
    photo_url: card.photo_url,
    custom: [
      card.custom1_label && { label: card.custom1_label, value: card.custom1_value, type: card.custom1_type },
      card.custom2_label && { label: card.custom2_label, value: card.custom2_value, type: card.custom2_type },
    ].filter(Boolean),
    theme: card.theme,
    bg_color: card.bg_color,
    text_color: card.text_color,
    accent_color: card.accent_color,
  };
};

/* One row per viewer per day. The hash is of IP + user agent and is never
   reversed — the counter does not need to know who anyone is, and holding
   visitor IPs against a named individual would be personal data with no
   purpose. */
export const recordScan = async (slug, ip, userAgent) => {
  const [[card]] = await db.execute(
    "SELECT id, is_active, is_locked FROM digital_cards WHERE slug = ? LIMIT 1",
    [slug]
  );
  if (!card || !card.is_active || card.is_locked) return;

  const viewerHash = crypto
    .createHash("sha256")
    .update(`${ip || ""}|${userAgent || ""}`)
    .digest("hex");

  // INSERT IGNORE against the (card, viewer, date) unique key: the second
  // view on the same day is silently dropped rather than counted.
  await db.execute(
    `INSERT IGNORE INTO card_scans (card_id, viewer_hash, scan_date)
     VALUES (?, ?, CURDATE())`,
    [card.id, viewerHash]
  );
};

/* ======================================================
   LEADS
====================================================== */
export const addLead = async (slug, body) => {
  const [[card]] = await db.execute(
    `SELECT c.id, c.company_id, c.name, c.email, c.is_active, c.is_locked
       FROM digital_cards c WHERE c.slug = ? LIMIT 1`,
    [slug]
  );
  if (!card || !card.is_active || card.is_locked) {
    throw Object.assign(new Error("This card is not available"), { code: 404 });
  }

  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();
  if (!name || !phone) throw Object.assign(new Error("Name and phone are required"), { code: 400 });

  const [res] = await db.execute(
    `INSERT INTO card_leads (card_id, company_id, name, phone, email, company_name, message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      card.id, card.company_id, name, phone,
      (body.email || "").trim() || null,
      (body.company_name || "").trim() || null,
      (body.message || "").trim() || null,
    ]
  );

  return { id: res.insertId, cardOwner: { name: card.name, email: card.email } };
};

export const listLeads = async (companyId) => {
  const [rows] = await db.execute(
    `SELECT l.*, c.name AS card_owner_name, c.slug AS card_slug
       FROM card_leads l
       JOIN digital_cards c ON c.id = l.card_id
      WHERE l.company_id = ?
      ORDER BY l.created_at DESC`,
    [companyId]
  );
  return rows;
};

export const markLeadNotified = async (leadId) => {
  await db.execute("UPDATE card_leads SET notified_at = NOW() WHERE id = ?", [leadId]);
};

/* ======================================================
   vCARD
   Built by hand rather than with a library: the format is a dozen lines,
   and the escaping rules below are the only subtle part.
====================================================== */
const esc = (v = "") => String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export const buildVCard = (card) => {
  // Splitting on the last space is a heuristic; it is right for most
  // Indian and Western names and harmless when it is not, since the full
  // name is also sent as FN, which is what phones display.
  const parts = (card.name || "").trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : "";
  const first = parts.join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(card.name)}`,
  ];

  if (card.company_name) lines.push(`ORG:${esc(card.company_name)}`);
  if (card.job_title)    lines.push(`TITLE:${esc(card.job_title)}`);
  if (card.phone)        lines.push(`TEL;TYPE=CELL:${esc(card.phone)}`);
  if (card.whatsapp && card.whatsapp !== card.phone) lines.push(`TEL;TYPE=WORK:${esc(card.whatsapp)}`);
  if (card.email)        lines.push(`EMAIL;TYPE=WORK:${esc(card.email)}`);
  if (card.linkedin)     lines.push(`URL:${esc(card.linkedin)}`);
  if (card.brief)        lines.push(`NOTE:${esc(card.brief)}`);

  lines.push("END:VCARD");

  // CRLF, not LF: the spec requires it and some Android contact importers
  // reject the file outright without it.
  return lines.join("\r\n");
};
