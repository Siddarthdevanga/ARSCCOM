/**
 * routes/superadminQrCards.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Superadmin "QR Cards": printing batches of blank cards and looking after
 * the ones people have claimed. Mounted under /api/superadmin/qr-cards,
 * after requireFullSuperAdmin; the read-only sub-role never reaches it.
 *
 * Lead details are not exposed here, only counts. They belong to whoever
 * claimed the card and are theirs when they sign up.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import {
  createBatch, listBatches, overallStats, getBatchForPrint, listPoolCards, getPoolCard,
  updatePoolCard, setPoolCardActive, resetPoolCard, convertCard, exportRows, getCardForMail,
  cardUrl, IMAGE_TYPES, MAX_IMAGE_BYTES,
} from "../services/cardPool.service.js";
import { renderBatchPdf } from "../utils/cardArt.node.js";
import { sendPoolWelcomeEmail } from "../utils/cardPoolMail.service.js";
import { db } from "../config/db.js";

const router = express.Router();

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const code = err?.code >= 400 && err?.code < 600 ? err.code : 500;
    if (code === 500) console.error("[superadmin/qr-cards]", err?.message);
    if (res.headersSent) return res.end();
    res.status(code).json({ success: false, message: code === 500 ? "Something went wrong" : err.message });
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 2, fields: 40 },
  fileFilter: (req, file, cb) =>
    IMAGE_TYPES[file.mimetype] ? cb(null, true)
      : cb(Object.assign(new Error("Use a JPG, PNG or WebP image"), { code: 400 })),
});
const images = (req, res, next) =>
  upload.fields([{ name: "photo", maxCount: 1 }, { name: "logo", maxCount: 1 }])(req, res, (err) => {
    if (!err) return next();
    const tooBig = err?.code === "LIMIT_FILE_SIZE";
    res.status(400).json({ success: false, message: tooBig ? "Images must be 2 MB or smaller" : err.message || "Upload failed" });
  });

const idOf = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error("Card not found"), { code: 404 });
  return id;
};

/* ── Stats and batches ── */
router.get("/stats", handle(async (req, res) => {
  const [overall, batches] = await Promise.all([overallStats(), listBatches()]);
  res.json({ success: true, overall, batches });
}));

router.post("/batches", handle(async (req, res) => {
  const { id } = await createBatch(req.body, req.user?.userId);
  res.status(201).json({ success: true, id });
}));

/* The A4 sheet: header on each page, one card per row, front | back. */
router.get("/batches/:id/print", handle(async (req, res) => {
  const found = await getBatchForPrint(idOf(req));
  if (!found) return res.status(404).json({ success: false, message: "Batch not found" });
  const pdf = await renderBatchPdf({
    header: found.batch.header, batchName: found.batch.name, cards: found.cards, cardUrl,
  });
  const name = found.batch.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "batch";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="qr-cards-${name}-B${found.batch.id}.pdf"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(pdf);
}));

/* ── Export (before /:id so "export" is not read as an id) ── */
router.get("/export", handle(async (req, res) => {
  const rows = await exportRows();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("QR Cards");
  ws.columns = [
    { header: "Serial", key: "serial", width: 10 },
    { header: "Code", key: "slug", width: 14 },
    { header: "Status", key: "status", width: 11 },
    { header: "Batch", key: "batch_name", width: 24 },
    { header: "Name", key: "name", width: 24 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Company", key: "company_name", width: 24 },
    { header: "Title", key: "job_title", width: 20 },
    { header: "Claimed", key: "claimed_at", width: 18 },
    { header: "Views", key: "views", width: 8 },
    { header: "Leads", key: "leads", width: 8 },
    { header: "Converted to", key: "converted_company", width: 24 },
    { header: "Converted", key: "converted_at", width: 18 },
    { header: "Card link", key: "card_url", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  ["claimed_at", "converted_at"].forEach((k) => { ws.getColumn(k).numFmt = "dd-mmm-yyyy hh:mm"; });

  const fn = `qr-cards-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fn}"`);
  await wb.xlsx.write(res);
  res.end();
}));

/* ── Cards ── */
router.get("/", handle(async (req, res) => {
  const cards = await listPoolCards({ status: req.query.status, batchId: req.query.batch, q: req.query.q });
  res.json({ success: true, cards });
}));

router.get("/:id", handle(async (req, res) => {
  const card = await getPoolCard(idOf(req));
  if (!card) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true, card });
}));

router.patch("/:id", images, handle(async (req, res) => {
  await updatePoolCard(idOf(req), req.body, { photo: req.files?.photo?.[0], logo: req.files?.logo?.[0] });
  res.json({ success: true });
}));

router.patch("/:id/active", handle(async (req, res) => {
  const ok = await setPoolCardActive(idOf(req), !!req.body?.active);
  if (!ok) return res.status(404).json({ success: false, message: "Card not found" });
  res.json({ success: true });
}));

router.post("/:id/reset", handle(async (req, res) => {
  await resetPoolCard(idOf(req));
  res.json({ success: true });
}));

router.post("/:id/resend-welcome", handle(async (req, res) => {
  const card = await getCardForMail(idOf(req));
  if (!card || card.source !== "pool") return res.status(404).json({ success: false, message: "Card not found" });
  if (!card.claimed_at || !card.email) {
    return res.status(400).json({ success: false, message: "This card has not been claimed yet" });
  }
  await sendPoolWelcomeEmail(card);
  res.json({ success: true, message: `Welcome email sent to ${card.email}` });
}));

/* Manual link, for when the owner signed up with a different email and
   phone than they claimed with. Takes a company id or a user's email. */
router.post("/:id/link-company", handle(async (req, res) => {
  const ref = String(req.body?.company ?? "").trim();
  if (!ref) return res.status(400).json({ success: false, message: "Enter a company ID or a user's email" });
  let companyId = /^\d+$/.test(ref) ? Number(ref) : null;
  if (!companyId) {
    const [[u]] = await db.execute("SELECT company_id FROM users WHERE email = ? AND company_id IS NOT NULL LIMIT 1", [ref]);
    companyId = u?.company_id || null;
  }
  if (!companyId) return res.status(404).json({ success: false, message: "No company found for that ID or email" });
  const r = await convertCard(idOf(req), companyId);
  res.json({
    success: true,
    message: r.locked ? "Linked. The company's plan is full, so the card arrived locked." : "Linked to the company.",
  });
}));

export default router;
