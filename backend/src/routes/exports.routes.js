import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import ExcelJS from "exceljs";

const router = express.Router();
router.use(express.json());
router.use(authenticate);

/* ═══════════════════════════════════════════════════════════════
   UTILITY — company id helper
═══════════════════════════════════════════════════════════════ */
const getCompanyId = (user) => user?.company_id || user?.companyId;

/* ═══════════════════════════════════════════════════════════════
   UTILITY — period → IST date range
   All timestamps are stored as UTC.
   CONVERT_TZ converts to IST for date-boundary comparisons.
   Returns { from, to } as UTC datetime strings that bracket the
   requested IST period, plus a { groupBy, labelFmt } hint for
   SQL GROUP BY expressions.
═══════════════════════════════════════════════════════════════ */
const getPeriodRange = (period = "month") => {
  // We build the range in SQL-friendly UTC by shifting IST boundaries back 5h30m.
  // Easier: we let MySQL handle it via DATE_SUB / CURDATE in IST context.
  // We return raw SQL fragments so queries stay fully parameterised.
  const ranges = {
    today:   { interval: "0 DAY",    groupBy: "HOUR(CONVERT_TZ(check_in,'+00:00','+05:30'))",       labelFmt: "%H:00" },
    week:    { interval: "6 DAY",    groupBy: "DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))",        labelFmt: "%Y-%m-%d" },
    month:   { interval: "29 DAY",   groupBy: "DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))",        labelFmt: "%Y-%m-%d" },
    quarter: { interval: "89 DAY",   groupBy: "YEARWEEK(CONVERT_TZ(check_in,'+00:00','+05:30'),1)",  labelFmt: "%Y-W%u" },
    year:    { interval: "364 DAY",  groupBy: "MONTH(CONVERT_TZ(check_in,'+00:00','+05:30'))",       labelFmt: "%Y-%m" },
  };
  return ranges[period] || ranges.month;
};

// Same but for booking_date (DATE column, no timezone needed)
const getBookingPeriodRange = (period = "month") => {
  const ranges = {
    today:   { interval: "0 DAY",   groupBy: "booking_date",                   labelFmt: "%Y-%m-%d" },
    week:    { interval: "6 DAY",   groupBy: "booking_date",                   labelFmt: "%Y-%m-%d" },
    month:   { interval: "29 DAY",  groupBy: "booking_date",                   labelFmt: "%Y-%m-%d" },
    quarter: { interval: "89 DAY",  groupBy: "YEARWEEK(booking_date, 1)",      labelFmt: "%Y-W%u" },
    year:    { interval: "364 DAY", groupBy: "MONTH(booking_date)",            labelFmt: "%Y-%m" },
  };
  return ranges[period] || ranges.month;
};

/* ═══════════════════════════════════════════════════════════════
   EXCEL HELPERS  (unchanged from original)
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

const applyHeaderStyle = (cell, bgColor = "FF6a1b9a") => {
  cell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
};
const applyColumnHeader = (row) => {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7a00ff" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 25;
};
const applyBorders = (worksheet) => {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      row.eachCell((cell) => {
        cell.border = {
          top:    { style: "thin", color: { argb: "FFcccccc" } },
          left:   { style: "thin", color: { argb: "FFcccccc" } },
          bottom: { style: "thin", color: { argb: "FFcccccc" } },
          right:  { style: "thin", color: { argb: "FFcccccc" } },
        };
      });
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   EXCEL GENERATORS  — now accept optional dateFilter SQL fragment
   dateFilter is a pre-built SQL snippet: "AND check_in >= ... "
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

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Visitors");
  ws.properties.defaultRowHeight = 20;

  // Define columns BEFORE any addRow/getCell calls.
  // NEVER use mergeCells — ExcelJS copies the cell value into every cell
  // of the merged range, which causes the title to repeat across all columns.
  // Solution: write the value only to A1/A2, leave adjacent cells empty.
  ws.columns = [
    {width:15},{width:25},{width:15},{width:30},{width:25},{width:20},{width:20},
    {width:35},{width:15},{width:15},{width:12},{width:15},{width:25},{width:35},
    {width:25},{width:15},{width:20},{width:22},{width:22},{width:10},{width:14},
  ];

  // Row 1 — title in A1 only (no merge)
  ws.addRow([`${companyName} — Visitor Records (${periodLabel})`]);
  applyHeaderStyle(ws.getCell("A1"), "FF4c1d95");
  ws.getRow(1).height = 32;

  // Row 2 — meta in A2 only (no merge)
  ws.addRow([`Generated: ${formatDateTime(new Date())}   |   Total Records: ${visitors.length}`]);
  ws.getCell("A2").font      = { size:11, italic:true, color:{ argb:"FF5a5a8a" } };
  ws.getCell("A2").alignment = { vertical:"middle", horizontal:"left" };
  ws.getRow(2).height = 20;

  // Row 3 — blank spacer
  ws.addRow([]);

  // Row 4 — column headers
  const headerRow = ws.addRow([
    "Visitor Code","Name","Phone","Email","From Company","Department","Designation",
    "Address","City","State","Postal Code","Country","Person to Meet","Purpose",
    "Belongings","ID Type","ID Number","Check In","Check Out","Status","Visit Status",
  ]);
  applyColumnHeader(headerRow);

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
    if (i % 2 === 0) row.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF5F5F5" } };
    row.getCell(20).alignment = { horizontal:"center" };
    if (v.status === "IN")  row.getCell(20).font = { bold:true, color:{ argb:"FF00c853" } };
    if (v.status === "OUT") row.getCell(20).font = { bold:true, color:{ argb:"FFff1744" } };
    row.getCell(21).alignment = { horizontal:"center" };
    const vsColors = { accepted:"FF00c853", declined:"FFff1744", pending:"FFf0a500", checked_out:"FF6200d6" };
    if (vsColors[v.visit_status]) row.getCell(21).font = { bold:true, color:{ argb:vsColors[v.visit_status] } };
  });

  applyBorders(ws);
  ws.views = [{ state:"frozen", xSplit:0, ySplit:4 }];
  return workbook;
};

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

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Conference Bookings");
  ws.properties.defaultRowHeight = 20;

  // Define columns FIRST. No mergeCells — it repeats the value across every cell.
  ws.columns = [
    {width:28},{width:28},{width:22},{width:38},{width:16},{width:14},{width:14},{width:14},
  ];

  // Row 1 — title in A1 only (no merge)
  ws.addRow([`${companyName} — Conference Bookings (${periodLabel})`]);
  applyHeaderStyle(ws.getCell("A1"), "FF1e3a5f");
  ws.getRow(1).height = 32;

  // Row 2 — meta in A2 only (no merge)
  ws.addRow([`Generated: ${formatDateTime(new Date())}   |   Total Records: ${bookings.length}`]);
  ws.getCell("A2").font      = { size:11, italic:true, color:{ argb:"FF5a5a8a" } };
  ws.getCell("A2").alignment = { vertical:"middle", horizontal:"left" };
  ws.getRow(2).height = 20;

  // Row 3 — blank spacer
  ws.addRow([]);

  // Row 4 — column headers
  const headerRow = ws.addRow(["Room Name","Booked By","Department","Purpose","Booking Date","Start Time","End Time","Status"]);
  applyColumnHeader(headerRow);

  bookings.forEach((b, i) => {
    const row = ws.addRow([
      b.room_name||"-", b.booked_by||"-", b.department||"-", b.purpose||"-",
      formatDate(b.booking_date), formatTime(b.start_time), formatTime(b.end_time), b.status||"-",
    ]);
    if (i % 2 === 0) row.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF5F5F5" } };
    row.getCell(8).alignment = { horizontal:"center" };
    if (b.status === "BOOKED")    row.getCell(8).font = { bold:true, color:{ argb:"FF00c853" } };
    if (b.status === "CANCELLED") row.getCell(8).font = { bold:true, color:{ argb:"FFff1744" } };
    if (b.status === "COMPLETED") row.getCell(8).font = { bold:true, color:{ argb:"FF0ea5e9" } };
  });

  applyBorders(ws);
  ws.views = [{ state:"frozen", xSplit:0, ySplit:4 }];
  return workbook;
};

const generateCombinedExcel = async (companyId, companyName, periodLabel, extraWhereV, extraParamsV, extraWhereB, extraParamsB) => {
  const wb1 = await generateVisitorsExcel(companyId, companyName, periodLabel, extraWhereV, extraParamsV);
  const wb2 = await generateConferenceBookingsExcel(companyId, companyName, periodLabel, extraWhereB, extraParamsB);
  const combined = new ExcelJS.Workbook();

  for (const wb of [wb1, wb2]) {
    for (const ws of wb.worksheets) {
      const newWs = combined.addWorksheet(ws.name);
      ws.eachRow((row, rn) => {
        const newRow = newWs.getRow(rn);
        row.eachCell({ includeEmpty:true }, (cell, cn) => {
          const newCell = newRow.getCell(cn);
          newCell.value = cell.value;
          if (cell.style) newCell.style = JSON.parse(JSON.stringify(cell.style));
        });
        newRow.height = row.height;
        newRow.commit();
      });
      newWs.columns = ws.columns.map(c => ({ width: c.width }));
      newWs.views = ws.views;
    }
  }
  return combined;
};

/* ═══════════════════════════════════════════════════════════════
   PERIOD HELPER — build WHERE clause + params for visitor queries
   visitors use DATETIME check_in stored as UTC
═══════════════════════════════════════════════════════════════ */
const visitorPeriodWhere = (period) => {
  if (!period || period === "all") return { where: "", params: [], label: "All Time" };
  const labels = { today:"Today", week:"This Week", month:"This Month", quarter:"This Quarter", year:"This Year" };
  const intervals = { today:"0 DAY", week:"6 DAY", month:"29 DAY", quarter:"89 DAY", year:"364 DAY" };
  const iv = intervals[period];
  if (!iv) return { where: "", params: [], label: "All Time" };
  // Compare IST date of check_in against IST "today minus interval"
  const where = `AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) >= DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv}`;
  return { where, params: [], label: labels[period] || "Custom" };
};

// bookings use DATE column booking_date — no timezone needed
const bookingPeriodWhere = (period) => {
  if (!period || period === "all") return { where: "", params: [], label: "All Time" };
  const intervals = { today:"0 DAY", week:"6 DAY", month:"29 DAY", quarter:"89 DAY", year:"364 DAY" };
  const iv = intervals[period];
  if (!iv) return { where: "", params: [], label: "All Time" };
  const where = `AND booking_date >= CURDATE() - INTERVAL ${iv}`;
  return { where, params: [] };
};

/* ═══════════════════════════════════════════════════════════════
   DOWNLOAD ROUTES  — all support ?period=today|week|month|quarter|year
═══════════════════════════════════════════════════════════════ */
router.get("/visitors", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const { where, params, label } = visitorPeriodWhere(req.query.period);
    const workbook = await generateVisitorsExcel(companyId, company.name, label, where, params);
    const fileName = `${company.name.replace(/[^a-z0-9]/gi,"-")}-visitors-${req.query.period||"all"}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/visitors]", err.message);
    res.status(500).json({ message: "Failed to export visitors data" });
  }
});

router.get("/conference-bookings", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const { where, params, label } = bookingPeriodWhere(req.query.period);
    const workbook = await generateConferenceBookingsExcel(companyId, company.name, label || "All Time", where, params);
    const fileName = `${company.name.replace(/[^a-z0-9]/gi,"-")}-bookings-${req.query.period||"all"}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/conference-bookings]", err.message);
    res.status(500).json({ message: "Failed to export bookings data" });
  }
});

router.get("/all", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const vPeriod = visitorPeriodWhere(req.query.period);
    const bPeriod = bookingPeriodWhere(req.query.period);
    const workbook = await generateCombinedExcel(
      companyId, company.name, vPeriod.label || "All Time",
      vPeriod.where, vPeriod.params,
      bPeriod.where, bPeriod.params
    );
    const fileName = `${company.name.replace(/[^a-z0-9]/gi,"-")}-complete-report-${req.query.period||"all"}-${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/all]", err.message);
    res.status(500).json({ message: "Failed to export complete report" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STATS — basic counts (unchanged)
═══════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[visitors]]         = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ?`, [companyId]);
    const [[bookings]]         = await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`, [companyId]);
    const [[activeVisitors]]   = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? AND status = 'IN'`, [companyId]);
    const [[upcomingBookings]] = await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? AND booking_date >= CURDATE() AND status = 'BOOKED'`, [companyId]);
    res.json({
      visitors: { total: visitors.total, active: activeVisitors.total },
      bookings: { total: bookings.total, upcoming: upcomingBookings.total },
    });
  } catch (err) {
    console.error("[GET /exports/stats]", err.message);
    res.status(500).json({ message: "Failed to fetch export statistics" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS — full analytics with period filtering
   GET /api/exports/analytics?period=today|week|month|quarter|year
═══════════════════════════════════════════════════════════════ */
router.get("/analytics", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const period    = req.query.period || "month";

    // ── Date range SQL fragments ──────────────────────────────
    // Visitor: check_in stored UTC, compare in IST
    const periodIntervals = {
      today:   "0 DAY",
      week:    "6 DAY",
      month:   "29 DAY",
      quarter: "89 DAY",
      year:    "364 DAY",
    };
    const iv = periodIntervals[period] || "29 DAY";

    // Visitor date filter (UTC stored, IST compared)
    const vWhere = `AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) >=
                       DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv}`;

    // Booking date filter (DATE column, no TZ conversion)
    const bWhere = `AND booking_date >= CURDATE() - INTERVAL ${iv}`;

    // Previous period filter for WoW/MoM comparison
    const prevIv = iv; // same length, shifted back
    const vWherePrev = `AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) >= DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv} - INTERVAL ${iv}
                        AND DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) <  DATE(CONVERT_TZ(NOW(),'+00:00','+05:30')) - INTERVAL ${iv}`;
    const bWherePrev = `AND booking_date >= CURDATE() - INTERVAL ${iv} - INTERVAL ${iv}
                        AND booking_date <  CURDATE() - INTERVAL ${iv}`;

    // ── GROUP BY expression depends on period ─────────────────
    const vGroup = {
      today:   "HOUR(CONVERT_TZ(check_in,'+00:00','+05:30'))",
      week:    "DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))",
      month:   "DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))",
      quarter: "YEARWEEK(CONVERT_TZ(check_in,'+00:00','+05:30'),3)",
      year:    "MONTH(CONVERT_TZ(check_in,'+00:00','+05:30'))",
    }[period] || "DATE(CONVERT_TZ(check_in,'+00:00','+05:30'))";

    // All label expressions MUST use MIN() so every SELECT item is an aggregate.
    // MySQL only_full_group_by rejects non-aggregated columns that aren't in GROUP BY.
    const vLabel = {
      today:   "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%H:00')",
      week:    "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%Y-%m-%d')",
      month:   "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%Y-%m-%d')",
      quarter: "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%d %b')",
      year:    "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%b %Y')",
    }[period] || "DATE_FORMAT(MIN(CONVERT_TZ(check_in,'+00:00','+05:30')),'%Y-%m-%d')";

    const bGroup = {
      today:   "booking_date",
      week:    "booking_date",
      month:   "booking_date",
      quarter: "YEARWEEK(booking_date,3)",
      year:    "MONTH(booking_date)",
    }[period] || "booking_date";

    const bLabel = {
      today:   "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      week:    "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      month:   "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')",
      quarter: "DATE_FORMAT(MIN(booking_date),'%d %b')",
      year:    "DATE_FORMAT(MIN(booking_date),'%b %Y')",
    }[period] || "DATE_FORMAT(MIN(booking_date),'%Y-%m-%d')";

    /* ── VISITOR QUERIES ── */

    // Trend
    const [dailyVisitors] = await db.query(
      `SELECT ${vLabel} AS date, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? ${vWhere}
       GROUP BY ${vGroup}
       ORDER BY MIN(check_in) ASC`,
      [companyId]
    );

    // Hourly distribution (all period)
    const [hourlyVisitors] = await db.query(
      `SELECT HOUR(CONVERT_TZ(check_in,'+00:00','+05:30')) AS hour, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? ${vWhere}
       GROUP BY hour
       ORDER BY hour ASC`,
      [companyId]
    );

    // Day-of-week distribution
    const [dowVisitors] = await db.query(
      `SELECT DAYOFWEEK(CONVERT_TZ(check_in,'+00:00','+05:30')) AS dow, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? ${vWhere}
       GROUP BY dow
       ORDER BY dow ASC`,
      [companyId]
    );

    // Top employees
    const [topEmployees] = await db.query(
      `SELECT person_to_meet AS name, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? AND person_to_meet IS NOT NULL AND person_to_meet != '' ${vWhere}
       GROUP BY person_to_meet
       ORDER BY count DESC LIMIT 8`,
      [companyId]
    );

    // Top purposes
    const [topPurposes] = await db.query(
      `SELECT purpose AS name, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? AND purpose IS NOT NULL AND purpose != '' ${vWhere}
       GROUP BY purpose
       ORDER BY count DESC LIMIT 6`,
      [companyId]
    );

    // Status breakdown
    const [visitStatusBreakdown] = await db.query(
      `SELECT visit_status AS status, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? ${vWhere}
       GROUP BY visit_status`,
      [companyId]
    );

    // Summary totals (current period)
    const [[visitorTotals]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'IN')  AS active,
         SUM(DATE(CONVERT_TZ(check_in,'+00:00','+05:30')) = DATE(CONVERT_TZ(NOW(),'+00:00','+05:30'))) AS today,
         SUM(pass_mail_sent > 0) AS passIssued
       FROM visitors
       WHERE company_id = ? ${vWhere}`,
      [companyId]
    );

    // Previous period totals (for % change)
    const [[visitorPrev]] = await db.query(
      `SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? ${vWherePrev}`,
      [companyId]
    );

    /* ── CONFERENCE QUERIES ── */

    // Trend
    const [dailyBookings] = await db.query(
      `SELECT ${bLabel} AS date, COUNT(*) AS count
       FROM conference_bookings
       WHERE company_id = ? ${bWhere}
       GROUP BY ${bGroup}
       ORDER BY MIN(booking_date) ASC`,
      [companyId]
    );

    // Status breakdown
    const [bookingStatusBreakdown] = await db.query(
      `SELECT status, COUNT(*) AS count
       FROM conference_bookings
       WHERE company_id = ? ${bWhere}
       GROUP BY status`,
      [companyId]
    );

    // Top rooms
    const [topRooms] = await db.query(
      `SELECT r.room_name AS name, COUNT(*) AS count
       FROM conference_bookings b
       JOIN conference_rooms r ON b.room_id = r.id
       WHERE b.company_id = ? ${bWhere}
       GROUP BY r.room_name
       ORDER BY count DESC LIMIT 6`,
      [companyId]
    );

    // By department
    const [bookingsByDept] = await db.query(
      `SELECT department AS name, COUNT(*) AS count
       FROM conference_bookings
       WHERE company_id = ? AND department IS NOT NULL AND department != '' ${bWhere}
       GROUP BY department
       ORDER BY count DESC LIMIT 6`,
      [companyId]
    );

    // Day-of-week distribution for bookings
    const [dowBookings] = await db.query(
      `SELECT DAYOFWEEK(booking_date) AS dow, COUNT(*) AS count
       FROM conference_bookings
       WHERE company_id = ? ${bWhere}
       GROUP BY dow
       ORDER BY dow ASC`,
      [companyId]
    );

    // Average duration (minutes) per booking
    const [[avgDuration]] = await db.query(
      `SELECT ROUND(AVG(TIME_TO_SEC(TIMEDIFF(end_time, start_time)) / 60)) AS avgMinutes
       FROM conference_bookings
       WHERE company_id = ? AND end_time > start_time ${bWhere}`,
      [companyId]
    );

    // Summary totals (current period)  — FIX: added completed count (was missing)
    const [[bookingTotals]] = await db.query(
      `SELECT
         COUNT(*)                                               AS total,
         SUM(status = 'BOOKED' AND booking_date >= CURDATE())  AS upcoming,
         SUM(status = 'CANCELLED')                             AS cancelled,
         SUM(status = 'COMPLETED')                             AS completed
       FROM conference_bookings
       WHERE company_id = ? ${bWhere}`,
      [companyId]
    );

    // Previous period totals for bookings
    const [[bookingPrev]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? ${bWherePrev}`,
      [companyId]
    );

    /* ── RESPONSE ── */
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
      bookings: {
        total:      bookingTotals.total     || 0,
        upcoming:   bookingTotals.upcoming  || 0,
        cancelled:  bookingTotals.cancelled || 0,
        completed:  bookingTotals.completed || 0,
        prevTotal:  bookingPrev.total       || 0,
        avgDurationMinutes: avgDuration.avgMinutes || 0,
        dailyTrend:       dailyBookings,
        statusBreakdown:  bookingStatusBreakdown,
        topRooms,
        byDepartment:     bookingsByDept,
        dowDistribution:  dowBookings,
      },
    });
  } catch (err) {
    console.error("[GET /exports/analytics]", err.message);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default router;
