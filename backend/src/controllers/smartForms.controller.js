import ExcelJS from "exceljs";
import * as service from "../services/smartForms.service.js";

const companyIdOf = (req) => req.user?.companyId;

/* ======================================================
   COMPANY-AUTHENTICATED
====================================================== */
export const listForms = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const forms = await service.listForms(companyId);
    return res.json({ success: true, forms });
  } catch (err) {
    console.error("SMART FORMS LIST ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load Smart Forms" });
  }
};

export const getForm = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const form = await service.getFormForEdit(companyId, req.params.id);
    return res.json({ success: true, form });
  } catch (err) {
    console.error("SMART FORMS GET ERROR:", err.message);
    return res.status(404).json({ success: false, message: err.message });
  }
};

export const createForm = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const form = await service.createForm(companyId, req.body);
    return res.status(201).json({ success: true, form });
  } catch (err) {
    console.error("SMART FORMS CREATE ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const updateForm = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    await service.updateForm(companyId, req.params.id, req.body);
    return res.json({ success: true, message: "Smart Form updated" });
  } catch (err) {
    console.error("SMART FORMS UPDATE ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const uploadFormLogo = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const result = await service.uploadFormLogo(companyId, req.params.id, req.file);
    return res.json({ success: true, message: "Logo updated", ...result });
  } catch (err) {
    console.error("SMART FORMS LOGO UPLOAD ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getFormLogo = async (req, res) => {
  try {
    const result = await service.getFormLogoBySlug(req.params.slug);
    if (!result) return res.status(404).send("No logo found");
    res.setHeader("Cache-Control", "public, no-cache, must-revalidate");
    if (result.etag) res.setHeader("ETag", result.etag);
    if (result.etag && req.headers["if-none-match"] === result.etag) return res.status(304).end();
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Length", result.buffer.length);
    res.send(result.buffer);
  } catch (err) {
    console.error("SMART FORMS LOGO SERVE ERROR:", err.message);
    if (!res.headersSent) res.status(404).send("Logo not available");
  }
};

export const retireForm = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    await service.retireForm(companyId, req.params.id);
    return res.json({ success: true, message: "Smart Form retired" });
  } catch (err) {
    console.error("SMART FORMS RETIRE ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getResponses = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { search, from, to } = req.query;
    const data = await service.getResponses(companyId, req.params.id, { search, from, to });
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("SMART FORMS RESPONSES ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const exportResponses = async (req, res) => {
  try {
    const companyId = companyIdOf(req);
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { search, from, to } = req.query;
    const { formName, responses } = await service.getResponses(companyId, req.params.id, { search, from, to });

    const allLabels = [];
    const seen = new Set();
    for (const r of responses) {
      for (const label of Object.keys(r.values)) {
        if (!seen.has(label)) { seen.add(label); allLabels.push(label); }
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Responses");
    ws.columns = [{ width: 22 }, ...allLabels.map(() => ({ width: 24 }))];

    const headerRow = ws.addRow(["Submitted On", ...allLabels]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6200d6" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    responses.forEach((r, i) => {
      const row = ws.addRow([
        new Date(r.submittedAt).toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
        ...allLabels.map((label) => r.values[label] || "-"),
      ]);
      if (i % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F6FF" } };
    });

    const fn = `${formName.replace(/[^a-z0-9]/gi, "-")}-responses-${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fn}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("SMART FORMS EXPORT ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to export responses" });
  }
};

/* ======================================================
   PUBLIC (unauthenticated)
====================================================== */
export const getPublicForm = async (req, res) => {
  try {
    const form = await service.getPublicForm(req.params.slug);
    if (!form) return res.status(404).json({ success: false, message: "Form not found" });
    return res.json({ success: true, form });
  } catch (err) {
    console.error("SMART FORMS PUBLIC GET ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load form" });
  }
};

export const submitPublicResponse = async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
    const result = await service.submitResponse(req.params.slug, req.body?.values, ip);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error("SMART FORMS PUBLIC SUBMIT ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
