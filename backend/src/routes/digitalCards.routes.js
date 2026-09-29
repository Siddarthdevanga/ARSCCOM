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
  getCardUsage, listLeads, companyLapsed, photoPrefix,
} from "../services/digitalCard.service.js";
import { uploadToS3, getPresignedUrl } from "../services/s3.service.js";
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

/* A short-lived link so the admin screens can show an uploaded photo. */
const withPreview = async (card) => ({
  ...card,
  photo_preview: card.photo_url ? await getPresignedUrl(card.photo_url, 3600).catch(() => null) : null,
});

/* ── List, with usage so the UI can show "3 of 5 used" ── */
router.get("/", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const [cards, usage] = await Promise.all([listCards(companyId), getCardUsage(companyId, plan)]);
  res.json({ success: true, cards: await Promise.all(cards.map(withPreview)), usage, plan });
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

/* ── Card Leads ── (declared before /:id so "leads" is never read as an id) */
router.get("/leads/all", handle(async (req, res) => {
  const leads = await listLeads(getCompanyId(req.user));
  res.json({ success: true, leads });
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

/* Deactivate rather than delete. A printed QR must keep resolving — to
   "details not available", never to a dead link. */
router.patch("/:id/active", handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const ok = await setCardActive(companyId, req.params.id, !!req.body.active, plan);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
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
