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
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  listCards, createCard, updateCard, setCardActive, setCardLocked,
  getCardUsage, listLeads,
} from "../services/digitalCard.service.js";
import { db } from "../config/db.js";

const router = express.Router();

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

/* ── List, with usage so the UI can show "3 of 5 used" ── */
router.get("/", authenticate, handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const [cards, usage] = await Promise.all([listCards(companyId), getCardUsage(companyId, plan)]);
  res.json({ success: true, cards, usage, plan });
}));

router.post("/", authenticate, handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const created = await createCard(companyId, plan, req.body);
  res.status(201).json({ success: true, ...created });
}));

router.patch("/:id", authenticate, handle(async (req, res) => {
  const ok = await updateCard(getCompanyId(req.user), req.params.id, req.body);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true });
}));

/* Deactivate rather than delete. A printed QR must keep resolving — to
   "details not available", never to a dead link. */
router.patch("/:id/active", authenticate, handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const ok = await setCardActive(companyId, req.params.id, !!req.body.active, plan);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true });
}));

/* Lock / release, for when a downgrade leaves more cards than the plan
   allows and the admin picks which survive. */
router.patch("/:id/locked", authenticate, handle(async (req, res) => {
  const companyId = getCompanyId(req.user);
  const plan = await planFor(companyId);
  const ok = await setCardLocked(companyId, req.params.id, !!req.body.locked, plan);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true });
}));

/* ── Card Leads ── */
router.get("/leads/all", authenticate, handle(async (req, res) => {
  const leads = await listLeads(getCompanyId(req.user));
  res.json({ success: true, leads });
}));

export default router;
