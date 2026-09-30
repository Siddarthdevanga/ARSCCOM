/**
 * services/cardPool.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The QR card pool: blank visiting cards the superadmin prints in batches
 * and the team hands out. Whoever scans one first claims it by filling in
 * their details; it then works as their digital visiting card, with no
 * login. When they later pay for any plan with the same email or phone,
 * the card moves into that company, scans and leads included.
 *
 * Pool cards are ordinary rows in digital_cards (source = 'pool'), so the
 * public page, vCard, photo proxy and scan counter serve them unchanged.
 * Their state is derived, never stored:
 *
 *   unclaimed   claimed_at IS NULL
 *   claimed     claimed_at set, company_id NULL
 *   converted   company_id set
 *   disabled    is_active = 0 (overrides the above)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import crypto from "crypto";
import { db } from "../config/db.js";
import {
  clean, bad, uniqueSlug, isUploadedPhoto, getCardUsage, CARD_FIELDS,
} from "./digitalCard.service.js";
import { uploadToS3, deleteFromS3, getPresignedUrl } from "./s3.service.js";

/* The frontend's address, for the URL each QR encodes. FRONTEND_URL can
   be a list (it also feeds CORS); the first entry is the site. */
export const SITE = String(process.env.FRONTEND_URL || "https://www.haivisitor.zodopt.com")
  .split(",")[0].trim().replace(/\/+$/, "");
export const cardUrl = (slug) => `${SITE}/card/${slug}`;

/* Uploads for a card that has no company yet. Still under digital-cards/,
   so isUploadedPhoto and the public photo proxy treat them like any other. */
export const poolPrefix = (slug) => `digital-cards/pool/${slug}/`;

export const MAX_BATCH = 100;

/* Free cards: this many leads are emailed in full, then only a teaser. */
export const FREE_FULL_LEADS = 5;

/* "B3-042": the batch and the card's place in it, printed small under
   the QR so a returned or misprinted card can be found. */
export const serialLabel = (batchId, n) =>
  batchId && n ? `B${batchId}-${String(n).padStart(3, "0")}` : "";

/* Last 10 digits, whatever format the number was typed in. */
export const phone10 = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};

const notFound = () => Object.assign(new Error("Card not found"), { code: 404 });

/* ======================================================
   IMAGES
   Same formats and signature check as the company editor. Nothing is
   stored until the claim itself goes through.
====================================================== */
export const IMAGE_TYPES = {
  "image/jpeg": { ext: "jpg",  sig: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png":  { ext: "png",  sig: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/webp": { ext: "webp", sig: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" },
};
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const checkImage = (file, what) => {
  if (!file) return null;
  const type = IMAGE_TYPES[file.mimetype];
  if (!type || !file.buffer?.length || !type.sig(file.buffer)) {
    throw bad(`The ${what} must be a JPG, PNG or WebP image`);
  }
  return type;
};

const storeImage = async (slug, file, kind) => {
  const type = IMAGE_TYPES[file.mimetype];
  const key = `${poolPrefix(slug)}${kind}-${crypto.randomBytes(8).toString("hex")}.${type.ext}`;
  await uploadToS3(file, key);
  return key;
};

/* Only ever our own uploads; a legacy pasted URL is never deleted. */
export const dropImage = (key) => {
  if (isUploadedPhoto(key)) deleteFromS3(key).catch(() => {});
};

/* ======================================================
   CARD DETAILS
   Everything the editor allows, less the photo URL (set only by upload).
   Name, phone and email are all required here: the email is how the owner
   hears about leads and how the card finds them when they sign up.
====================================================== */
export const cleanDetails = (body = {}, { partial = false } = {}) => {
  const input = { ...body };
  delete input.photo_url;
  const data = clean(input);
  for (const [f, label] of [["name", "your name"], ["phone", "your phone number"], ["email", "your email address"]]) {
    // An edit that leaves a field out keeps it; one that blanks it is refused.
    if ((f in data || !partial) && !data[f]) throw bad(`Please add ${label}`);
  }
  return data;
};

/* One card per person. A match on either the email or the phone counts:
   a second card for the same person would split their leads and confuse
   the later move into their account. */
const assertNotDuplicate = async ({ email, claimPhone }, exceptId = 0, conn = db) => {
  const [[hit]] = await conn.execute(
    `SELECT id FROM digital_cards
      WHERE source = 'pool' AND claimed_at IS NOT NULL AND id <> ?
        AND (email = ? OR (claim_phone10 IS NOT NULL AND claim_phone10 = ?))
      LIMIT 1`,
    [exceptId, email || "", claimPhone || ""]
  );
  if (hit) {
    throw Object.assign(
      new Error("You already have a card. One card per person — the one you claimed first is still yours."),
      { code: 409 }
    );
  }
};

/* ======================================================
   CLAIM (public)
====================================================== */
export const claimCard = async (slug, body = {}, files = {}) => {
  const [[card]] = await db.execute(
    "SELECT id, slug, source, claimed_at, is_active FROM digital_cards WHERE slug = ? LIMIT 1",
    [slug]
  );
  if (!card || card.source !== "pool") throw notFound();
  if (!card.is_active) throw Object.assign(new Error("This card is no longer active"), { code: 410 });
  if (card.claimed_at) throw Object.assign(new Error("This card has already been claimed"), { code: 409 });

  if (![true, "true", "1", 1, "on"].includes(body.consent)) {
    throw bad("Please accept the terms to claim your card");
  }

  const data = cleanDetails(body);
  const claimPhone = phone10(data.phone);
  // Early, so a repeat claimer hears it before their images upload. The
  // check that counts is repeated under the lock below.
  await assertNotDuplicate({ email: data.email, claimPhone });

  checkImage(files.photo, "photo");
  checkImage(files.logo, "logo");
  const photoKey = files.photo ? await storeImage(slug, files.photo, "photo") : null;
  const logoKey  = files.logo  ? await storeImage(slug, files.logo, "logo")   : null;

  // Claims run one at a time from the duplicate check to the update, so
  // one person claiming two cards in the same second gets only the first.
  // Claims are rare and quick; the wait is never noticeable.
  const conn = await db.getConnection();
  let locked = false;
  try {
    const [[lock]] = await conn.query("SELECT GET_LOCK('card_pool_claim', 10) AS ok");
    locked = lock?.ok === 1;
    if (!locked) throw Object.assign(new Error("Busy — please try again in a moment"), { code: 503 });

    await assertNotDuplicate({ email: data.email, claimPhone }, 0, conn);

    // Guarded on claimed_at, so of two people claiming the same card at
    // the same moment exactly one wins.
    const sets = { ...data, photo_url: photoKey, own_logo_url: logoKey, claim_phone10: claimPhone };
    if (!photoKey) sets.photo_on_print = 0;
    const cols = Object.keys(sets);
    const [res] = await conn.execute(
      `UPDATE digital_cards SET ${cols.map((k) => `${k} = ?`).join(", ")}, claimed_at = NOW()
        WHERE id = ? AND claimed_at IS NULL AND is_active = 1`,
      [...Object.values(sets), card.id]
    );
    if (!res.affectedRows) throw Object.assign(new Error("This card has already been claimed"), { code: 409 });
  } catch (err) {
    dropImage(photoKey);
    dropImage(logoKey);
    throw err;
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK('card_pool_claim')").catch(() => {});
    conn.release();
  }
  return getCardRow(card.id);
};

const getCardRow = async (id) => {
  const [[row]] = await db.execute("SELECT * FROM digital_cards WHERE id = ? LIMIT 1", [id]);
  return row || null;
};

/* ======================================================
   BATCHES
====================================================== */
export const createBatch = async ({ name, header, quantity } = {}, adminId = null) => {
  const n = typeof name === "string" ? name.trim() : "";
  const h = typeof header === "string" ? header.trim() : "";
  const q = Number(quantity);
  if (!n) throw bad("Give the batch a name");
  if (n.length > 120) throw bad("Batch name must be 120 characters or fewer");
  if (h.length > 160) throw bad("Header must be 160 characters or fewer");
  if (!Number.isInteger(q) || q < 1 || q > MAX_BATCH) throw bad(`Quantity must be between 1 and ${MAX_BATCH}`);

  // Slugs are picked before the transaction: uniqueSlug reads the table,
  // and the UNIQUE key is the final guard anyway.
  const slugs = new Set();
  while (slugs.size < q) slugs.add(await uniqueSlug());

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [b] = await conn.execute(
      "INSERT INTO card_batches (name, header, quantity, created_by) VALUES (?, ?, ?, ?)",
      [n, h || null, q, adminId]
    );
    const rows = [...slugs].map((slug, i) => [slug, "pool", b.insertId, i + 1]);
    await conn.query(
      "INSERT INTO digital_cards (slug, source, batch_id, serial_no) VALUES ?",
      [rows]
    );
    await conn.commit();
    return { id: b.insertId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
};

const COUNTS = `
  COUNT(c.id)                                             AS printed,
  COALESCE(SUM(c.claimed_at IS NOT NULL), 0)              AS claimed,
  COALESCE(SUM(c.company_id IS NOT NULL), 0)              AS converted,
  COALESCE(SUM(c.is_active = 0), 0)                       AS disabled`;

const withRate = (r) => {
  const printed = Number(r.printed) || 0;
  const claimed = Number(r.claimed) || 0;
  const converted = Number(r.converted) || 0;
  return {
    ...r, printed, claimed, converted, disabled: Number(r.disabled) || 0,
    // Of the cards people claimed, how many became paying accounts.
    conversion_rate: claimed ? Math.round((converted / claimed) * 1000) / 10 : 0,
  };
};

export const listBatches = async () => {
  const [rows] = await db.execute(
    `SELECT b.id, b.name, b.header, b.quantity, b.created_at, ${COUNTS}
       FROM card_batches b
       LEFT JOIN digital_cards c ON c.batch_id = b.id AND c.source = 'pool'
      GROUP BY b.id
      ORDER BY b.id DESC`
  );
  return rows.map(withRate);
};

export const overallStats = async () => {
  const [[row]] = await db.execute(`SELECT ${COUNTS} FROM digital_cards c WHERE c.source = 'pool'`);
  return withRate(row);
};

export const getBatchForPrint = async (id) => {
  const [[batch]] = await db.execute("SELECT * FROM card_batches WHERE id = ? LIMIT 1", [id]);
  if (!batch) return null;
  const [cards] = await db.execute(
    `SELECT slug, serial_no FROM digital_cards
      WHERE batch_id = ? AND source = 'pool' ORDER BY serial_no`,
    [id]
  );
  return { batch, cards: cards.map((c) => ({ slug: c.slug, serial: serialLabel(batch.id, c.serial_no) })) };
};

/* ======================================================
   CARDS (superadmin)
   Lead details are never shown here, only counts: they belong to the card
   owner, and become visible to them when they sign up.
====================================================== */
const STATUS_WHERE = {
  unclaimed: "c.is_active = 1 AND c.claimed_at IS NULL",
  claimed:   "c.is_active = 1 AND c.claimed_at IS NOT NULL AND c.company_id IS NULL",
  converted: "c.is_active = 1 AND c.company_id IS NOT NULL",
  disabled:  "c.is_active = 0",
};

export const statusOf = (c) =>
  !c.is_active ? "disabled" : c.company_id ? "converted" : c.claimed_at ? "claimed" : "unclaimed";

const LIST_SELECT = `
  SELECT c.id, c.slug, c.batch_id, c.serial_no, c.name, c.phone, c.email, c.company_name,
         c.job_title, c.is_active, c.is_locked, c.company_id, c.claimed_at, c.converted_at,
         c.created_at, b.name AS batch_name, co.name AS converted_company,
         (SELECT COUNT(*) FROM card_scans s WHERE s.card_id = c.id) AS views,
         (SELECT COUNT(*) FROM card_leads l WHERE l.card_id = c.id) AS leads
    FROM digital_cards c
    LEFT JOIN card_batches b ON b.id = c.batch_id
    LEFT JOIN companies co   ON co.id = c.company_id`;

const shape = (r) => ({
  ...r,
  serial: serialLabel(r.batch_id, r.serial_no),
  status: statusOf(r),
  card_url: cardUrl(r.slug),
});

/* The screen shows at most LIST_LIMIT rows and the export EXPORT_LIMIT;
   beyond that `truncated` is set and the admin narrows by batch, status
   or search. One more row than the limit is read to know. */
export const LIST_LIMIT = 1000;
export const EXPORT_LIMIT = 10000;

const queryPoolCards = async ({ status, batchId, q } = {}, limit) => {
  const where = ["c.source = 'pool'"];
  const args = [];
  if (STATUS_WHERE[status]) where.push(STATUS_WHERE[status]);
  if (batchId && Number(batchId)) { where.push("c.batch_id = ?"); args.push(Number(batchId)); }
  const term = typeof q === "string" ? q.trim().slice(0, 100) : "";
  if (term) {
    where.push("(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company_name LIKE ? OR c.slug = ?)");
    const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    args.push(like, like, like, like, term);
  }
  const [rows] = await db.execute(
    `${LIST_SELECT} WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(c.claimed_at, c.created_at) DESC, c.id DESC
      LIMIT ${Number(limit) + 1}`,
    args
  );
  return { cards: rows.slice(0, limit).map(shape), truncated: rows.length > limit, limit };
};

export const listPoolCards = (filters) => queryPoolCards(filters, LIST_LIMIT);

export const getPoolCard = async (id) => {
  const [[row]] = await db.execute(`${LIST_SELECT} WHERE c.id = ? AND c.source = 'pool' LIMIT 1`, [id]);
  if (!row) return null;
  const full = await getCardRow(id);
  const preview = (k) => (isUploadedPhoto(k) ? getPresignedUrl(k, 3600).catch(() => null) : null);
  return {
    ...full,
    ...shape(row),
    photo_preview: await preview(full.photo_url),
    logo_preview: await preview(full.own_logo_url),
  };
};

/* Superadmin edit. The owner cannot edit their card once claimed; this is
   how a typo gets fixed. Photo and logo can be replaced or removed. */
export const updatePoolCard = async (id, body = {}, files = {}) => {
  const card = await getCardRow(id);
  if (!card || card.source !== "pool") throw notFound();
  if (!card.claimed_at) throw bad("This card has not been claimed yet");

  const data = cleanDetails(body, { partial: true });
  const email = "email" in data ? data.email : card.email;
  const claimPhone = "phone" in data ? phone10(data.phone) : card.claim_phone10;
  if ("email" in data || "phone" in data) {
    await assertNotDuplicate({ email, claimPhone }, card.id);
    data.claim_phone10 = claimPhone;
  }

  checkImage(files.photo, "photo");
  checkImage(files.logo, "logo");
  const old = [];
  if (files.photo) { data.photo_url = await storeImage(card.slug, files.photo, "photo"); old.push(card.photo_url); }
  else if ([true, "true", "1"].includes(body.remove_photo)) { data.photo_url = null; data.photo_on_print = 0; old.push(card.photo_url); }
  if (files.logo) { data.own_logo_url = await storeImage(card.slug, files.logo, "logo"); old.push(card.own_logo_url); }
  else if ([true, "true", "1"].includes(body.remove_logo)) { data.own_logo_url = null; old.push(card.own_logo_url); }

  const cols = Object.keys(data);
  if (!cols.length) return true;
  await db.execute(
    `UPDATE digital_cards SET ${cols.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
    [...Object.values(data), card.id]
  );
  old.forEach(dropImage);
  return true;
};

export const setPoolCardActive = async (id, active) => {
  const [res] = await db.execute(
    "UPDATE digital_cards SET is_active = ? WHERE id = ? AND source = 'pool'",
    [active ? 1 : 0, id]
  );
  return res.affectedRows > 0;
};

/* Back to blank: the claimer's details, photo, logo, scans and leads are
   all wiped, and the same printed card can be handed to someone else. A
   converted card belongs to a company and is not reset from here. */
export const resetPoolCard = async (id) => {
  const blank = Object.fromEntries(CARD_FIELDS.map((f) => [f, null]));
  blank.custom1_type = "text";
  blank.custom2_type = "text";
  blank.theme = "ink";
  const sets = {
    ...blank, own_logo_url: null, photo_on_print: 0, claimed_at: null,
    claim_phone10: null, teaser_sent_at: null, is_locked: 0,
  };

  // The row is locked for the check and the wipe, so the conversion job
  // cannot move the card into a company in between.
  const conn = await db.getConnection();
  let card;
  try {
    await conn.beginTransaction();
    [[card]] = await conn.execute("SELECT * FROM digital_cards WHERE id = ? LIMIT 1 FOR UPDATE", [id]);
    if (!card || card.source !== "pool") throw notFound();
    if (card.company_id) {
      throw Object.assign(new Error("This card has moved into a company account and cannot be reset"), { code: 409 });
    }
    await conn.execute("DELETE FROM card_leads WHERE card_id = ?", [card.id]);
    await conn.execute("DELETE FROM card_scans WHERE card_id = ?", [card.id]);
    await conn.execute(
      `UPDATE digital_cards SET ${Object.keys(sets).map((k) => `${k} = ?`).join(", ")}
        WHERE id = ? AND company_id IS NULL`,
      [...Object.values(sets), card.id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  dropImage(card.photo_url);
  dropImage(card.own_logo_url);
  return true;
};

/* ======================================================
   CONVERSION
   The card moves into the company with its QR, scans and leads. It then
   counts against the plan's card allowance; if the plan is already full,
   it arrives locked and the admin chooses what to release.
====================================================== */
export const convertCard = async (cardId, companyId) => {
  const [[company]] = await db.execute("SELECT id, plan FROM companies WHERE id = ? LIMIT 1", [companyId]);
  if (!company) throw Object.assign(new Error("Company not found"), { code: 404 });

  const card = await getCardRow(cardId);
  if (!card || card.source !== "pool") throw notFound();
  if (!card.claimed_at) throw bad("An unclaimed card cannot be linked to a company");
  if (card.company_id) throw Object.assign(new Error("This card is already linked to a company"), { code: 409 });

  const { remaining } = await getCardUsage(companyId, (company.plan || "trial").toLowerCase());
  const locked = card.is_active && remaining <= 0 ? 1 : 0;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute(
      `UPDATE digital_cards SET company_id = ?, converted_at = NOW(), is_locked = ?
        WHERE id = ? AND company_id IS NULL`,
      [companyId, locked, cardId]
    );
    if (res.affectedRows) {
      await conn.execute("UPDATE card_leads SET company_id = ? WHERE card_id = ?", [companyId, cardId]);
    }
    await conn.commit();
    return { converted: res.affectedRows > 0, locked: !!locked };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
};

/* Claimed cards whose owner now has a paid account: any plan, including
   the landing-page trial, which is paid, and a grace period that is still
   running (the same rule as isLapsed). 'pending' is a registration that
   has not paid yet. A match on either email or phone counts; the two are
   separate joins so each can use its index. */
export const findConvertibleCards = async () => {
  const PAID = `c.source = 'pool' AND c.claimed_at IS NOT NULL AND c.company_id IS NULL
    AND (co.subscription_status IN ('trial', 'active')
         OR (co.subscription_status = 'grace_period' AND co.grace_period_ends_at > ?))`;
  const now = new Date();
  const [rows] = await db.execute(
    `SELECT card_id, MIN(company_id) AS company_id FROM (
       SELECT c.id AS card_id, co.id AS company_id
         FROM digital_cards c
         JOIN users u      ON u.email = c.email
         JOIN companies co ON co.id = u.company_id
        WHERE ${PAID}
       UNION ALL
       SELECT c.id, co.id
         FROM digital_cards c
         JOIN users u      ON RIGHT(u.phone, 10) = c.claim_phone10
         JOIN companies co ON co.id = u.company_id
        WHERE c.claim_phone10 IS NOT NULL AND ${PAID}
     ) m
     GROUP BY card_id`,
    [now, now]
  );
  return rows;
};

/* A converted card whose company is deleted goes back to being its
   owner's free card rather than being deleted with it (the foreign key
   cascades): the printed QR keeps working and the leads stay with it.
   Called inside deleteCompany's transaction, before the company row goes. */
export const detachPoolCards = async (conn, companyId) => {
  await conn.query(
    `UPDATE card_leads l JOIN digital_cards c ON c.id = l.card_id
        SET l.company_id = NULL
      WHERE c.company_id = ? AND c.source = 'pool'`,
    [companyId]
  );
  await conn.query(
    `UPDATE digital_cards SET company_id = NULL, converted_at = NULL, is_locked = 0
      WHERE company_id = ? AND source = 'pool'`,
    [companyId]
  );
};

export const convertMatchingCards = async () => {
  const matches = await findConvertibleCards();
  let converted = 0;
  for (const m of matches) {
    try {
      const r = await convertCard(m.card_id, m.company_id);
      if (r.converted) converted++;
    } catch (err) {
      console.error("[card-pool] convert", m.card_id, err?.message);
    }
  }
  return converted;
};

/* ======================================================
   FREE-CARD LEADS
   How many leads a claimed card has had, for the first-five rule.
   The teaser goes out at most once a calendar day, and only on a day a
   lead arrives; claiming the day here, atomically, stops two leads a
   second apart both sending one.
====================================================== */
export const leadCount = async (cardId) => {
  const [[row]] = await db.execute("SELECT COUNT(*) AS n FROM card_leads WHERE card_id = ?", [cardId]);
  return Number(row.n) || 0;
};

/* Which lead this is for the card (1 = first). Fixed once saved, so two
   leads arriving together around the fifth are each emailed the right way. */
export const leadPosition = async (cardId, leadId) => {
  const [[row]] = await db.execute(
    "SELECT COUNT(*) AS n FROM card_leads WHERE card_id = ? AND id <= ?",
    [cardId, leadId]
  );
  return Number(row.n) || 0;
};

/* Start of today in India, whatever the database's own time zone. */
const IST_MS = 5.5 * 60 * 60 * 1000;
const istDayStart = (now = Date.now()) =>
  new Date(Math.floor((now + IST_MS) / 86400000) * 86400000 - IST_MS);

export const takeTeaserSlot = async (cardId) => {
  const now = new Date();
  const [res] = await db.execute(
    `UPDATE digital_cards SET teaser_sent_at = ?
      WHERE id = ? AND (teaser_sent_at IS NULL OR teaser_sent_at < ?)`,
    [now, cardId, istDayStart(now.getTime())]
  );
  return res.affectedRows > 0;
};

/* ======================================================
   EXPORT
====================================================== */
export const exportRows = (filters) => queryPoolCards(filters, EXPORT_LIMIT);

/* The card as it would print and the company it would show, for emails. */
export const getCardForMail = getCardRow;
