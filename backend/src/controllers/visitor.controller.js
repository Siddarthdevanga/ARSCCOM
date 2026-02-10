import { db } from "../config/db.js";
import { saveVisitor } from "../services/visitor.service.js";
import { getPlanUsage } from "../services/plan.service.js"; // optional but recommended

/* =========================================================
   CREATE VISITOR
========================================================= */
export const createVisitor = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: company missing in token"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Visitor photo is required"
      });
    }

    const visitor = await saveVisitor(companyId, req.body, req.file);

    return res.status(201).json({
      success: true,
      message: "Visitor created successfully",
      visitor
    });

  } catch (error) {
    console.error("CREATE VISITOR ERROR:", error);

    // If service already throws user-safe error message, return it
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create visitor"
    });
  }
};

/* =========================================================
   ADMIN VISITOR PASS (COMPANY SAFE)
========================================================= */
export const getVisitorPass = async (req, res) => {
  try {
    const { visitorCode } = req.params;
    const companyId = req.user?.companyId;

    if (!visitorCode) {
      return res.status(400).json({
        success: false,
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
        c.logo_url AS company_logo,
        c.whatsapp_url AS company_whatsapp
      FROM visitors v
      INNER JOIN companies c ON c.id = v.company_id
      WHERE v.visitor_code = ?
        AND v.company_id = ?
      LIMIT 1
      `,
      [visitorCode, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found"
      });
    }

    const v = rows[0];

    return res.json({
      success: true,
      company: {
        name: v.company_name,
        logo: v.company_logo,
        whatsappUrl: v.company_whatsapp || null
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
    console.error("GET VISITOR PASS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visitor pass"
    });
  }
};

/* =========================================================
   PUBLIC VISITOR PASS (NO AUTH)
   --------------------------------------------------------
   INCLUDES: WhatsApp URL for visitor support/group access
========================================================= */
export const getPublicVisitorPass = async (req, res) => {
  try {
    const { visitorCode } = req.params;

    if (!visitorCode) {
      return res.status(400).json({
        success: false,
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
        c.logo_url AS company_logo,
        c.whatsapp_url AS company_whatsapp
      FROM visitors v
      INNER JOIN companies c ON c.id = v.company_id
      WHERE v.visitor_code = ?
      LIMIT 1
      `,
      [visitorCode]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found"
      });
    }

    const v = rows[0];

    return res.json({
      success: true,
      company: {
        name: v.company_name,
        logo: v.company_logo,
        whatsappUrl: v.company_whatsapp || null
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
    console.error("PUBLIC VISITOR PASS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load visitor pass"
    });
  }
};

/* =========================================================
   VISITOR DASHBOARD + PLAN USAGE
========================================================= */
export const getVisitorDashboard = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Today Visitors Count (IST Safe)
    const [[today]] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND DATE(CONVERT_TZ(check_in, '+00:00', '+05:30')) = CURDATE()
      `,
      [companyId]
    );

    // Current Inside
    const [[inside]] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND status = 'IN'
      `,
      [companyId]
    );

    // Checked Out Today
    const [[out]] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND status = 'OUT'
        AND DATE(CONVERT_TZ(check_out, '+00:00', '+05:30')) = CURDATE()
      `,
      [companyId]
    );

    // Active List
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

    // Checked Out List
    const [checkedOutVisitors] = await db.execute(
      `
      SELECT visitor_code, name, phone, check_out
      FROM visitors
      WHERE company_id = ?
        AND status = 'OUT'
        AND DATE(CONVERT_TZ(check_out, '+00:00', '+05:30')) = CURDATE()
      ORDER BY check_out DESC
      `,
      [companyId]
    );

    const plan = await getPlanUsage(companyId); // Optional but powerful

    return res.json({
      success: true,
      stats: {
        today: today.count,
        inside: inside.count,
        out: out.count
      },
      plan,
      activeVisitors,
      checkedOutVisitors
    });

  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    return res.status(500).json({
      success: false,
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

    if (!visitorCode) {
      return res.status(400).json({
        success: false,
        message: "Visitor code is required"
      });
    }

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
        success: false,
        message: "Visitor not found or already checked out"
      });
    }

    return res.json({
      success: true,
      message: "Visitor checked out successfully"
    });

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Checkout failed"
    });
  }
};
