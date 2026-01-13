import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { db } from "../config/db.js";
import ExcelJS from "exceljs";

const router = express.Router();

/* ======================================================
   MIDDLEWARE
====================================================== */
router.use(express.json());
router.use(authenticate);

/* ======================================================
   UTILITY FUNCTIONS
====================================================== */

const getCompanyId = (user) => user?.company_id || user?.companyId;

/**
 * Format date to readable string
 */
const formatDate = (date) => {
  if (!date) return "-";
  try {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
};

/**
 * Format datetime to readable string
 */
const formatDateTime = (datetime) => {
  if (!datetime) return "-";
  try {
    const d = new Date(datetime);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "-";
  }
};

/**
 * Format time to 12-hour format
 */
const formatTime = (time) => {
  if (!time) return "-";
  try {
    const [h, m] = String(time).split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hr = hour % 12 || 12;
    return `${hr}:${m} ${ampm}`;
  } catch {
    return "-";
  }
};

/* ======================================================
   EXCEL GENERATION FUNCTIONS
====================================================== */

/**
 * Generate Visitors Excel Sheet
 */
const generateVisitorsExcel = async (companyId, companyName) => {
  // Fetch visitors data
  const [visitors] = await db.query(
    `SELECT 
      visitor_code,
      name,
      phone,
      email,
      from_company,
      department,
      designation,
      address,
      city,
      state,
      postal_code,
      country,
      person_to_meet,
      purpose,
      belongings,
      id_type,
      id_number,
      check_in,
      check_out,
      status,
      created_at
    FROM visitors
    WHERE company_id = ?
    ORDER BY check_in DESC`,
    [companyId]
  );

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Visitors");

  // Set worksheet properties
  worksheet.properties.defaultRowHeight = 20;

  // Add company header
  worksheet.mergeCells("A1:U1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `${companyName} - Visitor Records`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6a1b9a" }, // Purple
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 30;

  // Add metadata row
  worksheet.mergeCells("A2:U2");
  const metaCell = worksheet.getCell("A2");
  metaCell.value = `Generated on: ${formatDateTime(new Date())} | Total Visitors: ${visitors.length}`;
  metaCell.font = { size: 11, italic: true };
  metaCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(2).height = 20;

  // Add empty row for spacing
  worksheet.addRow([]);

  // Define column headers
  const headers = [
    "Visitor Code",
    "Name",
    "Phone",
    "Email",
    "From Company",
    "Department",
    "Designation",
    "Address",
    "City",
    "State",
    "Postal Code",
    "Country",
    "Person to Meet",
    "Purpose",
    "Belongings",
    "ID Type",
    "ID Number",
    "Check In",
    "Check Out",
    "Status",
    "Created At",
  ];

  // Add headers row
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7a00ff" }, // Bright purple
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 25;

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // Visitor Code
    { width: 25 }, // Name
    { width: 15 }, // Phone
    { width: 30 }, // Email
    { width: 25 }, // From Company
    { width: 20 }, // Department
    { width: 20 }, // Designation
    { width: 35 }, // Address
    { width: 15 }, // City
    { width: 15 }, // State
    { width: 12 }, // Postal Code
    { width: 15 }, // Country
    { width: 25 }, // Person to Meet
    { width: 35 }, // Purpose
    { width: 25 }, // Belongings
    { width: 15 }, // ID Type
    { width: 20 }, // ID Number
    { width: 20 }, // Check In
    { width: 20 }, // Check Out
    { width: 10 }, // Status
    { width: 20 }, // Created At
  ];

  // Add data rows
  visitors.forEach((visitor, index) => {
    const row = worksheet.addRow([
      visitor.visitor_code || "-",
      visitor.name || "-",
      visitor.phone || "-",
      visitor.email || "-",
      visitor.from_company || "-",
      visitor.department || "-",
      visitor.designation || "-",
      visitor.address || "-",
      visitor.city || "-",
      visitor.state || "-",
      visitor.postal_code || "-",
      visitor.country || "-",
      visitor.person_to_meet || "-",
      visitor.purpose || "-",
      visitor.belongings || "-",
      visitor.id_type || "-",
      visitor.id_number || "-",
      formatDateTime(visitor.check_in),
      visitor.check_out ? formatDateTime(visitor.check_out) : "Still In",
      visitor.status || "-",
      formatDateTime(visitor.created_at),
    ]);

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" }, // Light gray
      };
    }

    // Center align status column
    row.getCell(20).alignment = { horizontal: "center" };

    // Color code status
    if (visitor.status === "IN") {
      row.getCell(20).font = { bold: true, color: { argb: "FF00c853" } }; // Green
    } else if (visitor.status === "OUT") {
      row.getCell(20).font = { bold: true, color: { argb: "FFff1744" } }; // Red
    }
  });

  // Add borders to all cells with data
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      // Start from header row
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

  // Freeze header row
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  return workbook;
};

/**
 * Generate Conference Bookings Excel Sheet
 */
const generateConferenceBookingsExcel = async (companyId, companyName) => {
  // Fetch bookings data
  const [bookings] = await db.query(
    `SELECT 
      b.id,
      b.booked_by,
      b.department,
      b.purpose,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.status,
      b.created_at,
      r.room_name,
      r.room_number,
      r.capacity
    FROM conference_bookings b
    JOIN conference_rooms r ON b.room_id = r.id
    WHERE b.company_id = ?
    ORDER BY b.booking_date DESC, b.start_time DESC`,
    [companyId]
  );

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Conference Bookings");

  // Set worksheet properties
  worksheet.properties.defaultRowHeight = 20;

  // Add company header
  worksheet.mergeCells("A1:L1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `${companyName} - Conference Room Bookings`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6a1b9a" }, // Purple
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 30;

  // Add metadata row
  worksheet.mergeCells("A2:L2");
  const metaCell = worksheet.getCell("A2");
  metaCell.value = `Generated on: ${formatDateTime(new Date())} | Total Bookings: ${bookings.length}`;
  metaCell.font = { size: 11, italic: true };
  metaCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(2).height = 20;

  // Add empty row for spacing
  worksheet.addRow([]);

  // Define column headers
  const headers = [
    "Booking ID",
    "Room Name",
    "Room Number",
    "Room Capacity",
    "Booked By",
    "Department",
    "Purpose",
    "Booking Date",
    "Start Time",
    "End Time",
    "Status",
    "Created At",
  ];

  // Add headers row
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7a00ff" }, // Bright purple
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 25;

  // Set column widths
  worksheet.columns = [
    { width: 12 }, // Booking ID
    { width: 25 }, // Room Name
    { width: 12 }, // Room Number
    { width: 15 }, // Room Capacity
    { width: 25 }, // Booked By
    { width: 20 }, // Department
    { width: 35 }, // Purpose
    { width: 15 }, // Booking Date
    { width: 15 }, // Start Time
    { width: 15 }, // End Time
    { width: 12 }, // Status
    { width: 20 }, // Created At
  ];

  // Add data rows
  bookings.forEach((booking, index) => {
    const row = worksheet.addRow([
      booking.id,
      booking.room_name || "-",
      booking.room_number || "-",
      booking.capacity || "-",
      booking.booked_by || "-",
      booking.department || "-",
      booking.purpose || "-",
      formatDate(booking.booking_date),
      formatTime(booking.start_time),
      formatTime(booking.end_time),
      booking.status || "-",
      formatDateTime(booking.created_at),
    ]);

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" }, // Light gray
      };
    }

    // Center align certain columns
    row.getCell(1).alignment = { horizontal: "center" }; // Booking ID
    row.getCell(3).alignment = { horizontal: "center" }; // Room Number
    row.getCell(4).alignment = { horizontal: "center" }; // Capacity
    row.getCell(11).alignment = { horizontal: "center" }; // Status

    // Color code status
    if (booking.status === "BOOKED") {
      row.getCell(11).font = { bold: true, color: { argb: "FF00c853" } }; // Green
    } else if (booking.status === "CANCELLED") {
      row.getCell(11).font = { bold: true, color: { argb: "FFff1744" } }; // Red
    }
  });

  // Add borders to all cells with data
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      // Start from header row
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

  // Freeze header row
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  return workbook;
};

/**
 * Generate Combined Excel Workbook (Both Sheets)
 */
const generateCombinedExcel = async (companyId, companyName) => {
  // Fetch both datasets
  const [visitors] = await db.query(
    `SELECT 
      visitor_code, name, phone, email, from_company, department, designation,
      address, city, state, postal_code, country, person_to_meet, purpose,
      belongings, id_type, id_number, check_in, check_out, status, created_at
    FROM visitors
    WHERE company_id = ?
    ORDER BY check_in DESC`,
    [companyId]
  );

  const [bookings] = await db.query(
    `SELECT 
      b.id, b.booked_by, b.department, b.purpose, b.booking_date,
      b.start_time, b.end_time, b.status, b.created_at,
      r.room_name, r.room_number, r.capacity
    FROM conference_bookings b
    JOIN conference_rooms r ON b.room_id = r.id
    WHERE b.company_id = ?
    ORDER BY b.booking_date DESC, b.start_time DESC`,
    [companyId]
  );

  // Create workbook
  const workbook = new ExcelJS.Workbook();

  // ===== VISITORS SHEET =====
  const visitorsSheet = workbook.addWorksheet("Visitors");
  visitorsSheet.properties.defaultRowHeight = 20;

  // Visitors: Company header
  visitorsSheet.mergeCells("A1:U1");
  const vTitleCell = visitorsSheet.getCell("A1");
  vTitleCell.value = `${companyName} - Visitor Records`;
  vTitleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  vTitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6a1b9a" },
  };
  vTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  visitorsSheet.getRow(1).height = 30;

  // Visitors: Metadata
  visitorsSheet.mergeCells("A2:U2");
  const vMetaCell = visitorsSheet.getCell("A2");
  vMetaCell.value = `Generated on: ${formatDateTime(new Date())} | Total Visitors: ${visitors.length}`;
  vMetaCell.font = { size: 11, italic: true };
  vMetaCell.alignment = { vertical: "middle", horizontal: "center" };
  visitorsSheet.getRow(2).height = 20;

  visitorsSheet.addRow([]);

  // Visitors: Headers
  const vHeaders = [
    "Visitor Code", "Name", "Phone", "Email", "From Company", "Department", "Designation",
    "Address", "City", "State", "Postal Code", "Country", "Person to Meet", "Purpose",
    "Belongings", "ID Type", "ID Number", "Check In", "Check Out", "Status", "Created At",
  ];

  const vHeaderRow = visitorsSheet.addRow(vHeaders);
  vHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  vHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7a00ff" } };
  vHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  vHeaderRow.height = 25;

  // Visitors: Column widths
  visitorsSheet.columns = [
    { width: 15 }, { width: 25 }, { width: 15 }, { width: 30 }, { width: 25 },
    { width: 20 }, { width: 20 }, { width: 35 }, { width: 15 }, { width: 15 },
    { width: 12 }, { width: 15 }, { width: 25 }, { width: 35 }, { width: 25 },
    { width: 15 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 10 }, { width: 20 },
  ];

  // Visitors: Data rows
  visitors.forEach((visitor, index) => {
    const row = visitorsSheet.addRow([
      visitor.visitor_code || "-", visitor.name || "-", visitor.phone || "-",
      visitor.email || "-", visitor.from_company || "-", visitor.department || "-",
      visitor.designation || "-", visitor.address || "-", visitor.city || "-",
      visitor.state || "-", visitor.postal_code || "-", visitor.country || "-",
      visitor.person_to_meet || "-", visitor.purpose || "-", visitor.belongings || "-",
      visitor.id_type || "-", visitor.id_number || "-", formatDateTime(visitor.check_in),
      visitor.check_out ? formatDateTime(visitor.check_out) : "Still In",
      visitor.status || "-", formatDateTime(visitor.created_at),
    ]);

    if (index % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    }

    row.getCell(20).alignment = { horizontal: "center" };
    if (visitor.status === "IN") {
      row.getCell(20).font = { bold: true, color: { argb: "FF00c853" } };
    } else if (visitor.status === "OUT") {
      row.getCell(20).font = { bold: true, color: { argb: "FFff1744" } };
    }
  });

  // Visitors: Borders
  visitorsSheet.eachRow((row, rowNumber) => {
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

  visitorsSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  // ===== CONFERENCE BOOKINGS SHEET =====
  const bookingsSheet = workbook.addWorksheet("Conference Bookings");
  bookingsSheet.properties.defaultRowHeight = 20;

  // Bookings: Company header
  bookingsSheet.mergeCells("A1:L1");
  const bTitleCell = bookingsSheet.getCell("A1");
  bTitleCell.value = `${companyName} - Conference Room Bookings`;
  bTitleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  bTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6a1b9a" } };
  bTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  bookingsSheet.getRow(1).height = 30;

  // Bookings: Metadata
  bookingsSheet.mergeCells("A2:L2");
  const bMetaCell = bookingsSheet.getCell("A2");
  bMetaCell.value = `Generated on: ${formatDateTime(new Date())} | Total Bookings: ${bookings.length}`;
  bMetaCell.font = { size: 11, italic: true };
  bMetaCell.alignment = { vertical: "middle", horizontal: "center" };
  bookingsSheet.getRow(2).height = 20;

  bookingsSheet.addRow([]);

  // Bookings: Headers
  const bHeaders = [
    "Booking ID", "Room Name", "Room Number", "Room Capacity", "Booked By",
    "Department", "Purpose", "Booking Date", "Start Time", "End Time", "Status", "Created At",
  ];

  const bHeaderRow = bookingsSheet.addRow(bHeaders);
  bHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  bHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7a00ff" } };
  bHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  bHeaderRow.height = 25;

  // Bookings: Column widths
  bookingsSheet.columns = [
    { width: 12 }, { width: 25 }, { width: 12 }, { width: 15 }, { width: 25 },
    { width: 20 }, { width: 35 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 12 }, { width: 20 },
  ];

  // Bookings: Data rows
  bookings.forEach((booking, index) => {
    const row = bookingsSheet.addRow([
      booking.id, booking.room_name || "-", booking.room_number || "-",
      booking.capacity || "-", booking.booked_by || "-", booking.department || "-",
      booking.purpose || "-", formatDate(booking.booking_date),
      formatTime(booking.start_time), formatTime(booking.end_time),
      booking.status || "-", formatDateTime(booking.created_at),
    ]);

    if (index % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    }

    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(3).alignment = { horizontal: "center" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(11).alignment = { horizontal: "center" };

    if (booking.status === "BOOKED") {
      row.getCell(11).font = { bold: true, color: { argb: "FF00c853" } };
    } else if (booking.status === "CANCELLED") {
      row.getCell(11).font = { bold: true, color: { argb: "FFff1744" } };
    }
  });

  // Bookings: Borders
  bookingsSheet.eachRow((row, rowNumber) => {
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

  bookingsSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  return workbook;
};

/* ======================================================
   API ROUTES
====================================================== */

/**
 * GET /api/exports/visitors
 * Download visitors data as Excel
 */
router.get("/visitors", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    // Get company info
    const [[company]] = await db.query(
      `SELECT name FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Generate Excel workbook
    const workbook = await generateVisitorsExcel(companyId, company.name);

    // Set response headers
    const fileName = `${company.name.replace(/[^a-z0-9]/gi, "-")}-visitors-${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/visitors]", err.message);
    res.status(500).json({ message: "Failed to export visitors data" });
  }
});

/**
 * GET /api/exports/conference-bookings
 * Download conference bookings data as Excel
 */
router.get("/conference-bookings", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    // Get company info
    const [[company]] = await db.query(
      `SELECT name FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Generate Excel workbook
    const workbook = await generateConferenceBookingsExcel(
      companyId,
      company.name
    );

    // Set response headers
    const fileName = `${company.name.replace(/[^a-z0-9]/gi, "-")}-bookings-${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/conference-bookings]", err.message);
    res.status(500).json({ message: "Failed to export bookings data" });
  }
});

/**
 * GET /api/exports/all
 * Download both visitors and conference bookings in single Excel file
 */
router.get("/all", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    // Get company info
    const [[company]] = await db.query(
      `SELECT name FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Generate combined Excel workbook
    const workbook = await generateCombinedExcel(companyId, company.name);

    // Set response headers
    const fileName = `${company.name.replace(/[^a-z0-9]/gi, "-")}-complete-report-${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[GET /exports/all]", err.message);
    res.status(500).json({ message: "Failed to export complete report" });
  }
});

/**
 * GET /api/exports/stats
 * Get export statistics (counts) without downloading
 */
router.get("/stats", async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    const [[visitors]] = await db.query(
      `SELECT COUNT(*) AS total FROM visitors WHERE company_id = ?`,
      [companyId]
    );

    const [[bookings]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ?`,
      [companyId]
    );

    const [[activeVisitors]] = await db.query(
      `SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? AND status = 'IN'`,
      [companyId]
    );

    const [[upcomingBookings]] = await db.query(
      `SELECT COUNT(*) AS total FROM conference_bookings WHERE company_id = ? AND booking_date >= CURDATE() AND status = 'BOOKED'`,
      [companyId]
    );

    res.json({
      visitors: {
        total: visitors.total,
        active: activeVisitors.total,
      },
      bookings: {
        total: bookings.total,
        upcoming: upcomingBookings.total,
      },
    });
  } catch (err) {
    console.error("[GET /exports/stats]", err.message);
    res.status(500).json({ message: "Failed to fetch export statistics" });
  }
});

export default router;
