/**
 * services/digitalCard.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Digital visiting cards: the card itself, its public view, the scan counter
 * and the details a scanner chooses to share back.
 *
 * Two rules shape most of what follows:
 *
 *   Deactivating or locking keeps a card's URL resolving, to a page that
 *   says the details are not available: its QR may be printed on a few
 *   hundred physical cards already handed out. Deleting is the admin's
 *   deliberate choice to break that link; it removes the card, its scans
 *   and its leads, keeping only the filled-in details on record (see
 *   deleteCard in companyCardBlanks.service.js).
 *
 *   Scans are counted per viewer per day, not per page load. Bots, link
 *   previews and the owner checking their own card would otherwise inflate
 *   the number until nobody trusts it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import crypto from "crypto";
import { db } from "../config/db.js";
import { cardLimitFor } from "../constants/pricing.js";
import { deleteFromS3 } from "./s3.service.js";

/* ======================================================
   SUBSCRIPTION LAPSE
   Same rule as the rest of the product: trial, active and a running grace
   period all work; expired, cancelled, suspended or a grace period that
   has run out do not. Checked on every request rather than trusted from
   a token, so a lapse takes effect immediately.
====================================================== */
export const isLapsed = (company) => {
  const status = String(company?.subscription_status || "").toLowerCase();
  if (["expired", "cancelled", "suspended"].includes(status)) return true;
  if (status === "grace_period") {
    return !company.grace_period_ends_at || new Date(company.grace_period_ends_at) < new Date();
  }
  return false;
};

export const companyLapsed = async (companyId) => {
  const [[company]] = await db.execute(
    "SELECT subscription_status, grace_period_ends_at FROM companies WHERE id = ? LIMIT 1",
    [companyId]
  );
  return !company || isLapsed(company);
};

/* Uploaded photos live under a per-company prefix. A photo_url that does
   not start with it was not uploaded by this company and is refused, so a
   card can never be pointed at another company's object. */
export const photoPrefix = (companyId) => `digital-cards/${companyId}/`;

/* Before uploads, the photo was a pasted URL. Those cards still exist and
   must keep working — shown as-is, never presigned, proxied or deleted
   (a pasted URL's path could name a real object in our own bucket). */
export const isUploadedPhoto = (v) => typeof v === "string" && v.startsWith("digital-cards/");

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
export const uniqueSlug = async () => {
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
export const CARD_FIELDS = [
  "name", "job_title", "company_name", "phone", "whatsapp", "email",
  "linkedin", "brief", "photo_url",
  "custom1_label", "custom1_value", "custom1_type",
  "custom2_label", "custom2_value", "custom2_type",
  "theme", "bg_color", "text_color", "accent_color",
];

/* Column widths from add-digital-cards.sql. Checked here so an over-long
   value is a 400 the admin can act on, not a strict-mode "Data too long"
   that surfaces as a 500. */
const MAX_LEN = {
  name: 120, job_title: 120, company_name: 160, phone: 20, whatsapp: 20,
  email: 190, linkedin: 255, brief: 2000, photo_url: 255,
  custom1_label: 60, custom1_value: 255, custom2_label: 60, custom2_value: 255,
};
const LABELS = { custom1_label: "custom field 1 label", custom1_value: "custom field 1 value",
                 custom2_label: "custom field 2 label", custom2_value: "custom field 2 value",
                 job_title: "job title", company_name: "company name", photo_url: "photo URL" };
const HEX = /^#[0-9a-f]{6}$/i;
const BRIEF_WORDS = 30;

/* Same rules as the editor (frontend/app/home/cards/validate.js). India is
   the default country: a bare 10-digit number is taken as +91; any other
   country needs its code with a leading "+". */
const PHONE_CHARS = /^\+?[\d\s\-().]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINK = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i;

export const validPhone = (v) => {
  if (!PHONE_CHARS.test(v)) return false;
  const d = v.replace(/\D/g, "");
  if (v.startsWith("+")) return d.startsWith("91") ? d.length === 12 : d.length >= 8 && d.length <= 15;
  return d.replace(/^0/, "").length === 10 || (d.length === 12 && d.startsWith("91"));
};
export const validEmail = (v) => EMAIL.test(v);
const validLink = (v) => LINK.test(v);
export const bad = (msg) => Object.assign(new Error(msg), { code: 400 });

export const clean = (body = {}) => {
  const out = {};
  for (const f of CARD_FIELDS) {
    let v = body[f];
    if (v === undefined) continue;
    // Only strings and null reach the DB; an object or array here would
    // otherwise be serialised by the driver into something meaningless.
    if (v !== null && typeof v !== "string") throw bad(`Invalid value for ${f}`);
    if (typeof v === "string") v = v.trim();
    out[f] = v === "" ? null : v;
    if (out[f] && MAX_LEN[f] && out[f].length > MAX_LEN[f]) {
      throw bad(`${LABELS[f] || f} must be ${MAX_LEN[f]} characters or fewer`);
    }
  }

  // The brief sits under the name on the card; the editor holds it to the
  // same word count, so this only catches a bypassed client.
  if (out.brief && out.brief.split(/\s+/).length > BRIEF_WORDS) {
    throw bad(`Keep the brief to ${BRIEF_WORDS} words or fewer`);
  }

  if (out.phone && !validPhone(out.phone)) throw bad("Enter a valid phone number");
  if (out.whatsapp && !validPhone(out.whatsapp)) throw bad("Enter a valid WhatsApp number");
  if (out.email && !validEmail(out.email)) throw bad("Enter a valid email address");
  if (out.linkedin && !validLink(out.linkedin)) throw bad("Enter a valid LinkedIn address");

  // NOT NULL enum / theme columns: blank means "default", never NULL.
  for (const f of ["custom1_type", "custom2_type"]) {
    if (f in out) out[f] = out[f] === "link" ? "link" : "text";
  }
  if ("theme" in out) out.theme = out.theme && /^[a-z]{1,32}$/.test(out.theme) ? out.theme : "ink";

  // A plain on/off flag: anything but an explicit yes is off.
  if (body.photo_on_print !== undefined) {
    out.photo_on_print = [true, 1, "1", "true"].includes(body.photo_on_print) ? 1 : 0;
  }

  // A custom value marked as a link must be a web address; otherwise the
  // card shows a dead link.
  for (const n of [1, 2]) {
    if (out[`custom${n}_type`] === "link" && out[`custom${n}_value`] && !validLink(out[`custom${n}_value`])) {
      throw bad(`Custom field ${n} must be a web address`);
    }
  }

  for (const f of ["bg_color", "text_color", "accent_color"]) {
    if (out[f] && !HEX.test(out[f])) throw bad("Colours must be in #RRGGBB form");
  }

  // "WhatsApp is the same as my phone" is the normal case, and storing NULL
  // says exactly that — rather than duplicating the number and letting the
  // two drift apart on the next edit.
  if (out.whatsapp && out.phone && out.whatsapp === out.phone) out.whatsapp = null;
  return out;
};

/* A new photo must be one this company uploaded. Re-sending the photo a
   card already has is always fine, so a legacy pasted URL survives edits. */
const checkPhoto = (data, companyId, current = null) => {
  if (!data.photo_url || data.photo_url === current) return;
  if (!data.photo_url.startsWith(photoPrefix(companyId))) throw bad("Please upload the photo again");
};

export const listCards = async (companyId) => {
  const [rows] = await db.execute(
    `SELECT c.*,
            (SELECT COUNT(*) FROM card_scans s WHERE s.card_id = c.id) AS scan_count,
            (SELECT COUNT(*) FROM card_leads l WHERE l.card_id = c.id) AS lead_count
       FROM digital_cards c
      WHERE c.company_id = ?
      ORDER BY c.created_at DESC, c.id DESC`,
    [companyId]
  );
  return rows;
};

export const getCard = async (companyId, id) => {
  const [[card]] = await db.execute(
    "SELECT * FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1",
    [id, companyId]
  );
  return card || null;
};

export const createCard = async (companyId, plan, body) => {
  const data = clean(body);
  checkPhoto(data, companyId);
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
  // Name and phone are NOT NULL; clearing either would be a DB error.
  if (("name" in data && !data.name) || ("phone" in data && !data.phone)) {
    throw bad("Name and phone are required");
  }

  // A locked card is read-only: the plan no longer covers it, so the admin
  // must release it before editing.
  const [[card]] = await db.execute(
    "SELECT id, is_locked, photo_url, source, serial_no, claimed_at, name, phone FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1",
    [id, companyId]
  );
  if (!card) return false;
  if (card.is_locked) throw Object.assign(new Error("This card is locked. Release it first."), { code: 403 });
  checkPhoto(data, companyId, card.photo_url);

  const sets = Object.keys(data).map((k) => `${k} = ?`);
  // The admin filling in an empty QR card themselves: once it has a name
  // and phone it is live, exactly as if the employee had scanned it.
  const name = "name" in data ? data.name : card.name;
  const phone = "phone" in data ? data.phone : card.phone;
  if (isUnclaimed(card) && name && phone) sets.push("claimed_at = NOW()");
  await db.execute(
    `UPDATE digital_cards SET ${sets.join(", ")} WHERE id = ? AND company_id = ?`,
    [...Object.values(data), id, companyId]
  );

  // A replaced or removed photo is otherwise an orphan in the bucket.
  // Only our own uploads under this company's prefix are ever deleted.
  // A converted QR card's photo lives under the pool prefix and is this
  // card's alone, so it goes too.
  if ("photo_url" in data && card.photo_url && card.photo_url !== data.photo_url &&
      (card.photo_url.startsWith(photoPrefix(companyId)) || card.photo_url.startsWith("digital-cards/pool/"))) {
    deleteFromS3(card.photo_url).catch(() => {});
  }
  return true;
};

/* Activate / deactivate. Never deletes: the public URL must keep resolving
   so a printed QR shows "details not available" rather than a dead link. */
export const setCardActive = async (companyId, id, active, plan) => {
  const [[card]] = await db.execute(
    "SELECT is_active, is_locked FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1",
    [id, companyId]
  );
  if (!card) return false;
  // A locked card cannot be switched on: that would sidestep the plan
  // limit the lock exists to enforce.
  if (active && card.is_locked) throw Object.assign(new Error("This card is locked. Release it first."), { code: 403 });
  // Only a card that is currently off takes a new slot; re-activating an
  // active card at the limit must not report "limit reached".
  if (active && !card.is_active) {
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
  const [[card]] = await db.execute(
    "SELECT is_active, is_locked FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1",
    [id, companyId]
  );
  if (!card) return false;
  // Releasing only takes a slot when the card is active and currently
  // locked; releasing an inactive card costs nothing.
  if (!locked && card.is_locked && card.is_active) {
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
/* Pool cards (printed blank, claimed by whoever scans first) have no
   company until their owner pays, so the company is a LEFT JOIN and a
   missing one never counts as lapsed: a free card lives until the
   superadmin disables it. */
const PUBLIC_SELECT =
  `SELECT c.*, co.logo_url AS company_logo_url, co.name AS owner_company_name,
          co.subscription_status, co.grace_period_ends_at
     FROM digital_cards c
     LEFT JOIN companies co ON co.id = c.company_id`;

/* Empty: a printed Haivisitor pool card, or a company's numbered QR card,
   that nobody has filled in yet. A card made in the editor has no number
   and is never empty. */
export const isUnclaimed = (card) =>
  !!card && !card.claimed_at && (card.source === "pool" || (card.source === "company" && card.serial_no != null));

/* A company's empty card: what the fill-in form needs to show the card as
   it will look. Only the company's own name and logo, and the colours the
   admin chose. */
const companyBlank = (card) => ({
  unclaimed: true,
  slug: card.slug,
  company: {
    name: card.owner_company_name || "",
    logo_url: card.company_logo_url ? `/api/logo/${card.company_id}` : null,
    theme: card.theme,
    bg_color: card.bg_color,
    text_color: card.text_color,
    accent_color: card.accent_color,
  },
});

export const getPublicCard = async (slug) => {
  const [[card]] = await db.execute(`${PUBLIC_SELECT} WHERE c.slug = ? LIMIT 1`, [slug]);
  if (!card) return null;

  if (!card.is_active) {
    return { unavailable: true, company_name: card.owner_company_name || null };
  }
  // A blank card's page is its claim form. Nothing about the batch it came
  // from is shown to whoever is holding it.
  if (isUnclaimed(card)) {
    // A pool card carries its batch's colours, for the claim form to start from.
    if (card.source === "pool") {
      return {
        unclaimed: true, slug: card.slug,
        style: { theme: card.theme, bg_color: card.bg_color, text_color: card.text_color, accent_color: card.accent_color },
      };
    }
    // A company's empty card follows the company: locked or lapsed, it
    // cannot be filled in.
    if (card.is_locked || isLapsed(card)) {
      return { unavailable: true, company_name: card.owner_company_name || null };
    }
    return companyBlank(card);
  }

  // Unavailable is deliberately indistinguishable between "taken offline"
  // and "locked by a downgrade": which of the two it is tells a stranger
  // something about the company's billing, and is none of their business.
  // A lapsed subscription takes every card offline, as with the other
  // modules, and looks the same to the scanner as a deactivated card —
  // except a claimed card whose owner's paid plan ran out, which says so.
  const lapsed = card.company_id && isLapsed(card);
  if (card.is_locked || lapsed) {
    return {
      unavailable: true,
      expired: card.source === "pool" && !!lapsed,
      company_name: card.owner_company_name || null,
    };
  }

  return {
    slug: card.slug,
    name: card.name,
    job_title: card.job_title,
    company_name: card.company_name || card.owner_company_name,
    // A claimed card's own logo wins, and stays after conversion, so the
    // card does not change under its owner when they sign up.
    company_logo_url: isUploadedPhoto(card.own_logo_url) ? `/api/public/cards/${card.slug}/logo`
      : card.company_logo_url && card.company_id ? `/api/logo/${card.company_id}`
      : null,
    phone: card.phone,
    whatsapp: card.whatsapp || card.phone,   // NULL means "same as phone"
    email: card.email,
    linkedin: card.linkedin,
    brief: card.brief,
    // Served through a proxy by slug: the bucket is private, and a
    // presigned URL would expire on a page people bookmark.
    photo_url: !card.photo_url ? null
      : isUploadedPhoto(card.photo_url) ? `/api/public/cards/${card.slug}/photo`
      : /^https:\/\//i.test(card.photo_url) ? card.photo_url   // legacy pasted URL
      : null,
    custom: [
      // Both halves required: a label with no value is an empty row, and
      // an empty link value would render as a dead "https://".
      card.custom1_label && card.custom1_value && { label: card.custom1_label, value: card.custom1_value, type: card.custom1_type },
      card.custom2_label && card.custom2_value && { label: card.custom2_label, value: card.custom2_value, type: card.custom2_type },
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
    "SELECT id, is_active, is_locked, source, serial_no, claimed_at FROM digital_cards WHERE slug = ? LIMIT 1",
    [slug]
  );
  // A blank card being claimed is not a scan of anyone's card.
  if (!card || !card.is_active || card.is_locked || isUnclaimed(card)) return;

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

/* The S3 key behind a public card's photo, only while the card is live. */
export const getPublicPhotoKey = async (slug) => {
  const card = await getPublicCard(slug);
  if (!card || card.unavailable || !card.photo_url) return null;
  const [[row]] = await db.execute("SELECT photo_url FROM digital_cards WHERE slug = ? LIMIT 1", [slug]);
  return isUploadedPhoto(row?.photo_url) ? row.photo_url : null;
};

/* Same, for a claimed card's own logo. */
export const getPublicLogoKey = async (slug) => {
  const card = await getPublicCard(slug);
  if (!card || card.unavailable || card.unclaimed) return null;
  const [[row]] = await db.execute("SELECT own_logo_url FROM digital_cards WHERE slug = ? LIMIT 1", [slug]);
  return isUploadedPhoto(row?.own_logo_url) ? row.own_logo_url : null;
};

/* ======================================================
   LEADS
====================================================== */
export const addLead = async (slug, body) => {
  const [[card]] = await db.execute(
    `SELECT c.id, c.company_id, c.slug, c.name, c.email, c.phone, c.is_active, c.is_locked,
            c.source, c.serial_no, c.claimed_at, c.teaser_sent_at,
            co.subscription_status, co.grace_period_ends_at
       FROM digital_cards c LEFT JOIN companies co ON co.id = c.company_id
      WHERE c.slug = ? LIMIT 1`,
    [slug]
  );
  if (!card || !card.is_active || card.is_locked || isUnclaimed(card) ||
      (card.company_id && isLapsed(card))) {
    throw Object.assign(new Error("This card is not available"), { code: 404 });
  }

  // Public, unauthenticated input: coerce defensively so a non-string field
  // is a 400, not a TypeError on .trim().
  const str = (v, max) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (s.length > max) throw bad("One of the fields is too long");
    return s;
  };
  const name = str(body?.name, 120);
  const phone = str(body?.phone, 20);
  if (!name || !phone) throw bad("Name and phone are required");
  if (!validPhone(phone)) throw bad("Enter a valid phone number");
  const email = str(body?.email, 190);
  if (email && !validEmail(email)) throw bad("Enter a valid email address");
  const leadCompany = str(body?.company_name, 160);
  const message = str(body?.message, 2000);

  const [res] = await db.execute(
    `INSERT INTO card_leads (card_id, company_id, name, phone, email, company_name, message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      card.id, card.company_id, name, phone,
      email || null, leadCompany || null, message || null,
    ]
  );

  return {
    id: res.insertId,
    cardOwner: { name: card.name, email: card.email },
    // A claimed card with no company yet: the route applies the free-card
    // rules (first leads in full, then a daily teaser) instead.
    freeCard: !card.company_id ? card : null,
  };
};

export const listLeads = async (companyId) => {
  const [rows] = await db.execute(
    `SELECT l.*, COALESCE(c.name, l.card_owner_name) AS card_owner_name, c.slug AS card_slug,
            (l.card_id IS NULL) AS card_deleted
       FROM card_leads l
       LEFT JOIN digital_cards c ON c.id = l.card_id
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
const esc = (v = "") => String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

/* Saved contacts are dialled from anywhere, so a bare Indian number gets
   its +91. Anything already carrying a code is left as typed. */
export const intl = (phone = "") => {
  const s = String(phone).trim();
  if (s.startsWith("+")) return s;
  const d = s.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  const local = d.replace(/^0/, "");
  return local.length === 10 ? `+91${local}` : s;
};

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
  if (card.phone)        lines.push(`TEL;TYPE=CELL:${esc(intl(card.phone))}`);
  if (card.whatsapp && card.whatsapp !== card.phone) lines.push(`TEL;TYPE=WORK:${esc(intl(card.whatsapp))}`);
  if (card.email)        lines.push(`EMAIL;TYPE=WORK:${esc(card.email)}`);
  if (card.linkedin)     lines.push(`URL:${esc(card.linkedin)}`);
  if (card.brief)        lines.push(`NOTE:${esc(card.brief)}`);

  lines.push("END:VCARD");

  // CRLF, not LF, and after the last line too: the spec requires it and
  // some Android contact importers reject the file outright without it.
  return lines.join("\r\n") + "\r\n";
};
