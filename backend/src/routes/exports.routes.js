import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import { companyLapsed } from "../services/digitalCard.service.js";
import ExcelJS from "exceljs";
import { PLAN_FEATURES } from "../constants/pricing.js";
import { getPresignedUrl } from "../services/s3.service.js";

const router = express.Router();
router.use(express.json());
router.use(authenticate);

/* ═══════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════ */
const getCompanyId = (user) => user?.company_id || user?.companyId;

// Business plan has no conference booking at all — used to hide conference
// analytics/exports from companies whose plan doesn't include it.
const companyHasConference = async (companyId) => {
  const [[row]] = await db.query(`SELECT plan FROM companies WHERE id = ? LIMIT 1`, [companyId]);
  const plan = (row?.plan || "trial").toLowerCase();
  return PLAN_FEATURES[plan]?.conference ?? false;
};

/* ═══════════════════════════════════════════════════════════════
   FORMAT HELPERS
═══════════════════════════════════════════════════════════════ */
const formatDate = (date) => {
  if (!date) return "-";
  try { return new Date(date).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"2-digit" }); }
  catch { return "-"; }
};
const formatDateTime = (datetime) => {
  if (!datetime) return "-";
  try {
    return new Date(datetime).toLocaleString("en-US", {
      year:"numeric", month:"short", day:"2-digit",
      hour:"2-digit", minute:"2-digit", hour12:true,
    });
  } catch { return "-"; }
};
const formatTime = (time) => {
  if (!time) return "-";
  try {
    const [h, m] = String(time).split(":");
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
  } catch { return "-"; }
};

/* ═══════════════════════════════════════════════════════════════
   EXCEL STYLE HELPERS
═══════════════════════════════════════════════════════════════ */
const styleTitle = (ws, rowNum, bgArgb) => {
  const row = ws.getRow(rowNum);
  row.height = 34;
  // Apply style to every cell in the merged range so the fill covers all columns
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb: bgArgb } };
    cell.font      = { size:15, bold:true, color:{ argb:"FFFFFFFF" } };
    cell.alignment = { vertical:"middle", horizontal:"center", wrapText:false };
  });
};

const styleMeta = (ws, rowNum) => {
  const row = ws.getRow(rowNum);
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF3F0FF" } };
    cell.font      = { size:10, italic:true, color:{ argb:"FF5a5a8a" } };
    cell.alignment = { vertical:"middle", horizontal:"center" };
  });
};

const applyColumnHeader = (row) => {
  row.height = 26;
  row.font      = { bold:true, color:{ argb:"FFFFFFFF" }, size:11 };
  row.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF7a00ff" } };
  row.alignment = { vertical:"middle", horizontal:"center" };
};

const applyBorders = (worksheet) => {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top:    { style:"thin", color:{ argb:"FFcccccc" } },
          left:   { style:"thin", color:{ argb:"FFcccccc" } },
          bottom: { style:"thin", color:{ argb:"FFcccccc" } },
          right:  { style:"thin", color:{ argb:"FFcccccc" } },
        };
      });
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   EXCEL GENERATOR — VISITORS
   Correct mergeCells pattern:
     1. ws.columns  (define widths first)
     2. ws.addRow   (add the row — creates cells)
     3. ws.mergeCells (merge — ExcelJS now knows the range)
     4. ws.getCell("A1").value = ... (set value on top-left only)
     5. styleTitle  (apply fill/font to every cell in range)
═══════════════════════════════════════════════════════════════ */
// Converts a 1-based column number to its Excel letter (1 -> A, 27 -> AA)
const numberToColumnLetter = (num) => {
  let letter = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
};

const generateVisitorsExcel = async (companyId, companyName, periodLabel = "All Time", extraWhere = "", extraParams = []) => {
  const [visitors] = await db.query(
    `SELECT id, visitor_code, name, phone, email, from_company, department, designation,
        address, city, state, postal_code, country, person_to_meet, purpose,
        belongings, id_type, id_number, check_in, check_out, status, visit_status,
        purpose_category, purpose_subcategory, feedback_rating
       FROM visitors
       WHERE company_id = ? ${extraWhere}
       ORDER BY check_in DESC`,
    [companyId, ...extraParams]
  );

  // Custom field values for the exported visitors. Column order follows the
  // company's currently-configured field order first, then any other labels
  // found in the data (covers fields deleted since a visitor submitted a
  // value — the label is a text snapshot, see visitor.service.js) in order
  // of first appearance, so historical exports stay stable over time.
  const visitorIds = visitors.map((v) => v.id);
  let customFieldValueRows = [];
  if (visitorIds.length) {
    const [rows] = await db.query(
      `SELECT visitor_id, field_label, field_value FROM visitor_custom_field_values
       WHERE visitor_id IN (${visitorIds.map(() => "?").join(",")})`,
      visitorIds
    );
    customFieldValueRows = rows;
  }
  const [activeCustomFields] = await db.query(
    `SELECT label FROM company_custom_fields WHERE company_id = ? ORDER BY sort_order ASC, id ASC`,
    [companyId]
  );
  const customFieldLabels = [];
  const seenLabels = new Set();
  for (const f of activeCustomFields) {
    if (!seenLabels.has(f.label)) { seenLabels.add(f.label); customFieldLabels.push(f.label); }
  }
  for (const row of customFieldValueRows) {
    if (!seenLabels.has(row.field_label)) { seenLabels.add(row.field_label); customFieldLabels.push(row.field_label); }
  }
  const customValuesByVisitor = new Map();
  for (const row of customFieldValueRows) {
    if (!customValuesByVisitor.has(row.visitor_id)) customValuesByVisitor.set(row.visitor_id, {});
    customValuesByVisitor.get(row.visitor_id)[row.field_label] = row.field_value;
  }

  const FIXED_COLUMN_COUNT = 24;
  const totalColumns = FIXED_COLUMN_COUNT + customFieldLabels.length;
  const lastColLetter = numberToColumnLetter(totalColumns);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Visitors");
  ws.properties.defaultRowHeight = 20;

  // Step 1 — columns FIRST (24 fixed columns A–X — the last 3, Purpose
  // Category, Purpose Sub-Category and Feedback, are appended at the tail
  // rather than inserted after "Purpose" so the hardcoded row.getCell(20)
  // status-styling below doesn't need to shift — then one column per
  // custom field, also appended at the tail for the same reason)
  ws.columns = [
    { width:16 }, { width:26 }, { width:16 }, { width:30 }, { width:26 },
    { width:20 }, { width:20 }, { width:35 }, { width:15 }, { width:15 },
    { width:13 }, { width:15 }, { width:26 }, { width:35 }, { width:26 },
    { width:15 }, { width:20 }, { width:22 }, { width:22 }, { width:11 }, { width:15 },
    { width:22 }, { width:22 }, { width:18 },
    ...customFieldLabels.map(() => ({ width: 22 })),
  ];

  // Step 2 — add row 1 (empty array creates one cell per ws.columns entry)
  ws.addRow(new Array(totalColumns).fill(null));
  // Step 3 — merge all columns
  ws.mergeCells(`A1:${lastColLetter}1`);
  // Step 4 — set value on top-left cell ONLY
  ws.getCell("A1").value = `${companyName}  —  Visitor Records  (${periodLabel})`;
  // Step 5 — style the merged row
  styleTitle(ws, 1, "FF4c1d95");

  // Row 2 — meta
  ws.addRow(new Array(totalColumns).fill(null));
  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell("A2").value = `Generated: ${formatDateTime(new Date())}   |   Total Records: ${visitors.length}`;
  styleMeta(ws, 2);

  // Row 3 — blank spacer
  ws.addRow([]);
  ws.getRow(3).height = 6;

  // Row 4 — column headers
  const headerRow = ws.addRow([
    "Visitor Code","Name","Phone","Email","From Company","Department","Designation",
    "Address","City","State","Postal Code","Country","Person to Meet","Purpose",
    "Belongings","ID Type","ID Number","Check In","Check Out","Status","Visit Status",
    "Purpose Category","Purpose Sub-Category","Feedback",
    ...customFieldLabels,
  ]);
  applyColumnHeader(headerRow);

  // Data rows
  visitors.forEach((v, i) => {
    const customValues = customValuesByVisitor.get(v.id) || {};
    const row = ws.addRow([
      v.visitor_code||"-", v.name||"-", v.phone||"-", v.email||"-",
      v.from_company||"-", v.department||"-", v.designation||"-",
      v.address||"-", v.city||"-", v.state||"-", v.postal_code||"-",
      v.country||"-", v.person_to_meet||"-", v.purpose||"-",
      v.belongings||"-", v.id_type||"-", v.id_number||"-",
      formatDateTime(v.check_in),
      v.check_out ? formatDateTime(v.check_out) : "Still In",
      v.status||"-", v.visit_status||"pending",
      v.purpose_category||"-", v.purpose_subcategory||"-", v.feedback_rating||"-",
      ...customFieldLabels.map((label) => customValues[label] || "-"),
    ]);
    if (i % 2 === 0) row.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF8F6FF" } };
    row.getCell(20).alignment = { horizontal:"center" };
    if (v.status === "IN")  row.getCell(20).font = { bold:true, color:{ argb:"FF00c853" } };
    if (v.status === "OUT") row.getCell(20).font = { bold:true, color:{ argb:"FFff1744" } };
    row.getCell(21).alignment = { horizontal:"center" };
    const vsColors = { accepted:"FF00c853", declined:"FFff1744", pending:"FFf0a500", checked_out:"FF6200d6", auto_checked_out:"FF6b7280" };
    if (vsColors[v.visit_status]) row.getCell(21).font = { bold:true, color:{ argb:vsColors[v.visit_status] } };
  });

  applyBorders(ws);
  ws.views = [{ state:"frozen", xSplit:0, ySplit:4 }];
  return wb;
};

/* ═══════════════════════════════════════════════════════════════
   EXCEL GENERATOR — CONFERENCE BOOKINGS  (8 columns A–H)
═══════════════════════════════════════════════════════════════ */
const generateConferenceBookingsExcel = async (companyId, companyName, periodLabel = "All Time", extraWhere = "", extraParams = []) => {
  const [bookings] = await db.query(
    `SELECT b.booked_by, b.department, b.purpose, b.booking_date,
        b.start_time, b.end_time, b.status, r.room_name
       FROM conference_bookings b
       JOIN conference_rooms r ON b.room_id = r.id
       WHERE b.company_id = ? ${extraWhere}
       ORDER BY b.booking_date DESC, b.start_time DESC`,
    [companyId, ...extraParams]
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Conference Bookings");
  ws.properties.defaultRowHeight = 20;

  // Step 1 — columns FIRST (8 columns A–H)
  ws.columns = [
    { width:28 }, { width:28 }, { width:22 }, { width:38 },
    { width:16 }, { width:14 }, { width:14 }, { width:14 },
  ];

  // Step 2 — add row, step 3 — merge, step 4 — value, step 5 — style
  ws.addRow(new Array(8).fill(null));
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = `${companyName}  —  Conference Room Bookings  (${periodLabel})`;
  styleTitle(ws, 1, "FF1e3a8a");

  ws.addRow(new Array(8).fill(null));
  ws.mergeCells("A2:H2");
  ws.getCell("A2").value = `Generated: ${formatDateTime(new Date())}   |   Total Records: ${bookings.length}`;
  styleMeta(ws, 2);

  ws.addRow([]);
  ws.getRow(3).height = 6;

  const headerRow = ws.addRow(["Room Name","Booked By","Department","Purpose","Booking Date","Start Time","End Time","Status"]);
  applyColumnHeader(headerRow);

  bookings.forEach((b, i) => {
    const row = ws.addRow([
      b.room_name||"-", b.booked_by||"-", b.department||"-", b.purpose||"-",
      formatDate(b.booking_date), formatTime(b.start_time), formatTime(b.end_time), b.status||"-",
    ]);
    if (i % 2 === 0) row.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF0F7FF" } };
    row.getCell(8).alignment = { horizontal:"center" };
    if (b.status === "BOOKED")    row.getCell(8).font = { bold:true, color:{ argb:"FF00c853" } };
    if (b.status === "CANCELLED") row.getCell(8).font = { bold:true, color:{ argb:"FFff1744" } };
    if (b.status === "COMPLETED") row.getCell(8).font = { bold:true, color:{ argb:"FF0ea5e9" } };
  });

  applyBorders(ws);
  ws.views = [{ state:"frozen", xSplit:0, ySplit:4 }];
  return wb;
};

/* ═══════════════════════════════════════════════════════════════
   EXCEL GENERATOR — COMBINED (visitors + bookings, 2 sheets)
═══════════════════════════════════════════════════════════════ */
const generateCombinedExcel = async (companyId, companyName, periodLabel, extraWhereV, extraParamsV, extraWhereB, extraParamsB) => {
  const wb1 = await generateVisitorsExcel(companyId, companyName, periodLabel, extraWhereV, extraParamsV);
  const wb2 = await generateConferenceBookingsExcel(companyId, companyName, periodLabel, extraWhereB, extraParamsB);
  const combined = new ExcelJS.Workbook();

  for (const wb of [wb1, wb2]) {
    for (const srcWs of wb.worksheets) {
      const dstWs = combined.addWorksheet(srcWs.name);
      // Copy merged cells first
      srcWs.model.merges?.forEach(m => { try { dstWs.mergeCells(m); } catch {} });
      srcWs.eachRow((row, rn) => {
        const newRow = dstWs.getRow(rn);
        row.eachCell({ includeEmpty:true }, (cell, cn) => {
          const newCell = newRow.getCell(cn);
          newCell.value = cell.value;
          if (cell.style) newCell.style = JSON.parse(JSON.stringify(cell.style));
        });
        newRow.height = row.height;
        newRow.commit();
      });
      dstWs.columns = srcWs.columns.map(c => ({ width: c.width }));
      dstWs.views   = srcWs.views;
    }
  }
  return combined;
};

/* ═══════════════════════════════════════════════════════════════
   DATE RANGE
   Every report on the page (KPIs, charts, the visitor table, exports)
   takes the same range: a preset, or a custom From–To.

     ?period=today|week|month|quarter|year
         Calendar periods in IST, up to today: this week from Monday,
         this month from the 1st, this quarter, this year from 1 January.
     ?from=YYYY-MM-DD&to=YYYY-MM-DD
         A custom range, at most MAX_RANGE_DAYS long, never in the future.

   No period and no dates: all time (the exports' long-standing default).
   Dates are validated before they reach SQL, so the WHERE fragments
   below can carry them inline.
═══════════════════════════════════════════════════════════════ */
const PERIOD_LABELS  = { today:"Today", week:"This Week", month:"This Month", quarter:"This Quarter", year:"This Year" };
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86400000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays  = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const dayDiff  = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const validYmd = (s) => typeof s === "string" && YMD.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const fmtYmd   = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", timeZone:"UTC" });

const rangeError = (message) => Object.assign(new Error(message), { status: 400 });

/* The chart buckets follow the length: hours for one day, days up to a
   month, weeks up to about four months, months beyond. */
const groupingFor = (days) => (days <= 1 ? "hour" : days <= 31 ? "day" : days <= 124 ? "week" : "month");

const resolveRange = (query = {}) => {
  const today = istToday();
  if (query.from || query.to || query.period === "custom") {
    const { from, to } = query;
    if (!validYmd(from) || !validYmd(to)) throw rangeError("Choose a valid From and To date");
    if (from > to)    throw rangeError("From must be on or before To");
    if (to > today)   throw rangeError("The range cannot end in the future");
    const days = dayDiff(from, to) + 1;
    if (days > MAX_RANGE_DAYS) throw rangeError(`Choose a range of at most ${MAX_RANGE_DAYS} days`);
    return { key: "custom", from, to, days, custom: true, label: from === to ? fmtYmd(from) : `${fmtYmd(from)} – ${fmtYmd(to)}` };
  }
  const p = query.period;
  if (!PERIOD_LABELS[p]) return null;
  const y = today.slice(0, 4), m = Number(today.slice(5, 7));
  const from = {
    today,
    week:    addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7)),
    month:   `${today.slice(0, 7)}-01`,
    quarter: `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`,
    year:    `${y}-01-01`,
  }[p];
  return { key: p, from, to: today, days: dayDiff(from, today) + 1, custom: false, label: PERIOD_LABELS[p] };
};

/* The same number of days just before the range, for "% vs prev". */
const previousRange = (r) => r && ({ ...r, from: addDays(r.from, -r.days), to: addDays(r.from, -1) });

const IST = (col) => `DATE(CONVERT_TZ(${col},'+00:00','+05:30'))`;
const visitorRangeWhere = (r, col = "check_in") => (r ? `AND ${IST(col)} BETWEEN '${r.from}' AND '${r.to}'` : "");
/* Bookings on a preset also take future dates, so "Upcoming" counts what is
   already booked ahead; a custom range is exactly its dates. */
const bookingRangeWhere = (r, { bounded = r?.custom } = {}) =>
  (!r ? "" : bounded ? `AND booking_date BETWEEN '${r.from}' AND '${r.to}'` : `AND booking_date >= '${r.from}'`);

/* For export file names: the preset, or the custom dates. */
const rangeSlug = (r) => (!r ? "all" : r.custom ? `${r.from}_to_${r.to}` : r.key);

/* Wraps a route so a bad range answers 400 with its message. */
const rangeOr400 = (req, res) => {
  try { return { ok: true, range: resolveRange(req.query) }; }
  catch (err) {
    if (err.status === 400) { res.status(400).json({ message: err.message }); return { ok: false }; }
    throw err;
  }
};

const visitorPeriodWhere = (r) => ({ where: visitorRangeWhere(r), params: [], label: r?.label || "All Time" });
const bookingPeriodWhere = (r) => ({ where: bookingRangeWhere(r), params: [], label: r?.label || "All Time" });

/* ═══════════════════════════════════════════════════════════════
   DOWNLOAD ROUTES
═══════════════════════════════════════════════════════════════ */
router.get("/visitors", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const rr = rangeOr400(req, res); if (!rr.ok) return;
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message:"Company not found" });
    const { where, params, label } = visitorPeriodWhere(rr.range);
    const wb = await generateVisitorsExcel(companyId, company.name, label, where, params);
    const fn = `${company.name.replace(/[^a-z0-9]/gi,"-")}-visitors-${rangeSlug(rr.range)}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename="${fn}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) {
    console.error("[GET /exports/visitors]", err.message);
    res.status(500).json({ message:"Failed to export visitors data" });
  }
});

router.get("/conference-bookings", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    if (!(await companyHasConference(companyId))) {
      return res.status(403).json({ message: "Conference booking reports are not available on your current plan. Upgrade to Enterprise to access this feature." });
    }
    const rr = rangeOr400(req, res); if (!rr.ok) return;
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message:"Company not found" });
    const { where, params, label } = bookingPeriodWhere(rr.range);
    const wb = await generateConferenceBookingsExcel(companyId, company.name, label||"All Time", where, params);
    const fn = `${company.name.replace(/[^a-z0-9]/gi,"-")}-bookings-${rangeSlug(rr.range)}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename="${fn}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) {
    console.error("[GET /exports/conference-bookings]", err.message);
    res.status(500).json({ message:"Failed to export bookings data" });
  }
});

router.get("/all", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message:"Company not found" });
    const rr = rangeOr400(req, res); if (!rr.ok) return;
    const vP = visitorPeriodWhere(rr.range);
    const bP = bookingPeriodWhere(rr.range);
    const wb = await generateCombinedExcel(companyId, company.name, vP.label||"All Time", vP.where, vP.params, bP.where, bP.params);
    const fn = `${company.name.replace(/[^a-z0-9]/gi,"-")}-complete-report-${rangeSlug(rr.range)}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename="${fn}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) {
    console.error("[GET /exports/all]", err.message);
    res.status(500).json({ message:"Failed to export complete report" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   SMART FORMS — combined responses across ALL of this company's
   forms (active + retired, so a retired form's history is never
   lost from the report), one sheet, tagged by which form each row
   came from.
═══════════════════════════════════════════════════════════════ */
router.get("/smart-forms", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message:"Company not found" });

    const rr = rangeOr400(req, res); if (!rr.ok) return;
    const periodWhere = visitorRangeWhere(rr.range, "r.submitted_at");
    const label = rr.range?.label || "All Time";

    // Responses are joined by form_id regardless of the form's status —
    // retiring or deleting a form only changes its status, never removes
    // the row or its responses, so historical data here is unaffected.
    // Deleted forms (no longer visible in the Smart Forms dashboard) are
    // labeled the same as retired ones here, since from a report reader's
    // perspective both simply mean "no longer an active form."
    const [responses] = await db.query(
      `SELECT r.id, r.submitted_at,
          CASE WHEN f.status != 'active' THEN CONCAT(f.name, ' (Retired)') ELSE f.name END AS form_name
       FROM smart_form_responses r
       JOIN smart_forms f ON f.id = r.form_id
       WHERE f.company_id = ? ${periodWhere}
       ORDER BY r.submitted_at DESC`,
      [companyId]
    );

    const responseIds = responses.map((r) => r.id);
    let valuesByResponse = new Map();
    let allLabels = [];
    if (responseIds.length) {
      const [values] = await db.query(
        `SELECT response_id, field_label, field_value FROM smart_form_response_values
         WHERE response_id IN (${responseIds.map(() => "?").join(",")})`,
        responseIds
      );
      const seen = new Set();
      for (const v of values) {
        if (!valuesByResponse.has(v.response_id)) valuesByResponse.set(v.response_id, {});
        valuesByResponse.get(v.response_id)[v.field_label] = v.field_value;
        if (!seen.has(v.field_label)) { seen.add(v.field_label); allLabels.push(v.field_label); }
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Smart Forms Responses");
    const totalColumns = 3 + allLabels.length;
    const lastColLetter = numberToColumnLetter(totalColumns);
    ws.columns = [{ width:22 }, { width:26 }, { width:20 }, ...allLabels.map(() => ({ width:24 }))];

    ws.addRow(new Array(totalColumns).fill(null));
    ws.mergeCells(`A1:${lastColLetter}1`);
    ws.getCell("A1").value = `${company.name}  —  Smart Forms Responses  (${label})`;
    styleTitle(ws, 1, "FF6200d6");

    ws.addRow(new Array(totalColumns).fill(null));
    ws.mergeCells(`A2:${lastColLetter}2`);
    ws.getCell("A2").value = `Generated: ${formatDateTime(new Date())}   |   Total Responses: ${responses.length}`;
    styleMeta(ws, 2);

    ws.addRow([]);
    ws.getRow(3).height = 6;

    const headerRow = ws.addRow(["Form", "Submitted On", ...allLabels]);
    applyColumnHeader(headerRow);

    responses.forEach((r, i) => {
      const vals = valuesByResponse.get(r.id) || {};
      const row = ws.addRow([
        r.form_name,
        formatDateTime(r.submitted_at),
        ...allLabels.map((label) => vals[label] || "-"),
      ]);
      if (i % 2 === 0) row.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF8F6FF" } };
    });

    applyBorders(ws);
    ws.views = [{ state:"frozen", xSplit:0, ySplit:4 }];

    const fn = `${company.name.replace(/[^a-z0-9]/gi,"-")}-smart-forms-${rangeSlug(rr.range)}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename="${fn}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) {
    console.error("[GET /exports/smart-forms]", err.message);
    res.status(500).json({ message:"Failed to export Smart Forms responses" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════════════ */
/* ======================================================
   CARD CONTACTS  GET /api/exports/card-leads
   Details shared back by people who scanned a digital visiting card
   (shown as "Contacts"). A deleted card's contacts are kept, and marked
   "(deleted card)" after the owner's name.
====================================================== */
router.get("/card-leads", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    // Locked with the rest of Digital Cards once the subscription lapses.
    if (await companyLapsed(companyId)) {
      return res.status(403).json({ status: "expired", message: "Your subscription has expired. Renew your plan to export card contacts." });
    }
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const [rows] = await db.query(
      `SELECT l.created_at,
              CASE WHEN l.card_id IS NULL THEN CONCAT(COALESCE(l.card_owner_name, 'Card'), ' (deleted card)')
                   ELSE c.name END AS card_owner,
              l.name, l.phone, l.email, l.company_name, l.message
         FROM card_leads l
         LEFT JOIN digital_cards c ON c.id = l.card_id
        WHERE l.company_id = ?
        ORDER BY l.created_at DESC`,
      [companyId]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Card Contacts");
    ws.columns = [
      { header: "Received",   key: "created_at",   width: 20 },
      { header: "Card Owner", key: "card_owner",   width: 22 },
      { header: "Name",       key: "name",         width: 22 },
      { header: "Phone",      key: "phone",        width: 16 },
      { header: "Email",      key: "email",        width: 28 },
      { header: "Company",    key: "company_name", width: 24 },
      { header: "Message",    key: "message",      width: 50 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));

    const fn = `${company.name.replace(/[^a-z0-9]/gi, "-")}-card-contacts-${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fn}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/card-leads]", err.message);
    res.status(500).json({ message: "Failed to export card contacts" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[v]]  = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ?`, [companyId]);
    const [[b]]  = await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`, [companyId]);
    const [[av]] = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? AND status = 'IN'`, [companyId]);
    const [[ub]] = await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? AND booking_date >= CURDATE() AND status = 'BOOKED'`, [companyId]);
    res.json({ visitors:{ total:v.total, active:av.total }, bookings:{ total:b.total, upcoming:ub.total } });
  } catch (err) {
    console.error("[GET /exports/stats]", err.message);
    res.status(500).json({ message:"Failed to fetch stats" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS  GET /api/exports/analytics?period=…  or  ?from=…&to=…
═══════════════════════════════════════════════════════════════ */
router.get("/analytics", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const rr = rangeOr400(req, res); if (!rr.ok) return;
    // No range means the page's default, This Month.
    const range = rr.range || resolveRange({ period: "month" });
    const prev  = previousRange(range);
    // One day by the hour; a preset on its first day (Week on a Monday,
    // Month on the 1st) still charts by day, as the rest of that period will.
    const grouping = range.days <= 1 && range.key !== "today" && !range.custom
      ? "day" : groupingFor(range.days);

    const vWhere     = visitorRangeWhere(range);
    const bWhere     = bookingRangeWhere(range);
    const vWherePrev = visitorRangeWhere(prev);
    const bWherePrev = bookingRangeWhere(prev, { bounded: true });

    const vAt = "CONVERT_TZ(check_in,'+00:00','+05:30')";
    // Grouped by the year as well, so a range across New Year never merges
    // two Januaries. Labels wrapped in MIN() for only_full_group_by.
    const vGroup = {
      hour:  `HOUR(${vAt})`,
      day:   `DATE(${vAt})`,
      week:  `YEARWEEK(${vAt},3)`,
      month: `DATE_FORMAT(${vAt},'%Y-%m')`,
    }[grouping];
    const vLabel = {
      hour:  `DATE_FORMAT(MIN(${vAt}),'%H:00')`,
      day:   `DATE_FORMAT(MIN(${vAt}),'%Y-%m-%d')`,
      week:  `DATE_FORMAT(MIN(${vAt}),'%d %b')`,
      month: `DATE_FORMAT(MIN(${vAt}),'%b %Y')`,
    }[grouping];

    const bGroup = {
      hour: "booking_date", day: "booking_date",
      week: "YEARWEEK(booking_date,3)", month: "DATE_FORMAT(booking_date,'%Y-%m')",
    }[grouping];
    const bLabel = {
      hour:  "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      day:   "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      week:  "DATE_FORMAT(MIN(booking_date),'%d %b')",
      month: "DATE_FORMAT(MIN(booking_date),'%b %Y')",
    }[grouping];

    // ── Visitor queries ──
    const [dailyVisitors]      = await db.query(`SELECT ${vLabel} AS date, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY ${vGroup} ORDER BY MIN(check_in) ASC`, [companyId]);
    const [hourlyVisitors]     = await db.query(`SELECT HOUR(CONVERT_TZ(check_in,'+00:00','+05:30')) AS hour, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY hour ORDER BY hour ASC`, [companyId]);
    const [dowVisitors]        = await db.query(`SELECT DAYOFWEEK(CONVERT_TZ(check_in,'+00:00','+05:30')) AS dow, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY dow ORDER BY dow ASC`, [companyId]);
    const [topEmployees]       = await db.query(`SELECT person_to_meet AS name, COUNT(*) AS count FROM visitors WHERE company_id = ? AND person_to_meet IS NOT NULL AND person_to_meet != '' ${vWhere} GROUP BY person_to_meet ORDER BY count DESC LIMIT 8`, [companyId]);
    const [topPurposes]        = await db.query(`SELECT purpose AS name, COUNT(*) AS count FROM visitors WHERE company_id = ? AND purpose IS NOT NULL AND purpose != '' ${vWhere} GROUP BY purpose ORDER BY count DESC LIMIT 6`, [companyId]);
    // Category-level breakdown for companies using the Purpose of Visit
    // picker — empty for companies still on plain free-text Purpose.
    const [purposeCategoryBreakdown] = await db.query(`SELECT purpose_category AS name, COUNT(*) AS count FROM visitors WHERE company_id = ? AND purpose_category IS NOT NULL AND purpose_category != '' ${vWhere} GROUP BY purpose_category ORDER BY count DESC`, [companyId]);
    const [purposeSubcategoryBreakdown] = await db.query(`SELECT purpose_category AS category, purpose_subcategory AS name, COUNT(*) AS count FROM visitors WHERE company_id = ? AND purpose_subcategory IS NOT NULL AND purpose_subcategory != '' ${vWhere} GROUP BY purpose_category, purpose_subcategory ORDER BY count DESC`, [companyId]);
    const [visitStatusBreakdown] = await db.query(`SELECT visit_status AS status, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY visit_status`, [companyId]);
    // Feedback (checkout+feedback WhatsApp flow) — breakdown of ratings
    // given, plus response rate among visitors the message was actually
    // sent to (checkout_feedback_sent=1), not all visitors in the period.
    const [feedbackBreakdown]  = await db.query(`SELECT feedback_rating AS name, COUNT(*) AS count FROM visitors WHERE company_id = ? AND feedback_rating IS NOT NULL ${vWhere} GROUP BY feedback_rating ORDER BY count DESC`, [companyId]);
    const [[feedbackTotals]]   = await db.query(`SELECT SUM(checkout_feedback_sent = 1) AS eligible, SUM(feedback_rating IS NOT NULL) AS responded FROM visitors WHERE company_id = ? ${vWhere}`, [companyId]);
    const [[visitorTotals]]    = await db.query(`SELECT COUNT(*) AS total, SUM(status='IN') AS active, SUM(DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))=DATE(CONVERT_TZ(NOW(),'+00:00','+05:30'))) AS today, SUM(pass_mail_sent>0) AS passIssued FROM visitors WHERE company_id = ? ${vWhere}`, [companyId]);
    const [[visitorPrev]]      = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? ${vWherePrev}`, [companyId]);

    // ── Conference queries — skipped entirely for plans without conference
    // booking (Business), so no booking data is ever computed or returned ──
    const hasConference = await companyHasConference(companyId);

    let bookingsPayload = null;
    if (hasConference) {
      const [dailyBookings]        = await db.query(`SELECT ${bLabel} AS date, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? ${bWhere} GROUP BY ${bGroup} ORDER BY MIN(booking_date) ASC`, [companyId]);
      const [bookingStatusBreakdown] = await db.query(`SELECT status, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? ${bWhere} GROUP BY status`, [companyId]);
      const [topRooms]             = await db.query(`SELECT r.room_name AS name, COUNT(*) AS count FROM conference_bookings b JOIN conference_rooms r ON b.room_id = r.id WHERE b.company_id = ? ${bWhere} GROUP BY r.room_name ORDER BY count DESC LIMIT 6`, [companyId]);
      const [bookingsByDept]       = await db.query(`SELECT department AS name, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? AND department IS NOT NULL AND department != '' ${bWhere} GROUP BY department ORDER BY count DESC LIMIT 6`, [companyId]);
      const [dowBookings]          = await db.query(`SELECT DAYOFWEEK(booking_date) AS dow, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? ${bWhere} GROUP BY dow ORDER BY dow ASC`, [companyId]);
      const [[avgDuration]]        = await db.query(`SELECT ROUND(AVG(TIME_TO_SEC(TIMEDIFF(end_time,start_time))/60)) AS avgMinutes FROM conference_bookings WHERE company_id = ? AND end_time > start_time ${bWhere}`, [companyId]);
      const [[bookingTotals]]      = await db.query(`SELECT COUNT(*) AS total, SUM(status='BOOKED' AND booking_date>=CURDATE()) AS upcoming, SUM(status='CANCELLED') AS cancelled, SUM(status='COMPLETED') AS completed FROM conference_bookings WHERE company_id = ? ${bWhere}`, [companyId]);
      const [[bookingPrev]]        = await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? ${bWherePrev}`, [companyId]);

      bookingsPayload = {
        total:              bookingTotals.total     || 0,
        upcoming:           bookingTotals.upcoming  || 0,
        cancelled:          bookingTotals.cancelled || 0,
        completed:          bookingTotals.completed || 0,
        prevTotal:          bookingPrev.total       || 0,
        avgDurationMinutes: avgDuration.avgMinutes  || 0,
        dailyTrend:         dailyBookings,
        statusBreakdown:    bookingStatusBreakdown,
        topRooms,
        byDepartment:       bookingsByDept,
        dowDistribution:    dowBookings,
      };
    }

    res.json({
      period: range.key,
      range: { key: range.key, from: range.from, to: range.to, days: range.days, label: range.label, grouping,
               prevFrom: prev.from, prevTo: prev.to },
      visitors: {
        total:      visitorTotals.total      || 0,
        active:     visitorTotals.active     || 0,
        today:      visitorTotals.today      || 0,
        passIssued: visitorTotals.passIssued || 0,
        prevTotal:  visitorPrev.total        || 0,
        dailyTrend:          dailyVisitors,
        hourlyDistribution:  hourlyVisitors,
        dowDistribution:     dowVisitors,
        topEmployees,
        topPurposes,
        purposeCategoryBreakdown,
        purposeSubcategoryBreakdown,
        visitStatusBreakdown,
        feedbackBreakdown,
        feedbackEligible:    feedbackTotals.eligible  || 0,
        feedbackResponded:   feedbackTotals.responded || 0,
        feedbackResponseRate: feedbackTotals.eligible
          ? Math.round((feedbackTotals.responded / feedbackTotals.eligible) * 100)
          : 0,
      },
      bookings: bookingsPayload,
    });
  } catch (err) {
    console.error("[GET /exports/analytics]", err.message);
    res.status(500).json({ message:"Failed to fetch analytics" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   VISITOR TABLE  GET /api/exports/visitor-table
   The visitors in the report's range, a page at a time, with the table's
   own filters. ID numbers are never part of a row.

     page, pageSize (25, at most 100)
     sort = check_in | check_out | name | duration | visit_status, dir = asc | desc
     q         name, phone, company or visitor code
     status    visit_status
     host      person_to_meet
     category  purpose_category
     inout     in | out
     feedback  excellent | good | needs_improvement | none
═══════════════════════════════════════════════════════════════ */
const TABLE_SORTS = {
  check_in: "v.check_in", check_out: "v.check_out", name: "v.name",
  duration: "duration_minutes", visit_status: "v.visit_status",
};
const VISIT_STATUSES = ["pending", "accepted", "declined", "checked_in", "checked_out", "auto_checked_out"];
const FEEDBACK = ["excellent", "good", "needs_improvement"];
const istIso = (col) => `DATE_FORMAT(CONVERT_TZ(${col},'+00:00','+05:30'),'%Y-%m-%dT%H:%i:%s+05:30')`;

router.get("/visitor-table", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const rr = rangeOr400(req, res); if (!rr.ok) return;
    const range = rr.range || resolveRange({ period: "month" });
    const q = req.query;

    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize, 10) || 25));
    const page     = Math.max(1, parseInt(q.page, 10) || 1);
    const sortCol  = TABLE_SORTS[q.sort] || TABLE_SORTS.check_in;
    const dir      = q.dir === "asc" ? "ASC" : "DESC";

    const where = [`v.company_id = ?`, `${IST("v.check_in")} BETWEEN ? AND ?`];
    const args  = [companyId, range.from, range.to];
    const term = typeof q.q === "string" ? q.q.trim().slice(0, 100) : "";
    if (term) {
      const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
      where.push("(v.name LIKE ? OR v.phone LIKE ? OR v.from_company LIKE ? OR v.visitor_code LIKE ?)");
      args.push(like, like, like, like);
    }
    if (VISIT_STATUSES.includes(q.status)) { where.push("v.visit_status = ?"); args.push(q.status); }
    if (typeof q.host === "string" && q.host)         { where.push("v.person_to_meet = ?");   args.push(q.host.slice(0, 200)); }
    if (typeof q.category === "string" && q.category) { where.push("v.purpose_category = ?"); args.push(q.category.slice(0, 200)); }
    if (q.inout === "in")  where.push("v.status = 'IN'");
    if (q.inout === "out") where.push("v.status = 'OUT'");
    if (FEEDBACK.includes(q.feedback)) { where.push("v.feedback_rating = ?"); args.push(q.feedback); }
    if (q.feedback === "none") where.push("v.feedback_rating IS NULL");
    const W = where.join(" AND ");

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM visitors v WHERE ${W}`, args);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const at = Math.min(page, pages);
    const [rows] = await db.query(
      `SELECT v.id, v.visitor_code, v.name, v.phone, v.from_company, v.person_to_meet,
              v.purpose, v.purpose_category, v.purpose_subcategory,
              ${istIso("v.check_in")} AS check_in, ${istIso("v.check_out")} AS check_out,
              TIMESTAMPDIFF(MINUTE, v.check_in, COALESCE(v.check_out, NOW())) AS duration_minutes,
              v.status, v.visit_status, v.feedback_rating
         FROM visitors v
        WHERE ${W}
        ORDER BY ${sortCol} ${dir}, v.id ${dir}
        LIMIT ${pageSize} OFFSET ${(at - 1) * pageSize}`,
      args
    );

    // The choices for the Host and Category filters: what this range has.
    const [hosts] = await db.query(
      `SELECT DISTINCT person_to_meet AS v FROM visitors
        WHERE company_id = ? AND person_to_meet IS NOT NULL AND person_to_meet <> ''
          AND ${IST("check_in")} BETWEEN ? AND ? ORDER BY v LIMIT 300`,
      [companyId, range.from, range.to]
    );
    const [categories] = await db.query(
      `SELECT DISTINCT purpose_category AS v FROM visitors
        WHERE company_id = ? AND purpose_category IS NOT NULL AND purpose_category <> ''
          AND ${IST("check_in")} BETWEEN ? AND ? ORDER BY v LIMIT 300`,
      [companyId, range.from, range.to]
    );

    res.json({
      rows, total, page: at, pages, pageSize,
      options: { hosts: hosts.map((r) => r.v), categories: categories.map((r) => r.v) },
    });
  } catch (err) {
    console.error("[GET /exports/visitor-table]", err.message);
    res.status(500).json({ message: "Failed to load visitors" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ONE VISITOR  GET /api/exports/visitor/:id
   The table's details panel: the whole record, custom fields and photo.
   An Aadhaar number is never sent; any other ID only as its last 4.
═══════════════════════════════════════════════════════════════ */
const maskId = (type, num) => {
  if (!num) return null;
  if (String(type).toLowerCase() === "aadhaar") return null;
  const s = String(num);
  return s.length <= 4 ? "••••" : `••••${s.slice(-4)}`;
};

router.get("/visitor/:id", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(404).json({ message: "Visitor not found" });
    const [[v]] = await db.query(
      `SELECT v.id, v.visitor_code, v.name, v.phone, v.email, v.from_company, v.department, v.designation,
              v.address, v.city, v.state, v.postal_code, v.country,
              v.person_to_meet, v.purpose, v.purpose_category, v.purpose_subcategory, v.belongings,
              v.id_type, v.id_number, v.photo_url,
              ${istIso("v.check_in")} AS check_in, ${istIso("v.check_out")} AS check_out,
              TIMESTAMPDIFF(MINUTE, v.check_in, COALESCE(v.check_out, NOW())) AS duration_minutes,
              v.status, v.visit_status, v.feedback_rating, v.pass_mail_sent
         FROM visitors v WHERE v.id = ? AND v.company_id = ? LIMIT 1`,
      [id, companyId]
    );
    if (!v) return res.status(404).json({ message: "Visitor not found" });
    const [custom] = await db.query(
      `SELECT field_label AS label, field_value AS value FROM visitor_custom_field_values
        WHERE visitor_id = ? ORDER BY id`,
      [v.id]
    );
    let photo = null;
    if (v.photo_url) { try { photo = await getPresignedUrl(v.photo_url, 3600); } catch { photo = null; } }
    const { id_number, photo_url, ...rest } = v;
    res.json({
      visitor: {
        ...rest,
        id_number_masked: maskId(v.id_type, id_number),
        id_provided: !!id_number,
        photo,
        pass_issued: v.pass_mail_sent > 0,
        custom: custom.filter((c) => c.value !== null && c.value !== ""),
      },
    });
  } catch (err) {
    console.error("[GET /exports/visitor/:id]", err.message);
    res.status(500).json({ message: "Failed to load the visitor" });
  }
});

export default router;
