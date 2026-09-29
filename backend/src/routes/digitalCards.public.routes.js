/**
 * routes/digitalCards.public.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The public face of a digital visiting card. No authentication: these URLs
 * are printed on physical cards and opened by strangers who scan a QR.
 *
 * Because they are public and unauthenticated, everything here is read-only
 * except the lead form, which is rate limited at the app level alongside the
 * other public write endpoints.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import express from "express";
import multer from "multer";
import {
  getPublicCard, recordScan, addLead, markLeadNotified, buildVCard, getPublicPhotoKey, getPublicLogoKey,
} from "../services/digitalCard.service.js";
import {
  claimCard, IMAGE_TYPES, MAX_IMAGE_BYTES, FREE_FULL_LEADS, leadCount, takeTeaserSlot,
} from "../services/cardPool.service.js";
import { getS3Object } from "../services/s3.service.js";
import { sendCardLeadEmail } from "../utils/cardLeadMail.service.js";
import { sendPoolWelcomeEmail, sendPoolTeaserEmail } from "../utils/cardPoolMail.service.js";

const router = express.Router();

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const code = err?.code >= 400 && err?.code < 600 ? err.code : 500;
    if (code === 500) console.error("[digital-cards/public]", err?.message);
    res.status(code).json({
      success: false,
      message: code === 500 ? "Something went wrong" : err.message,
    });
  }
};

/* app.js sets `trust proxy`, so req.ip is already the real client address.
   Reading X-Forwarded-For directly would take its first entry, which the
   client writes — a fresh fake value per request would inflate the count.
   Only ever hashed, never stored. */
const clientIp = (req) => req.ip || "";

/* ── The card ── */
router.get("/:slug", handle(async (req, res) => {
  const card = await getPublicCard(req.params.slug);
  if (!card) return res.status(404).json({ success: false, message: "Card not found" });

  // An unavailable card (off, locked, or the plan has lapsed) is never
  // counted as a scan.
  if (!card.unavailable) {
    recordScan(req.params.slug, clientIp(req), req.headers["user-agent"]).catch(() => {});
  }

  res.json({ success: true, card });
}));

/* ── Save Contact ──
   Served as a file download rather than JSON: on both iOS and Android,
   opening a text/vcard response is what triggers the "Add to Contacts"
   sheet. */
router.get("/:slug/vcard", handle(async (req, res) => {
  const card = await getPublicCard(req.params.slug);
  if (!card || card.unavailable || card.unclaimed) {
    return res.status(404).json({ success: false, message: "Card not found" });
  }

  const vcf = buildVCard(card);
  const filename = (card.name || "contact").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

  res.setHeader("Content-Type", "text/vcard; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename || "contact"}.vcf"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(vcf);
}));

/* ── Photo ──
   Proxied from the private bucket, and only while the card is live: a
   deactivated or lapsed card must not keep serving the person's face. */
const imageProxy = (getKey) => async (req, res) => {
  try {
    const key = await getKey(req.params.slug);
    if (!key) return res.status(404).end();
    const { buffer, contentType, etag } = await getS3Object(key);
    res.setHeader("Cache-Control", "public, no-cache, must-revalidate");
    if (etag) res.setHeader("ETag", etag);
    if (etag && req.headers["if-none-match"] === etag) return res.status(304).end();
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(buffer);
  } catch (err) {
    console.error("[digital-cards/image]", err?.message);
    if (!res.headersSent) res.status(404).end();
  }
};
router.get("/:slug/photo", imageProxy(getPublicPhotoKey));
// A claimed card has no company, so it carries its own logo.
router.get("/:slug/logo", imageProxy(getPublicLogoKey));

/* ── Share details back ── */
router.post("/:slug/lead", handle(async (req, res) => {
  const { id, cardOwner, freeCard } = await addLead(req.params.slug, req.body);

  // The lead is already saved; emailing is best-effort. Failing to notify
  // must never lose the lead or show the sender an error.
  if (cardOwner?.email) {
    notifyOwner(id, cardOwner, freeCard, req.body)
      .catch((e) => console.error("[card-lead-mail]", e?.message));
  }

  res.status(201).json({ success: true, message: "Thanks — your details have been shared." });
}));

/* A company card's owner hears about every lead. A free card's owner hears
   about the first few in full; after that, a teaser at most once a day.
   The leads are all kept and are theirs when they sign up. */
const notifyOwner = async (leadId, cardOwner, freeCard, lead) => {
  if (freeCard && (await leadCount(freeCard.id)) > FREE_FULL_LEADS) {
    if (await takeTeaserSlot(freeCard.id)) {
      await sendPoolTeaserEmail(freeCard, await leadCount(freeCard.id));
    }
    return;
  }
  await sendCardLeadEmail(cardOwner, lead);
  await markLeadNotified(leadId);
};

/* ── Claim a blank card ──
   One multipart request carries the details and, optionally, a photo and
   a logo; nothing is stored unless the claim itself succeeds. */
const claimUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 2, fields: 40 },
  fileFilter: (req, file, cb) =>
    IMAGE_TYPES[file.mimetype] ? cb(null, true)
      : cb(Object.assign(new Error("Use a JPG, PNG or WebP image"), { code: 400 })),
});

router.post("/:slug/claim", (req, res, next) => {
  claimUpload.fields([{ name: "photo", maxCount: 1 }, { name: "logo", maxCount: 1 }])(req, res, (err) => {
    if (!err) return next();
    const tooBig = err?.code === "LIMIT_FILE_SIZE";
    res.status(400).json({ success: false, message: tooBig ? "Images must be 2 MB or smaller" : err.message || "Upload failed" });
  });
}, handle(async (req, res) => {
  const card = await claimCard(req.params.slug, req.body, {
    photo: req.files?.photo?.[0],
    logo: req.files?.logo?.[0],
  });

  sendPoolWelcomeEmail(card).catch((e) => console.error("[card-pool-welcome]", e?.message));
  res.status(201).json({ success: true, message: "Your card is ready." });
}));

export default router;
