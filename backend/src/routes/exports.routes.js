import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import ExcelJS from "exceljs";

const router = express.Router();
router.use(express.json());
router.use(authenticate);

/* ═══════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════ */
const getCompanyId = (user) => user?.company_id || user?.companyId;

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
const generateVisitorsExcel = async (companyId, companyName, periodLabel = "All Time", extraWhere = "", extraParams = []) => {
  const [visitors] = await db.query(
    `SELECT visitor_code, name, phone, email, from_company, department, designation,
        address, city, state, postal_code, country, person_to_meet, purpose,
        belongings, id_type, id_number, check_in, check_out, status, visit_status
       FROM visitors
       WHERE company_id = ? ${extraWhere}
       ORDER BY check_in DESC`,
    [companyId, ...extraParams]
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Visitors");
  ws.properties.defaultRowHeight = 20;

  // Step 1 — columns FIRST (21 columns A–U)
  ws.columns = [
    { width:16 }, { width:26 }, { width:16 }, { width:30 }, { width:26 },
    { width:20 }, { width:20 }, { width:35 }, { width:15 }, { width:15 },
    { width:13 }, { width:15 }, { width:26 }, { width:35 }, { width:26 },
    { width:15 }, { width:20 }, { width:22 }, { width:22 }, { width:11 }, { width:15 },
  ];

  // Step 2 — add row 1 (empty array creates 21 cells matching ws.columns)
  ws.addRow(new Array(21).fill(null));
  // Step 3 — merge all 21 columns
  ws.mergeCells("A1:U1");
  // Step 4 — set value on top-left cell ONLY
  ws.getCell("A1").value = `${companyName}  —  Visitor Records  (${periodLabel})`;
  // Step 5 — style the merged row
  styleTitle(ws, 1, "FF4c1d95");

  // Row 2 — meta
  ws.addRow(new Array(21).fill(null));
  ws.mergeCells("A2:U2");
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
  ]);
  applyColumnHeader(headerRow);

  // Data rows
  visitors.forEach((v, i) => {
    const row = ws.addRow([
      v.visitor_code||"-", v.name||"-", v.phone||"-", v.email||"-",
      v.from_company||"-", v.department||"-", v.designation||"-",
      v.address||"-", v.city||"-", v.state||"-", v.postal_code||"-",
      v.country||"-", v.person_to_meet||"-", v.purpose||"-",
      v.belongings||"-", v.id_type||"-", v.id_number||"-",
      formatDateTime(v.check_in),
      v.check_out ? formatDateTime(v.check_out) : "Still In",
      v.status||"-", v.visit_status||"pending",
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
   PERIOD WHERE HELPERS
═══════════════════════════════════════════════════════════════ */
const PERIOD_LABELS = { today:"Today", week:"This Week", month:"This Month", quarter:"This Quarter", year:"This Year" };
const PERIOD_IV     = { today:"0 DAY", week:"6 DAY", month:"29 DAY", quarter:"89 DAY", year:"364 DAY" };

const visitorPeriodWhere = (period) => {
  const iv = PERIOD_IV[period];
  if (!iv) return { where:"", params:[], label:"All Time" };
  return {
    where:  `AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) >= DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv}`,
    params: [],
    label:  PERIOD_LABELS[period] || "Custom",
  };
};

const bookingPeriodWhere = (period) => {
  const iv = PERIOD_IV[period];
  if (!iv) return { where:"", params:[], label:"All Time" };
  return {
    where:  `AND booking_date >= CURDATE() - INTERVAL ${iv}`,
    params: [],
    label:  PERIOD_LABELS[period] || "Custom",
  };
};

/* ═══════════════════════════════════════════════════════════════
   DOWNLOAD ROUTES
═══════════════════════════════════════════════════════════════ */
router.get("/visitors", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message:"Company not found" });
    const { where, params, label } = visitorPeriodWhere(req.query.period);
    const wb = await generateVisitorsExcel(companyId, company.name, label, where, params);
    const fn = `${company.name.replace(/[^a-z0-9]/gi,"-")}-visitors-${req.query.period||"all"}-${Date.now()}.xlsx`;
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
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message:"Company not found" });
    const { where, params, label } = bookingPeriodWhere(req.query.period);
    const wb = await generateConferenceBookingsExcel(companyId, company.name, label||"All Time", where, params);
    const fn = `${company.name.replace(/[^a-z0-9]/gi,"-")}-bookings-${req.query.period||"all"}-${Date.now()}.xlsx`;
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
    const vP = visitorPeriodWhere(req.query.period);
    const bP = bookingPeriodWhere(req.query.period);
    const wb = await generateCombinedExcel(companyId, company.name, vP.label||"All Time", vP.where, vP.params, bP.where, bP.params);
    const fn = `${company.name.replace(/[^a-z0-9]/gi,"-")}-complete-report-${req.query.period||"all"}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename="${fn}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) {
    console.error("[GET /exports/all]", err.message);
    res.status(500).json({ message:"Failed to export complete report" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════════════ */
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
   ANALYTICS  GET /api/exports/analytics?period=today|week|month|quarter|year
═══════════════════════════════════════════════════════════════ */
router.get("/analytics", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const period    = req.query.period || "month";

    const iv = PERIOD_IV[period] || "29 DAY";

    const vWhere     = `AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) >= DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv}`;
    const bWhere     = `AND booking_date >= CURDATE() - INTERVAL ${iv}`;
    const vWherePrev = `AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) >= DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv} - INTERVAL ${iv}
                        AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) <  DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv}`;
    const bWherePrev = `AND booking_date >= CURDATE() - INTERVAL ${iv} - INTERVAL ${iv}
                        AND booking_date <  CURDATE() - INTERVAL ${iv}`;

    const vGroup = {
      today:"HOUR(CONVERT_TZ(check_in,'+00:00','+05:30'))",
      week: "DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))",
      month:"DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))",
      quarter:"YEARWEEK(CONVERT_TZ(check_in,'+00:00','+05:30'),3)",
      year: "MONTH(CONVERT_TZ(check_in,'+00:00','+05:30'))",
    }[period] || "DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))";

    // All label SELECT expressions wrapped in MIN() to satisfy only_full_group_by
    const vLabel = {
      today:   "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%H:00')",
      week:    "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%Y-%m-%d')",
      month:   "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%Y-%m-%d')",
      quarter: "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%d %b')",
      year:    "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%b %Y')",
    }[period] || "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%Y-%m-%d')";

    const bGroup = {
      today:"booking_date", week:"booking_date", month:"booking_date",
      quarter:"YEARWEEK(booking_date,3)", year:"MONTH(booking_date)",
    }[period] || "booking_date";

    const bLabel = {
      today:   "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      week:    "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      month:   "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      quarter: "DATE_FORMAT(MIN(booking_date),'%d %b')",
      year:    "DATE_FORMAT(MIN(booking_date),'%b %Y')",
    }[period] || "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')";

    // ── Visitor queries ──
    const [dailyVisitors]      = await db.query(`SELECT ${vLabel} AS date, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY ${vGroup} ORDER BY MIN(check_in) ASC`, [companyId]);
    const [hourlyVisitors]     = await db.query(`SELECT HOUR(CONVERT_TZ(check_in,'+00:00','+05:30')) AS hour, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY hour ORDER BY hour ASC`, [companyId]);
    const [dowVisitors]        = await db.query(`SELECT DAYOFWEEK(CONVERT_TZ(check_in,'+00:00','+05:30')) AS dow, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY dow ORDER BY dow ASC`, [companyId]);
    const [topEmployees]       = await db.query(`SELECT person_to_meet AS name, COUNT(*) AS count FROM visitors WHERE company_id = ? AND person_to_meet IS NOT NULL AND person_to_meet != '' ${vWhere} GROUP BY person_to_meet ORDER BY count DESC LIMIT 8`, [companyId]);
    const [topPurposes]        = await db.query(`SELECT purpose AS name, COUNT(*) AS count FROM visitors WHERE company_id = ? AND purpose IS NOT NULL AND purpose != '' ${vWhere} GROUP BY purpose ORDER BY count DESC LIMIT 6`, [companyId]);
    const [visitStatusBreakdown] = await db.query(`SELECT visit_status AS status, COUNT(*) AS count FROM visitors WHERE company_id = ? ${vWhere} GROUP BY visit_status`, [companyId]);
    const [[visitorTotals]]    = await db.query(`SELECT COUNT(*) AS total, SUM(status='IN') AS active, SUM(DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))=DATE(CONVERT_TZ(NOW(),'+00:00','+05:30'))) AS today, SUM(pass_mail_sent>0) AS passIssued FROM visitors WHERE company_id = ? ${vWhere}`, [companyId]);
    const [[visitorPrev]]      = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? ${vWherePrev}`, [companyId]);

    // ── Feedback queries ──
    const [feedbackBreakdown] = await db.query(
      `SELECT feedback_rating AS status, COUNT(*) AS count
       FROM visitors WHERE company_id = ? AND feedback_rating IS NOT NULL ${vWhere}
       GROUP BY feedback_rating ORDER BY count DESC`,
      [companyId]
    );
    const [[feedbackTotals]] = await db.query(
      `SELECT
         SUM(feedback_rating IS NOT NULL) AS total,
         SUM(feedback_rating IN ('excellent','good')) AS satisfied,
         SUM(feedback_sent = 1) AS sent
       FROM visitors WHERE company_id = ? ${vWhere}`,
      [companyId]
    );
    const [[feedbackPrev]] = await db.query(
      `SELECT COUNT(*) AS total FROM visitors
       WHERE company_id = ? AND feedback_rating IS NOT NULL ${vWherePrev}`,
      [companyId]
    );

    // ── Conference queries ──
    const [dailyBookings]        = await db.query(`SELECT ${bLabel} AS date, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? ${bWhere} GROUP BY ${bGroup} ORDER BY MIN(booking_date) ASC`, [companyId]);
    const [bookingStatusBreakdown] = await db.query(`SELECT status, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? ${bWhere} GROUP BY status`, [companyId]);
    const [topRooms]             = await db.query(`SELECT r.room_name AS name, COUNT(*) AS count FROM conference_bookings b JOIN conference_rooms r ON b.room_id = r.id WHERE b.company_id = ? ${bWhere} GROUP BY r.room_name ORDER BY count DESC LIMIT 6`, [companyId]);
    const [bookingsByDept]       = await db.query(`SELECT department AS name, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? AND department IS NOT NULL AND department != '' ${bWhere} GROUP BY department ORDER BY count DESC LIMIT 6`, [companyId]);
    const [dowBookings]          = await db.query(`SELECT DAYOFWEEK(booking_date) AS dow, COUNT(*) AS count FROM conference_bookings WHERE company_id = ? ${bWhere} GROUP BY dow ORDER BY dow ASC`, [companyId]);
    const [[avgDuration]]        = await db.query(`SELECT ROUND(AVG(TIME_TO_SEC(TIMEDIFF(end_time,start_time))/60)) AS avgMinutes FROM conference_bookings WHERE company_id = ? AND end_time > start_time ${bWhere}`, [companyId]);
    const [[bookingTotals]]      = await db.query(`SELECT COUNT(*) AS total, SUM(status='BOOKED' AND booking_date>=CURDATE()) AS upcoming, SUM(status='CANCELLED') AS cancelled, SUM(status='COMPLETED') AS completed FROM conference_bookings WHERE company_id = ? ${bWhere}`, [companyId]);
    const [[bookingPrev]]        = await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? ${bWherePrev}`, [companyId]);

    res.json({
      period,
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
        visitStatusBreakdown,
      },
      feedback: {
        total:         feedbackTotals.total     || 0,
        satisfied:     feedbackTotals.satisfied || 0,
        sent:          feedbackTotals.sent      || 0,
        prevTotal:     feedbackPrev.total       || 0,
        breakdown:     feedbackBreakdown,
      },
      bookings: {
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
      },
    });
  } catch (err) {
    console.error("[GET /exports/analytics]", err.message);
    res.status(500).json({ message:"Failed to fetch analytics" });
  }
});

export default router;
