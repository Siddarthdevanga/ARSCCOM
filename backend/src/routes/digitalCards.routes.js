/**
 * routes/digitalCards.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin side of digital visiting cards. Everything here is behind
 * `authenticate` and scoped to the caller's own company — a card id alone is
 * never enough to reach a card, because ids are sequential and guessable.
 *
 * The public side lives in digitalCards.public.routes.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import express from "express";
import crypto from "crypto";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  listCards, getCard, createCard, updateCard, setCardActive, setCardLocked,
  getCardUsage, listLeads, companyLapsed, photoPrefix, isUploadedPhoto,
} from "../services/digitalCard.service.js";
import {
  generateBlankCards, getBlanksForPrint, deleteCard, resetCompanyCard, trimBlankCards, blankLabel,
} from "../services/companyCardBlanks.service.js";
import { cardUrl } from "../services/cardPool.service.js";
import { renderCompanyBlanksPdf } from "../utils/cardArt.node.js";
import { uploadToS3, getPresignedUrl, getS3Object } from "../services/s3.service.js";
import { db } from "../config/db.js";

const router = express.Router();

/* Every route here needs a signed-in user whose subscription is live.
   Same 403 shape the other modules return, so the frontend shows the
   standard "locked — renew" screen. */
router.use(authenticate, async (req, res, next) => {
  try {
    if (await companyLapsed(req.user?.companyId)) {
      return res.status(403).json({
        success: false, status: "expired",
        message: "Your subscription has expired. Renew your plan to use Digital Cards.",
      });
    }
    next();
  } catch (err) {
    console.error("[digital-cards] lapse check", err?.message);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

/* Photo upload: 5 MB, and only formats every browser can draw. SVG is
   refused outright — it can carry script. The declared MIME type is not
   trusted; the first bytes are checked against the real signatures. */
const PHOTO_TYPES = {
  "image/jpeg": { ext: "jpg",  sig: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png":  { ext: "png",  sig: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/webp": { ext: "webp", sig: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" },
};
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    PHOTO_TYPES[file.mimetype] ? cb(null, true) : cb(Object.assign(new Error("Use a JPG, PNG or WebP image"), { code: 400 })),
});

const getCompanyId = (user) => user?.companyId;

/* The plan is read per request rather than trusted from the token: a
   downgrade must take effect immediately, not whenever the user next
   signs in. */
const planFor = async (companyId) => {
  const [[row]] = await db.execute("SELECT plan FROM companies WHERE id = ? LIMIT 1", [companyId]);
  return (row?.plan || "trial").toLowerCase();
};

/* The company's name and logo, for previewing its empty QR cards. */
const companyFor = async (companyId) => {
  const [[row]] = await db.execute("SELECT name, logo_url FROM companies WHERE id = ? LIMIT 1", [companyId]);
  return { name: row?.name || "", logo_url: row?.logo_url ? `/api/logo/${companyId}` : null };
};

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const code = err?.code >= 400 && err?.code < 600 ? err.code : 500;
    if (code === 500) console.error("[digital-cards]", err?.message);
    res.status(code).json({
      success: false,
      message: code === 500 ? "Something went wrong" : err.message,
    });
  }
};

/* A short-lived link so the admin screens can show an uploaded photo.
   A legacy pasted URL is shown as it is. */
const withPreview = async (card) => ({
  ...card,
  // Numbered QR cards the company generated; `blank` while nobody has
  // filled one in.
  number: card.source === "company" && card.serial_no ? blankLabel(card.serial_no) : null,
  blank: card.source === "company" && !!card.serial_no && !card.claimed_at,
  card_url: cardUrl(card.slug),
  photo_preview: !card.photo_url ? null
    : isUploadedPhoto(card.photo_url) ? await getPresignedUrl(card.photo_url, 3600).catch(() => null)
    : /^https:\/\//i.test(card.photo_url) ? card.photo_url
    : null,
});

/* ── List, with usage so the UI can show "3 of 5 used" ── */
router.get("/", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  // After a downgrade, empty QR cards give up their slots first.
  await trimBlankCards(companyId, plan);
  const [cards, usage, company] = await Promise.all([
    listCards(companyId), getCardUsage(companyId, plan), companyFor(companyId),
  ]);
  res.json({ success: true, cards: await Promise.all(cards.map(withPreview)), usage, plan, company });
}));

/* ── Photo upload. Returns the key to save on the card, plus a preview. ── */
router.post("/photo", (req, res, next) => {
  photoUpload.single("photo")(req, res, (err) => {
    if (!err) return next();
    const tooBig = err?.code === "LIMIT_FILE_SIZE";
    res.status(400).json({ success: false, message: tooBig ? "Photo must be 5 MB or smaller" : err.message || "Upload failed" });
  });
}, handle(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, message: "Choose a photo to upload" });
  const type = PHOTO_TYPES[file.mimetype];
  if (!type.sig(file.buffer)) {
    return res.status(400).json({ success: false, message: "That file is not a valid image" });
  }
  const key = `${photoPrefix(getCompanyId(req.user))}${crypto.randomBytes(12).toString("hex")}.${type.ext}`;
  await uploadToS3(file, key);
  res.status(201).json({ success: true, key, preview: await getPresignedUrl(key, 3600) });
}));

/* ── Photo bytes, for drawing onto the printed card ──
   Served from our own API so the editor can fetch it with the session and
   draw it as a same-origin blob: a presigned S3 URL would taint the canvas
   and the PNG export would fail. Only this company's own uploads, or the
   photo and logo of a claimed QR card that has moved into this company. */
router.get("/photo", handle(async (req, res) => {
  const key = String(req.query.key || "");
  const companyId = getCompanyId(req.user);
  let allowed = key.startsWith(photoPrefix(companyId)) && !key.includes("..");
  if (!allowed && isUploadedPhoto(key)) {
    const [[hit]] = await db.execute(
      "SELECT id FROM digital_cards WHERE company_id = ? AND (photo_url = ? OR own_logo_url = ?) LIMIT 1",
      [companyId, key, key]
    );
    allowed = !!hit;
  }
  if (!allowed) {
    return res.status(404).json({ success: false, message: "Photo not found" });
  }
  let obj;
  try { obj = await getS3Object(key); } catch {
    return res.status(404).json({ success: false, message: "Photo not found" });
  }
  res.setHeader("Content-Type", obj.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(obj.buffer);
}));

/* ── Card Leads ── (declared before /:id so "leads" is never read as an id) */
router.get("/leads/all", handle(async (req, res) => {
  const leads = await listLeads(getCompanyId(req.user));
  res.json({ success: true, leads });
}));

/* ── Empty QR cards to hand out ── (declared before /:id, as above) */
router.post("/blank", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const made = await generateBlankCards(companyId, plan, req.body);
  res.status(201).json({ success: true, ...made });
}));

/* The print sheet: every empty card, or `?ids=1,2,3`. */
router.get("/blank/print", handle(async (req, res) => {
  const ids = req.query.ids ? String(req.query.ids).split(",") : null;
  const { company, cards } = await getBlanksForPrint(getCompanyId(req.user), ids);
  if (!cards.length) {
    return res.status(404).json({ success: false, message: "There are no empty cards to print" });
  }
  const pdf = await renderCompanyBlanksPdf({ company, cards, cardUrl });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="qr-cards.pdf"');
  res.setHeader("Cache-Control", "no-store");
  res.send(pdf);
}));

/* ── One card, for the editor screen ── */
router.get("/:id", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const card = await getCard(companyId, req.params.id);
  if (!card) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true, card: await withPreview(card) });
}));

router.post("/", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const created = await createCard(companyId, plan, req.body);
  res.status(201).json({ success: true, ...created });
}));

router.patch("/:id", handle(async (req, res) => {
  const ok = await updateCard(getCompanyId(req.user), req.params.id, req.body);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true });
}));

/* Deactivate: the printed QR keeps resolving, to "details not available". */
router.patch("/:id/active", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const ok = await setCardActive(companyId, req.params.id, !!req.body.active, plan);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true });
}));

/* Delete any card, freeing its slot. Its address, scans and leads go; the
   filled-in details are kept on record (companyCardBlanks.service.js). */
router.delete("/:id", handle(async (req, res) => {
  await deleteCard(getCompanyId(req.user), req.params.id, req.user?.userId ?? null);
  res.json({ success: true });
}));

/* A filled QR card back to empty, for the next employee. The old details,
   leads and scans stay in the company on an inactive copy. */
router.post("/:id/reset", handle(async (req, res) => {
  await resetCompanyCard(getCompanyId(req.user), req.params.id);
  res.json({ success: true });
}));

/* Lock / release, for when a downgrade leaves more cards than the plan
   allows and the admin picks which survive. */
router.patch("/:id/locked", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const ok = await setCardLocked(companyId, req.params.id, !!req.body.locked, plan);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true });
}));

export default router;
