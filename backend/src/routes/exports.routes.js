import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import ExcelJS from "exceljs";

const router = express.Router();

router.use(express.json());
router.use(authenticate);

/* ======================================================
   UTILITY FUNCTIONS
====================================================== */
const getCompanyId = (user) => user?.company_id || user?.companyId;

const formatDate = (date) => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  } catch { return "-"; }
};

const formatDateTime = (datetime) => {
  if (!datetime) return "-";
  try {
    return new Date(datetime).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
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

/* ======================================================
   EXCEL GENERATORS
====================================================== */
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
          top: { style: "thin", color: { argb: "FFcccccc" } },
          left: { style: "thin", color: { argb: "FFcccccc" } },
          bottom: { style: "thin", color: { argb: "FFcccccc" } },
          right: { style: "thin", color: { argb: "FFcccccc" } },
        };
      });
    }
  });
};

const generateVisitorsExcel = async (companyId, companyName) => {
  const [visitors] = await db.query(
    `SELECT visitor_code, name, phone, email, from_company, department, designation,
      address, city, state, postal_code, country, person_to_meet, purpose,
      belongings, id_type, id_number, check_in, check_out, status, visit_status
     FROM visitors WHERE company_id = ? ORDER BY check_in DESC`,
    [companyId]
  );

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Visitors");
  ws.properties.defaultRowHeight = 20;

  ws.mergeCells("A1:U1");
  applyHeaderStyle(ws.getCell("A1"));
  ws.getCell("A1").value = `${companyName} - Visitor Records`;
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:U2");
  ws.getCell("A2").value = `Generated on: ${formatDateTime(new Date())} | Total Visitors: ${visitors.length}`;
  ws.getCell("A2").font = { size: 11, italic: true };
  ws.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 20;
  ws.addRow([]);

  const headerRow = ws.addRow([
    "Visitor Code", "Name", "Phone", "Email", "From Company", "Department", "Designation",
    "Address", "City", "State", "Postal Code", "Country", "Person to Meet", "Purpose",
    "Belongings", "ID Type", "ID Number", "Check In", "Check Out", "Status", "Visit Status",
  ]);
  applyColumnHeader(headerRow);

  ws.columns = [
    { width: 15 }, { width: 25 }, { width: 15 }, { width: 30 }, { width: 25 },
    { width: 20 }, { width: 20 }, { width: 35 }, { width: 15 }, { width: 15 },
    { width: 12 }, { width: 15 }, { width: 25 }, { width: 35 }, { width: 25 },
    { width: 15 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 10 }, { width: 14 },
  ];

  visitors.forEach((v, i) => {
    const row = ws.addRow([
      v.visitor_code || "-", v.name || "-", v.phone || "-", v.email || "-",
      v.from_company || "-", v.department || "-", v.designation || "-",
      v.address || "-", v.city || "-", v.state || "-", v.postal_code || "-",
      v.country || "-", v.person_to_meet || "-", v.purpose || "-",
      v.belongings || "-", v.id_type || "-", v.id_number || "-",
      formatDateTime(v.check_in), v.check_out ? formatDateTime(v.check_out) : "Still In",
      v.status || "-", v.visit_status || "pending",
    ]);
    if (i % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    row.getCell(20).alignment = { horizontal: "center" };
    if (v.status === "IN") row.getCell(20).font = { bold: true, color: { argb: "FF00c853" } };
    else if (v.status === "OUT") row.getCell(20).font = { bold: true, color: { argb: "FFff1744" } };
    row.getCell(21).alignment = { horizontal: "center" };
    const vsColors = { accepted: "FF00c853", declined: "FFff1744", pending: "FFf0a500", checked_out: "FF6200d6" };
    if (vsColors[v.visit_status]) row.getCell(21).font = { bold: true, color: { argb: vsColors[v.visit_status] } };
  });

  applyBorders(ws);
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
  return workbook;
};

const generateConferenceBookingsExcel = async (companyId, companyName) => {
  const [bookings] = await db.query(
    `SELECT b.booked_by, b.department, b.purpose, b.booking_date,
      b.start_time, b.end_time, b.status, r.room_name
     FROM conference_bookings b
     JOIN conference_rooms r ON b.room_id = r.id
     WHERE b.company_id = ? ORDER BY b.booking_date DESC, b.start_time DESC`,
    [companyId]
  );

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Conference Bookings");
  ws.properties.defaultRowHeight = 20;

  ws.mergeCells("A1:H1");
  applyHeaderStyle(ws.getCell("A1"));
  ws.getCell("A1").value = `${companyName} - Conference Room Bookings`;
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:H2");
  ws.getCell("A2").value = `Generated on: ${formatDateTime(new Date())} | Total Bookings: ${bookings.length}`;
  ws.getCell("A2").font = { size: 11, italic: true };
  ws.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
  ws.addRow([]);

  const headerRow = ws.addRow(["Room Name", "Booked By", "Department", "Purpose", "Booking Date", "Start Time", "End Time", "Status"]);
  applyColumnHeader(headerRow);

  ws.columns = [{ width: 25 }, { width: 25 }, { width: 20 }, { width: 35 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }];

  bookings.forEach((b, i) => {
    const row = ws.addRow([
      b.room_name || "-", b.booked_by || "-", b.department || "-", b.purpose || "-",
      formatDate(b.booking_date), formatTime(b.start_time), formatTime(b.end_time), b.status || "-",
    ]);
    if (i % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    row.getCell(8).alignment = { horizontal: "center" };
    if (b.status === "BOOKED") row.getCell(8).font = { bold: true, color: { argb: "FF00c853" } };
    else if (b.status === "CANCELLED") row.getCell(8).font = { bold: true, color: { argb: "FFff1744" } };
  });

  applyBorders(ws);
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
  return workbook;
};

const generateCombinedExcel = async (companyId, companyName) => {
  const wb1 = await generateVisitorsExcel(companyId, companyName);
  const wb2 = await generateConferenceBookingsExcel(companyId, companyName);
  const combined = new ExcelJS.Workbook();

  for (const ws of wb1.worksheets) {
    const newWs = combined.addWorksheet(ws.name);
    ws.eachRow((row, rn) => {
      const newRow = newWs.getRow(rn);
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
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

  for (const ws of wb2.worksheets) {
    const newWs = combined.addWorksheet(ws.name);
    ws.eachRow((row, rn) => {
      const newRow = newWs.getRow(rn);
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
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

  return combined;
};

/* ======================================================
   DOWNLOAD ROUTES
====================================================== */
router.get("/visitors", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[company]] = await db.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (!company) return res.status(404).json({ message: "Company not found" });
    const workbook = await generateVisitorsExcel(companyId, company.name);
    const fileName = `${company.name.replace(/[^a-z0-9]/gi, "-")}-visitors-${Date.now()}.xlsx`;
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
    const workbook = await generateConferenceBookingsExcel(companyId, company.name);
    const fileName = `${company.name.replace(/[^a-z0-9]/gi, "-")}-bookings-${Date.now()}.xlsx`;
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
    const workbook = await generateCombinedExcel(companyId, company.name);
    const fileName = `${company.name.replace(/[^a-z0-9]/gi, "-")}-complete-report-${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/all]", err.message);
    res.status(500).json({ message: "Failed to export complete report" });
  }
});

/* ======================================================
   STATS — basic counts
====================================================== */
router.get("/stats", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);
    const [[visitors]]        = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ?`, [companyId]);
    const [[bookings]]        = await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`, [companyId]);
    const [[activeVisitors]]  = await db.query(`SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? AND status = 'IN'`, [companyId]);
    const [[upcomingBookings]]= await db.query(`SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? AND booking_date >= CURDATE() AND status = 'BOOKED'`, [companyId]);

    res.json({
      visitors: { total: visitors.total, active: activeVisitors.total },
      bookings: { total: bookings.total, upcoming: upcomingBookings.total },
    });
  } catch (err) {
    console.error("[GET /exports/stats]", err.message);
    res.status(500).json({ message: "Failed to fetch export statistics" });
  }
});

/* ======================================================
   ANALYTICS — full analytics for reports page
   GET /api/exports/analytics
====================================================== */
router.get("/analytics", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    /* ── Visitor: daily trend last 30 days ── */
    const [dailyVisitors] = await db.query(
      `SELECT DATE(check_in) AS date, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ?
         AND check_in >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(check_in)
       ORDER BY date ASC`,
      [companyId]
    );

    /* ── Visitor: top employees being visited ── */
    const [topEmployees] = await db.query(
      `SELECT person_to_meet AS name, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? AND person_to_meet IS NOT NULL AND person_to_meet != ''
       GROUP BY person_to_meet
       ORDER BY count DESC
       LIMIT 8`,
      [companyId]
    );

    /* ── Visitor: most common purposes ── */
    const [topPurposes] = await db.query(
      `SELECT purpose AS name, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ? AND purpose IS NOT NULL AND purpose != ''
       GROUP BY purpose
       ORDER BY count DESC
       LIMIT 6`,
      [companyId]
    );

    /* ── Visitor: visit_status breakdown ── */
    const [visitStatusBreakdown] = await db.query(
      `SELECT visit_status AS status, COUNT(*) AS count
       FROM visitors
       WHERE company_id = ?
       GROUP BY visit_status`,
      [companyId]
    );

    /* ── Visitor: summary totals ── */
    const [[visitorTotals]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'IN') AS active,
         SUM(DATE(check_in) = CURDATE()) AS today
       FROM visitors
       WHERE company_id = ?`,
      [companyId]
    );

    /* ── Conference: daily booking trend last 30 days ── */
    const [dailyBookings] = await db.query(
      `SELECT booking_date AS date, COUNT(*) AS count
       FROM conference_bookings
       WHERE company_id = ?
         AND booking_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY booking_date
       ORDER BY date ASC`,
      [companyId]
    );

    /* ── Conference: booking status breakdown ── */
    const [bookingStatusBreakdown] = await db.query(
      `SELECT status, COUNT(*) AS count
       FROM conference_bookings
       WHERE company_id = ?
       GROUP BY status`,
      [companyId]
    );

    /* ── Conference: most booked rooms ── */
    const [topRooms] = await db.query(
      `SELECT r.room_name AS name, COUNT(*) AS count
       FROM conference_bookings b
       JOIN conference_rooms r ON b.room_id = r.id
       WHERE b.company_id = ?
       GROUP BY r.room_name
       ORDER BY count DESC
       LIMIT 6`,
      [companyId]
    );

    /* ── Conference: bookings by department ── */
    const [bookingsByDept] = await db.query(
      `SELECT department AS name, COUNT(*) AS count
       FROM conference_bookings
       WHERE company_id = ? AND department IS NOT NULL AND department != ''
       GROUP BY department
       ORDER BY count DESC
       LIMIT 6`,
      [companyId]
    );

    /* ── Conference: summary totals ── */
    const [[bookingTotals]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'BOOKED' AND booking_date >= CURDATE()) AS upcoming,
         SUM(status = 'CANCELLED') AS cancelled
       FROM conference_bookings
       WHERE company_id = ?`,
      [companyId]
    );

    res.json({
      visitors: {
        total:    visitorTotals.total   || 0,
        active:   visitorTotals.active  || 0,
        today:    visitorTotals.today   || 0,
        dailyTrend:       dailyVisitors,
        topEmployees:     topEmployees,
        topPurposes:      topPurposes,
        visitStatusBreakdown,
      },
      bookings: {
        total:     bookingTotals.total     || 0,
        upcoming:  bookingTotals.upcoming  || 0,
        cancelled: bookingTotals.cancelled || 0,
        dailyTrend:           dailyBookings,
        statusBreakdown:      bookingStatusBreakdown,
        topRooms:             topRooms,
        byDepartment:         bookingsByDept,
      },
    });
  } catch (err) {
    console.error("[GET /exports/analytics]", err.message);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default router;
