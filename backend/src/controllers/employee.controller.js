import { db } from "../config/db.js";

/* =========================================================
   LIST EMPLOYEES  (also handles autocomplete search)
   GET /api/employees
   GET /api/employees?search=hr&limit=10   ← autocomplete
========================================================= */
export const listEmployees = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const search    = req.query.search?.trim() || "";
    const limit     = Math.min(parseInt(req.query.limit) || 200, 200);

    let rows;
    if (search) {
      // Autocomplete path — filter by name OR department, active only
      const q = `%${search}%`;
      [rows] = await db.execute(
        `SELECT id, name, email, department, is_active, created_at
         FROM company_employees
         WHERE company_id = ?
           AND is_active = 1
           AND (name LIKE ? OR department LIKE ?)
         ORDER BY name ASC
         LIMIT ?`,
        [companyId, q, q, limit]
      );
    } else {
      // Full list path — returns all employees (for employee management page)
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
    console.error("LIST EMPLOYEES ERROR:", err);
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
   Internal helper — called from visitor-public.routes.js
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
