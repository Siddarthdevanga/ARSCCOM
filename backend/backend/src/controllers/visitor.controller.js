import { db } from "../config/db.js";
import { saveVisitor } from "../services/visitor.service.js";

/* =========================================================
   CREATE VISITOR
   POST /api/visitors
========================================================= */
export const createVisitor = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        message: "Unauthorized: company missing in token"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Visitor photo is required"
      });
    }

    // Save visitor (email sent INSIDE service once)
    const visitor = await saveVisitor(
      companyId,
      req.body,
      req.file
    );

    return res.status(201).json({
      message: "Visitor created successfully",
      visitor
    });

  } catch (error) {
    console.error("CREATE VISITOR ERROR:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to create visitor"
    });
  }
};

/* =========================================================
   ADMIN VISITOR PASS (COMPANY SAFE)
   GET /api/visitors/code/:visitorCode
========================================================= */
export const getVisitorPass = async (req, res) => {
  try {
    const { visitorCode } = req.params;
    const companyId = req.user?.companyId;

    if (!visitorCode) {
      return res.status(400).json({
        message: "Visitor code is required"
      });
    }

    const [rows] = await db.execute(
      `
      SELECT
        v.visitor_code,
        v.name,
        v.phone,
        v.email,
        v.id_type,
        v.id_number,
        v.photo_url,
        v.check_in,
        v.check_out,
        v.status,
        c.name AS company_name,
        c.logo_url AS company_logo
      FROM visitors v
      JOIN companies c ON c.id = v.company_id
      WHERE v.visitor_code = ?
        AND v.company_id = ?
      LIMIT 1
      `,
      [visitorCode, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Visitor not found"
      });
    }

    const v = rows[0];

    return res.json({
      company: {
        name: v.company_name,
        logo: v.company_logo
      },
      visitor: {
        visitorCode: v.visitor_code,
        name: v.name,
        phone: v.phone,
        email: v.email,
        idType: v.id_type,
        idNumber: v.id_number,
        photoUrl: v.photo_url,
        checkIn: v.check_in,
        checkOut: v.check_out,
        status: v.status
      }
    });

  } catch (error) {
    console.error("GET VISITOR PASS ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to fetch visitor pass"
    });
  }
};

/* =========================================================
   🌐 PUBLIC VISITOR PASS (EMAIL / QR / NO AUTH)
   GET /api/visitors/public/code/:visitorCode
========================================================= */
export const getPublicVisitorPass = async (req, res) => {
  try {
    const { visitorCode } = req.params;

    if (!visitorCode) {
      return res.status(400).json({
        message: "Visitor code is required"
      });
    }

    const [rows] = await db.execute(
      `
      SELECT
        v.visitor_code,
        v.name,
        v.phone,
        v.email,
        v.photo_url,
        v.check_in,
        v.check_out,
        v.status,
        c.name AS company_name,
        c.logo_url AS company_logo
      FROM visitors v
      JOIN companies c ON c.id = v.company_id
      WHERE v.visitor_code = ?
      LIMIT 1
      `,
      [visitorCode]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Visitor not found"
      });
    }

    const v = rows[0];

    return res.json({
      company: {
        name: v.company_name,
        logo: v.company_logo
      },
      visitor: {
        visitorCode: v.visitor_code,
        name: v.name,
        phone: v.phone,
        email: v.email,
        photoUrl: v.photo_url,
        checkIn: v.check_in,
        checkOut: v.check_out,
        status: v.status
      }
    });

  } catch (error) {
    console.error("PUBLIC VISITOR PASS ERROR:", error.message);
    return res.status(500).json({
      message: "Unable to load visitor pass"
    });
  }
};

/* =========================================================
   VISITOR DASHBOARD
   GET /api/visitors/dashboard
========================================================= */
export const getVisitorDashboard = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    const [[today]] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND DATE(check_in) = CURDATE()
      `,
      [companyId]
    );

    const [[inside]] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND status = 'IN'
      `,
      [companyId]
    );

    const [[out]] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND status = 'OUT'
        AND DATE(check_out) = CURDATE()
      `,
      [companyId]
    );

    const [activeVisitors] = await db.execute(
      `
      SELECT visitor_code, name, phone, check_in
      FROM visitors
      WHERE company_id = ?
        AND status = 'IN'
      ORDER BY check_in DESC
      `,
      [companyId]
    );

    const [checkedOutVisitors] = await db.execute(
      `
      SELECT visitor_code, name, phone, check_out
      FROM visitors
      WHERE company_id = ?
        AND status = 'OUT'
        AND DATE(check_out) = CURDATE()
      ORDER BY check_out DESC
      `,
      [companyId]
    );

    return res.json({
      stats: {
        today: today.count,
        inside: inside.count,
        out: out.count
      },
      activeVisitors,
      checkedOutVisitors
    });

  } catch (error) {
    console.error("DASHBOARD ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to load dashboard"
    });
  }
};

/* =========================================================
   CHECKOUT VISITOR
========================================================= */
export const checkoutVisitor = async (req, res) => {
  try {
    const { visitorCode } = req.params;
    const companyId = req.user?.companyId;

    const [result] = await db.execute(
      `
      UPDATE visitors
      SET status = 'OUT',
          check_out = CONVERT_TZ(NOW(), '+00:00', '+05:30')
      WHERE visitor_code = ?
        AND company_id = ?
        AND status = 'IN'
      `,
      [visitorCode, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Visitor not found or already checked out"
      });
    }

    return res.json({
      message: "Visitor checked out successfully"
    });

  } catch (error) {
    console.error("CHECKOUT ERROR:", error.message);
    return res.status(500).json({
      message: "Checkout failed"
    });
  }
};
