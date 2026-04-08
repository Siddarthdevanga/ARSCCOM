import express from "express";
import { db } from "../config/db.js";
import { getS3Object } from "../services/s3.service.js";

const router = express.Router();

/* ======================================================
   GET /api/logo/:companyId  — PUBLIC, no auth required
   ──────────────────────────────────────────────────────
   Fetches the company logo from private S3 and serves it.
   URL is permanent (no expiry) — safe to embed in emails,
   footers, and anywhere that needs a stable image URL.

   Cache: 24 hours (logos rarely change).
====================================================== */
router.get("/:companyId", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    if (!companyId || isNaN(companyId)) {
      return res.status(400).send("Invalid company ID");
    }

    const [[company]] = await db.execute(
      "SELECT logo_url FROM companies WHERE id = ?",
      [companyId]
    );

    if (!company?.logo_url) {
      return res.status(404).send("No logo found");
    }

    const { buffer, contentType } = await getS3Object(company.logo_url);

    res.setHeader("Content-Type",  contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h browser cache
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error("[LOGO_PROXY] Error:", err.message);
    if (!res.headersSent) res.status(404).send("Logo not available");
  }
});

export default router;
