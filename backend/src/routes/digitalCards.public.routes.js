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
import {
  getPublicCard, recordScan, addLead, markLeadNotified, buildVCard,
} from "../services/digitalCard.service.js";
import { sendCardLeadEmail } from "../utils/cardLeadMail.service.js";

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

  // Counted before the unavailable check returns, but recordScan itself
  // ignores inactive and locked cards — so an unavailable card is never
  // counted as a scan.
  recordScan(req.params.slug, clientIp(req), req.headers["user-agent"]).catch(() => {});

  res.json({ success: true, card });
}));

/* ── Save Contact ──
   Served as a file download rather than JSON: on both iOS and Android,
   opening a text/vcard response is what triggers the "Add to Contacts"
   sheet. */
router.get("/:slug/vcard", handle(async (req, res) => {
  const card = await getPublicCard(req.params.slug);
  if (!card || card.unavailable) {
    return res.status(404).json({ success: false, message: "Card not found" });
  }

  const vcf = buildVCard(card);
  const filename = (card.name || "contact").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

  res.setHeader("Content-Type", "text/vcard; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename || "contact"}.vcf"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(vcf);
}));

/* ── Share details back ── */
router.post("/:slug/lead", handle(async (req, res) => {
  const { id, cardOwner } = await addLead(req.params.slug, req.body);

  // The lead is already saved; emailing is best-effort. Failing to notify
  // must never lose the lead or show the sender an error.
  if (cardOwner?.email) {
    sendCardLeadEmail(cardOwner, req.body)
      .then(() => markLeadNotified(id))
      .catch((e) => console.error("[card-lead-mail]", e?.message));
  }

  res.status(201).json({ success: true, message: "Thanks — your details have been shared." });
}));

export default router;
