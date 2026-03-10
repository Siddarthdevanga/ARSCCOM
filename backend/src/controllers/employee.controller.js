import { db } from "../config/db.js";

/* =========================================================
   LIST EMPLOYEES  (also handles autocomplete search)
   GET /api/employees
   GET /api/employees?search=hr&limit=10   ← autocomplete
========================================================= */
export const listEmployees = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const search    = (req.query.search || "").trim();
    const limit     = Math.min(Number(req.query.limit) || 10, 100);

    let rows;
    if (search) {
      const q = `%${search}%`;
      [rows] = await db.execute(
        `SELECT id, name, email, department, is_active
         FROM company_employees
         WHERE company_id = ?
           AND is_active = 1
           AND (name LIKE ? OR department LIKE ?)
         ORDER BY name ASC
         LIMIT ${limit}`,
        [companyId, q, q]
      );
      console.log(`[EMPLOYEES] search="${search}" companyId=${companyId} → ${rows.length} rows`);
    } else {
      [rows] = await db.execute(
        `SELECT id, name, email, department, is_active, created_at
         FROM company_employees
         WHERE company_id = ?
         ORDER BY name ASC`,
        [companyId]
      );
    }

    return res.json({ success: true, employees: rows });
  } catch (err) {
    console.error("[LIST EMPLOYEES ERROR]", err);
    return res.status(500).json({ success: false, message: "Failed to fetch employees" });
  }
};

/* =========================================================
   CREATE EMPLOYEE
   POST /api/employees
========================================================= */
export const createEmployee = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { name, email, department } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Employee name is required" });
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    const [result] = await db.execute(
      `INSERT INTO company_employees (company_id, name, email, department)
       VALUES (?, ?, ?, ?)`,
      [companyId, name.trim(), email.trim().toLowerCase(), department?.trim() || null]
    );

    return res.status(201).json({
      success: true,
      message: "Employee added successfully",
      employee: {
        id: result.insertId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department?.trim() || null,
        is_active: 1
      }
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "This email is already registered for your company" });
    }
    console.error("CREATE EMPLOYEE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to add employee" });
  }
};

/* =========================================================
   UPDATE EMPLOYEE
   PUT /api/employees/:id
========================================================= */
export const updateEmployee = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const { name, email, department, is_active } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Employee name is required" });
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    const [result] = await db.execute(
      `UPDATE company_employees
       SET name = ?, email = ?, department = ?, is_active = ?
       WHERE id = ? AND company_id = ?`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        department?.trim() || null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id,
        companyId
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    return res.json({ success: true, message: "Employee updated successfully" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "This email is already registered for your company" });
    }
    console.error("UPDATE EMPLOYEE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to update employee" });
  }
};

/* =========================================================
   DELETE EMPLOYEE
   DELETE /api/employees/:id
========================================================= */
export const deleteEmployee = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const [result] = await db.execute(
      `DELETE FROM company_employees WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    return res.json({ success: true, message: "Employee removed successfully" });
  } catch (err) {
    console.error("DELETE EMPLOYEE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to remove employee" });
  }
};

/* =========================================================
   SEARCH EMPLOYEES (for autocomplete — used by public slug route)
========================================================= */
export const searchEmployeesByCompany = async (companyId, query) => {
  const q = `%${(query || "").trim()}%`;
  const [rows] = await db.execute(
    `SELECT id, name, email, department
     FROM company_employees
     WHERE company_id = ?
       AND is_active = 1
       AND (name LIKE ? OR department LIKE ?)
     ORDER BY name ASC
     LIMIT 10`,
    [companyId, q, q]
  );
  return rows;
};

/* =========================================================
   BULK UPSERT EMPLOYEES
   POST /api/employees/bulk
   Body: { employees: [ { name, email, department, is_active }, … ] }
   — Inserts new rows; updates name/department/is_active on duplicate email
     (scoped to the same company_id via the unique key on (company_id, email))
========================================================= */
export const bulkUpsertEmployees = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { employees } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, message: "No employee data provided" });
    }
    if (employees.length > 500) {
      return res.status(400).json({ success: false, message: "Maximum 500 employees per upload" });
    }

    // Validate every row up-front and collect errors
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors   = [];

    const rows = employees.map((emp, i) => {
      const rowNum = i + 2; // Excel row number (row 1 = header)
      const name   = emp.name?.toString().trim()  || "";
      const email  = emp.email?.toString().trim().toLowerCase() || "";
      const dept   = emp.department?.toString().trim() || null;
      // Accept TRUE/true/1/yes as active; default to active if omitted
      const raw    = emp.is_active;
      const active = raw === undefined || raw === null
        ? 1
        : ["true", "1", "yes", "active"].includes(String(raw).toLowerCase()) ? 1 : 0;

      if (!name)              errors.push({ row: rowNum, email, reason: "Name is required" });
      if (!email)             errors.push({ row: rowNum, email, reason: "Email is required" });
      else if (!EMAIL_RE.test(email)) errors.push({ row: rowNum, email, reason: "Invalid email format" });

      return [companyId, name, email, dept, active];
    });

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: `${errors.length} row(s) failed validation`,
        errors
      });
    }

    // Build a single multi-row INSERT … ON DUPLICATE KEY UPDATE
    // The unique key must be on (company_id, email) in the DB schema.
    const placeholders = rows.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const flat         = rows.flat();

    const [result] = await db.execute(
      `INSERT INTO company_employees (company_id, name, email, department, is_active)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         name        = VALUES(name),
         department  = VALUES(department),
         is_active   = VALUES(is_active)`,
      flat
    );

    // affectedRows = 1 per insert, 2 per update (MySQL behaviour)
    const inserted = result.affectedRows - (result.affectedRows - rows.length > 0 ? rows.length : 0);
    return res.json({
      success: true,
      message: `Bulk upload complete`,
      inserted: result.affectedRows,   // raw MySQL count
      total:    rows.length
    });

  } catch (err) {
    console.error("BULK UPSERT ERROR:", err);
    return res.status(500).json({ success: false, message: "Bulk upload failed" });
  }
};
