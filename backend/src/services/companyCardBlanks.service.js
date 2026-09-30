/**
 * services/companyCardBlanks.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Empty QR cards a company generates for its own employees. The admin picks
 * how many (up to the plan's free slots) and the colours, prints the sheet
 * and hands the cards out; whoever scans one first fills in their details
 * and the card goes live inside the company.
 *
 * They are ordinary company cards (source = 'company') with a number:
 *
 *   empty    serial_no set, claimed_at NULL
 *   filled   serial_no set, claimed_at set
 *
 * A card the admin creates in the editor has no number and is never empty.
 * An empty card holds a plan slot from the moment it is generated. The
 * company's name and logo are always the account's own; only the admin
 * edits a card once it is filled.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import crypto from "crypto";
import { db } from "../config/db.js";
import {
  clean, bad, uniqueSlug, getCardUsage, isLapsed, photoPrefix, CARD_FIELDS,
} from "./digitalCard.service.js";
import { cleanDetails, checkImage, dropImage, phone10, IMAGE_TYPES } from "./cardPool.service.js";
import { uploadToS3, getS3Object } from "./s3.service.js";

export const MAX_GENERATE = 100;

const notFound = () => Object.assign(new Error("Card not found"), { code: 404 });

/* "#7": the number printed under the QR, so the admin knows which card
   went to whom. */
export const blankLabel = (n) => (n ? `#${n}` : "");

/* ======================================================
   GENERATE
====================================================== */
const STYLE_FIELDS = ["theme", "bg_color", "text_color", "accent_color"];

export const generateBlankCards = async (companyId, plan, body = {}) => {
  const q = Number(body.quantity);
  if (!Number.isInteger(q) || q < 1 || q > MAX_GENERATE) throw bad("Choose how many cards to generate");
  const style = clean(Object.fromEntries(STYLE_FIELDS.map((f) => [f, body[f] ?? null])));
  if (!style.theme) style.theme = "ink";

  // Picked before the lock: uniqueSlug reads the table, and the UNIQUE key
  // is the final guard anyway.
  const slugs = new Set();
  while (slugs.size < q) slugs.add(await uniqueSlug());

  // One generation per company at a time, so two clicks cannot both see
  // the same free slots or hand out the same number twice.
  const conn = await db.getConnection();
  const lockName = `card_blank_gen_${companyId}`;
  let locked = false;
  try {
    const [[lock]] = await conn.query("SELECT GET_LOCK(?, 10) AS ok", [lockName]);
    locked = lock?.ok === 1;
    if (!locked) throw Object.assign(new Error("Busy — please try again in a moment"), { code: 503 });

    const { remaining, limit } = await getCardUsage(companyId, plan);
    if (q > remaining) {
      throw Object.assign(
        new Error(remaining
          ? `You have ${remaining} free card slot${remaining === 1 ? "" : "s"} left on your plan.`
          : `Your plan allows ${limit} active card${limit === 1 ? "" : "s"} and all are in use.`),
        { code: 403 }
      );
    }

    // Numbers run on across the company and are never reused, so a
    // deleted #3 cannot be confused with a new one: deleted numbered cards
    // are remembered in digital_card_archive (see deleteCard, trimBlankCards).
    const [[live]] = await conn.execute(
      "SELECT COALESCE(MAX(serial_no), 0) AS n FROM digital_cards WHERE company_id = ? AND source = 'company'",
      [companyId]
    );
    const [[gone]] = await conn.execute(
      "SELECT COALESCE(MAX(serial_no), 0) AS n FROM digital_card_archive WHERE company_id = ? AND source = 'company'",
      [companyId]
    ).catch((err) => { if (err?.code === "ER_NO_SUCH_TABLE") return [[{ n: 0 }]]; throw err; });
    const top = Math.max(Number(live.n), Number(gone.n));
    const rows = [...slugs].map((slug, i) => [
      companyId, slug, "company", Number(top) + i + 1,
      style.theme, style.bg_color || null, style.text_color || null, style.accent_color || null,
    ]);
    await conn.query(
      `INSERT INTO digital_cards (company_id, slug, source, serial_no, theme, bg_color, text_color, accent_color)
       VALUES ?`,
      [rows]
    );
    const [ids] = await conn.query(
      "SELECT id FROM digital_cards WHERE company_id = ? AND slug IN (?) ORDER BY serial_no",
      [companyId, [...slugs]]
    );
    return { ids: ids.map((r) => r.id), from: Number(top) + 1, to: Number(top) + q };
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    conn.release();
  }
};

/* ======================================================
   PRINT
   Empty cards only: a filled card is the employee's and prints from the
   editor with their details. `ids` narrows it to a set, e.g. the batch
   just generated.
====================================================== */
export const getBlanksForPrint = async (companyId, ids = null) => {
  const pick = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : null;
  const [[company]] = await db.execute("SELECT name, logo_url FROM companies WHERE id = ? LIMIT 1", [companyId]);
  const [cards] = await db.query(
    `SELECT id, slug, serial_no, theme, bg_color, text_color, accent_color
       FROM digital_cards
      WHERE company_id = ? AND source = 'company' AND serial_no IS NOT NULL
        AND claimed_at IS NULL AND is_active = 1 AND is_locked = 0
        ${pick?.length ? "AND id IN (?)" : ""}
      ORDER BY serial_no`,
    pick?.length ? [companyId, pick] : [companyId]
  );
  let logo = null;
  if (company?.logo_url) {
    try { logo = (await getS3Object(company.logo_url)).buffer; } catch { /* name only */ }
  }
  return {
    company: { name: company?.name || "", logo },
    cards: cards.map((c) => ({ ...c, serial: blankLabel(c.serial_no) })),
  };
};

/* ======================================================
   DELETE (any card)
   The card row goes, and with it its address (the printed QR stops
   working) and its scans (ON DELETE CASCADE); the slot is freed. Its
   contacts (card_leads) stay with the company, marked with the owner's
   name as it was, and are shown as from a deleted card. The details that
   were filled in are kept in digital_card_archive, which nothing reads
   back. An empty numbered card leaves only its number there, so the
   number is never issued again. Photos and
   logos stay in S3: they are part of the details kept.
====================================================== */
const ARCHIVE_FIELDS = [...CARD_FIELDS, "photo_on_print", "own_logo_url"];

export const deleteCard = async (companyId, id, userId = null) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[card]] = await conn.execute(
      "SELECT * FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1 FOR UPDATE",
      [id, companyId]
    );
    if (!card) throw notFound();

    const filled = !!(card.name || card.phone || card.email);
    if (filled || (card.source === "company" && card.serial_no)) {
      const details = Object.fromEntries(
        ARCHIVE_FIELDS.filter((f) => card[f] != null && card[f] !== "").map((f) => [f, card[f]])
      );
      await conn.execute(
        `INSERT INTO digital_card_archive
           (company_id, card_id, source, serial_no, name, phone, email, details, card_created_at, claimed_at, deleted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, card.id, card.source || null, card.serial_no ?? null, card.name || null, card.phone || null,
         card.email || null, JSON.stringify(details), card.created_at || null, card.claimed_at || null, userId]
      ).catch((err) => {
        // An empty card only leaves its number: without the table, it is
        // still deleted. A filled card's details must be kept, so it is not.
        if (filled || err?.code !== "ER_NO_SUCH_TABLE") throw err;
      });
    }
    // An empty card cannot have contacts.
    if (filled) {
      await conn.execute(
        "UPDATE card_leads SET card_id = NULL, card_owner_name = ?, company_id = ? WHERE card_id = ?",
        [card.name || (card.serial_no ? blankLabel(card.serial_no) : null), companyId, card.id]
      );
    }
    await conn.execute("DELETE FROM digital_cards WHERE id = ? AND company_id = ?", [card.id, companyId]);
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err?.code === "ER_NO_SUCH_TABLE" || err?.code === "ER_BAD_FIELD_ERROR") {
      console.error("[digital-cards] run migrations/add-digital-card-archive.sql and keep-card-leads-on-delete.sql:", err.message);
      throw Object.assign(new Error("Deleting cards is not available yet. Please try again later."), { code: 503 });
    }
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   RESET (filled → empty)
   For a card whose employee has left: the printed QR is handed to someone
   new. The old details, leads and scans are kept, on an inactive copy
   under a new address, so the company still has them; the original row,
   which the printed QR points at, goes back to empty.
====================================================== */
const KEEP = [...CARD_FIELDS, "photo_on_print", "own_logo_url", "claimed_at", "claim_phone10"];

export const resetCompanyCard = async (companyId, id) => {
  const archiveSlug = await uniqueSlug();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[card]] = await conn.execute(
      "SELECT * FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1 FOR UPDATE",
      [id, companyId]
    );
    if (!card) throw notFound();
    if (card.source !== "company" || !card.serial_no) throw bad("Only a numbered QR card can be reset");
    if (!card.claimed_at) throw bad("This card is already empty");

    const [ins] = await conn.execute(
      `INSERT INTO digital_cards (company_id, source, slug, is_active, is_locked, ${KEEP.join(", ")})
       SELECT company_id, 'company', ?, 0, 0, ${KEEP.join(", ")} FROM digital_cards WHERE id = ?`,
      [archiveSlug, card.id]
    );
    await conn.execute("UPDATE card_leads SET card_id = ? WHERE card_id = ?", [ins.insertId, card.id]);
    await conn.execute("UPDATE card_scans SET card_id = ? WHERE card_id = ?", [ins.insertId, card.id]);

    // The colours the admin chose stay with the printed card.
    const blank = Object.fromEntries(
      CARD_FIELDS.filter((f) => !STYLE_FIELDS.includes(f)).map((f) => [f, null])
    );
    blank.custom1_type = "text";
    blank.custom2_type = "text";
    const sets = { ...blank, own_logo_url: null, photo_on_print: 0, claimed_at: null, claim_phone10: null };
    await conn.execute(
      `UPDATE digital_cards SET ${Object.keys(sets).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...Object.values(sets), card.id]
    );
    await conn.commit();
    // The photo now belongs to the copy, so nothing is deleted from S3.
    return { archivedId: ins.insertId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   DOWNGRADE
   A smaller plan than the cards in use: empty cards go first, newest
   number first, since they are the ones nobody depends on yet. Filled
   cards are left for the admin to lock, as before.
====================================================== */
export const trimBlankCards = async (companyId, plan) => {
  const { used, limit } = await getCardUsage(companyId, plan);
  const over = used - limit;
  if (over <= 0) return 0;
  const [cards] = await db.execute(
    `SELECT id, serial_no, created_at FROM digital_cards
      WHERE company_id = ? AND source = 'company' AND serial_no IS NOT NULL
        AND claimed_at IS NULL AND is_active = 1 AND is_locked = 0
      ORDER BY serial_no DESC
      LIMIT ${Number(over)}`,
    [companyId]
  );
  if (!cards.length) return 0;
  // Runs inside GET /api/cards: without the archive table the numbers
  // simply are not remembered, and the page still loads.
  await db.query(
    `INSERT INTO digital_card_archive (company_id, card_id, source, serial_no, details, card_created_at)
     VALUES ?`,
    [cards.map((c) => [companyId, c.id, "company", c.serial_no, "{}", c.created_at || null])]
  ).catch((err) => { if (err?.code !== "ER_NO_SUCH_TABLE") throw err; });
  const [res] = await db.query(
    "DELETE FROM digital_cards WHERE company_id = ? AND id IN (?) AND claimed_at IS NULL",
    [companyId, cards.map((c) => c.id)]
  );
  return res.affectedRows;
};

/* ======================================================
   FILL IN (public, the employee who scans it)
   Returns null when the slug is not a company's empty-card QR, so the
   caller can try the Haivisitor pool instead.
====================================================== */
const sameEmployee = async (conn, companyId, cardId, email, claimPhone) => {
  // A handful of rows per company (the plan caps them), so compared here
  // rather than normalising every stored phone number in SQL.
  const [rows] = await conn.execute(
    "SELECT email, phone, claim_phone10 FROM digital_cards WHERE company_id = ? AND is_active = 1 AND id <> ?",
    [companyId, cardId]
  );
  const mail = String(email || "").toLowerCase();
  const hit = rows.some((r) =>
    (mail && String(r.email || "").toLowerCase() === mail) ||
    (claimPhone && (r.claim_phone10 === claimPhone || phone10(r.phone) === claimPhone)));
  if (hit) {
    throw Object.assign(
      new Error("There is already a card in this company with this email or phone number."),
      { code: 409 }
    );
  }
};

/* The admin filling in an empty numbered card from the editor: the same
   one-card-per-person rule as when the employee fills it in. Called by
   PATCH /api/cards/:id before updateCard. */
export const checkAdminFill = async (companyId, id, body = {}) => {
  const [[card]] = await db.execute(
    "SELECT id, source, serial_no, claimed_at, email, phone FROM digital_cards WHERE id = ? AND company_id = ? LIMIT 1",
    [id, companyId]
  );
  if (!card || card.source !== "company" || !card.serial_no || card.claimed_at) return;
  const email = "email" in body ? body.email : card.email;
  const phone = "phone" in body ? body.phone : card.phone;
  await sameEmployee(db, companyId, card.id, email, phone10(phone));
};

export const claimCompanyCard = async (slug, body = {}, files = {}) => {
  const [[card]] = await db.execute(
    `SELECT c.id, c.company_id, c.source, c.serial_no, c.claimed_at, c.is_active, c.is_locked,
            co.subscription_status, co.grace_period_ends_at
       FROM digital_cards c JOIN companies co ON co.id = c.company_id
      WHERE c.slug = ? LIMIT 1`,
    [slug]
  );
  if (!card || card.source !== "company" || !card.serial_no) return null;
  if (!card.is_active || card.is_locked || isLapsed(card)) {
    throw Object.assign(new Error("This card is not active"), { code: 410 });
  }
  if (card.claimed_at) throw Object.assign(new Error("This card has already been filled in"), { code: 409 });

  if (![true, "true", "1", 1, "on"].includes(body.consent)) {
    throw bad("Please accept the terms to set up your card");
  }

  // The company's name, logo and colours are the company's; anything sent
  // for them is ignored.
  const input = { ...body };
  for (const f of ["company_name", ...STYLE_FIELDS]) delete input[f];
  const data = cleanDetails(input);
  for (const f of ["company_name", ...STYLE_FIELDS]) delete data[f];
  const claimPhone = phone10(data.phone);
  await sameEmployee(db, card.company_id, card.id, data.email, claimPhone);

  checkImage(files.photo, "photo");
  let photoKey = null;
  if (files.photo) {
    const type = IMAGE_TYPES[files.photo.mimetype];
    photoKey = `${photoPrefix(card.company_id)}${crypto.randomBytes(12).toString("hex")}.${type.ext}`;
    await uploadToS3(files.photo, photoKey);
  }

  const conn = await db.getConnection();
  const lockName = `card_blank_claim_${card.company_id}`;
  let locked = false;
  try {
    const [[lock]] = await conn.query("SELECT GET_LOCK(?, 10) AS ok", [lockName]);
    locked = lock?.ok === 1;
    if (!locked) throw Object.assign(new Error("Busy — please try again in a moment"), { code: 503 });

    await sameEmployee(conn, card.company_id, card.id, data.email, claimPhone);

    const sets = { ...data, photo_url: photoKey, claim_phone10: claimPhone, photo_on_print: photoKey ? 1 : 0 };
    const cols = Object.keys(sets);
    const [res] = await conn.execute(
      `UPDATE digital_cards SET ${cols.map((k) => `${k} = ?`).join(", ")}, claimed_at = NOW()
        WHERE id = ? AND claimed_at IS NULL AND is_active = 1 AND is_locked = 0`,
      [...Object.values(sets), card.id]
    );
    if (!res.affectedRows) throw Object.assign(new Error("This card has already been filled in"), { code: 409 });
  } catch (err) {
    dropImage(photoKey);
    throw err;
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    conn.release();
  }
  return getCardForCompanyMail(card.id);
};

/* The filled card with the company's name and logo key, for the welcome
   email. */
export const getCardForCompanyMail = async (id) => {
  const [[row]] = await db.execute(
    `SELECT c.*, co.name AS owner_company_name, co.logo_url AS company_logo_key
       FROM digital_cards c JOIN companies co ON co.id = c.company_id
      WHERE c.id = ? LIMIT 1`,
    [id]
  );
  if (!row) return null;
  return { ...row, company_name: row.company_name || row.owner_company_name };
};
