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
        c.logo_url AS company_logo
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
    console.error("GET VISITOR PASS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visitor pass"
    });
  }
};

/* =========================================================
   PUBLIC VISITOR PASS (NO AUTH)
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
        c.logo_url AS company_logo
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


/* =========================================================
   RESEND VISITOR PASS EMAIL
   POST /api/visitors/:visitorCode/resend
========================================================= */
export const resendVisitorPass = async (req, res) => {
  try {
    const { visitorCode } = req.params;
    const companyId = req.user?.companyId;

    if (!visitorCode) {
      return res.status(400).json({
        success: false,
        message: "Visitor code is required"
      });
    }

    // Fetch visitor with company info including whatsapp_url
    const [[visitor]] = await db.execute(
      `
      SELECT
        v.id,
        v.visitor_code,
        v.name,
        v.phone,
        v.email,
        v.photo_url,
        v.check_in,
        v.person_to_meet,
        v.purpose,
        c.id AS company_id,
        c.name AS company_name,
        c.logo_url AS company_logo,
        c.whatsapp_url AS company_whatsapp_url
      FROM visitors v
      INNER JOIN companies c ON c.id = v.company_id
      WHERE v.visitor_code = ?
        AND v.company_id = ?
      LIMIT 1
      `,
      [visitorCode, companyId]
    );

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found"
      });
    }

    if (!visitor.email) {
      return res.status(400).json({
        success: false,
        message: "Visitor does not have an email address"
      });
    }

    // Import the email service
    const { sendVisitorPassMail } = await import("../utils/visitorMail.service.js");

    // Format check-in time for display
    const formatISTForDisplay = (date) => {
      if (!date) return "-";
      const d = new Date(date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    };

    // Send visitor pass email
    await sendVisitorPassMail({
      company: {
        id: visitor.company_id,
        name: visitor.company_name,
        logo: visitor.company_logo,
        whatsapp_url: visitor.company_whatsapp_url || null,
      },
      visitor: {
        visitorCode: visitor.visitor_code,
        name: visitor.name,
        phone: visitor.phone,
        email: visitor.email,
        photoUrl: visitor.photo_url,
        checkIn: visitor.check_in,
        checkInDisplay: formatISTForDisplay(visitor.check_in),
        personToMeet: visitor.person_to_meet || "Reception",
        purpose: visitor.purpose || "Visit",
      },
    });

    // Update pass_mail_sent flag
    await db.execute(
      `UPDATE visitors SET pass_mail_sent = pass_mail_sent + 1 WHERE id = ?`,
      [visitor.id]
    );

    return res.json({
      success: true,
      message: "Visitor pass resent successfully"
    });

  } catch (error) {
    console.error("RESEND VISITOR PASS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to resend visitor pass"
    });
  }
};
