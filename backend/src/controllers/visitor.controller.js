import { db } from "../config/db.js";
import { saveVisitor } from "../services/visitor.service.js";
import { getPlanUsage } from "../services/plan.service.js";

/* =========================================================
   CREATE VISITOR
========================================================= */
export const createVisitor = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: company missing in token" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Visitor photo is required" });
    }

    const visitor = await saveVisitor(companyId, req.body, req.file);

    return res.status(201).json({ success: true, message: "Visitor created successfully", visitor });

  } catch (error) {
    console.error("CREATE VISITOR ERROR:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to create visitor" });
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
      return res.status(400).json({ success: false, message: "Visitor code is required" });
    }

    const [rows] = await db.execute(
      `SELECT
        v.visitor_code, v.name, v.phone, v.email,
        v.id_type, v.id_number, v.photo_url,
        DATE_FORMAT(v.check_in,  '%Y-%m-%dT%H:%i:%s+05:30') AS check_in,
        DATE_FORMAT(v.check_out, '%Y-%m-%dT%H:%i:%s+05:30') AS check_out,
        v.status, v.visit_status, v.pass_mail_sent,
        v.person_to_meet, v.purpose,
        c.name AS company_name, c.logo_url AS company_logo
       FROM visitors v
       INNER JOIN companies c ON c.id = v.company_id
       WHERE v.visitor_code = ? AND v.company_id = ?
       LIMIT 1`,
      [visitorCode, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    const v = rows[0];

    return res.json({
      success: true,
      company: { name: v.company_name, logo: v.company_logo },
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
        status: v.status,
        visitStatus: v.visit_status,
        passIssued: v.pass_mail_sent > 0,
        personToMeet: v.person_to_meet,
        purpose: v.purpose,
      }
    });

  } catch (error) {
    console.error("GET VISITOR PASS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch visitor pass" });
  }
};

/* =========================================================
   PUBLIC VISITOR PASS (NO AUTH)
========================================================= */
export const getPublicVisitorPass = async (req, res) => {
  try {
    const { visitorCode } = req.params;

    if (!visitorCode) {
      return res.status(400).json({ success: false, message: "Visitor code is required" });
    }

    const [rows] = await db.execute(
      `SELECT
        v.visitor_code, v.name, v.phone, v.email,
        v.photo_url,
        DATE_FORMAT(v.check_in,  '%Y-%m-%dT%H:%i:%s+05:30') AS check_in,
        DATE_FORMAT(v.check_out, '%Y-%m-%dT%H:%i:%s+05:30') AS check_out,
        v.status, v.visit_status, v.pass_mail_sent,
        c.name AS company_name, c.logo_url AS company_logo
       FROM visitors v
       INNER JOIN companies c ON c.id = v.company_id
       WHERE v.visitor_code = ?
       LIMIT 1`,
      [visitorCode]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    const v = rows[0];

    return res.json({
      success: true,
      company: { name: v.company_name, logo: v.company_logo },
      visitor: {
        visitorCode: v.visitor_code,
        name: v.name,
        phone: v.phone,
        email: v.email,
        photoUrl: v.photo_url,
        checkIn: v.check_in,
        checkOut: v.check_out,
        status: v.status,
        visitStatus: v.visit_status,
        passIssued: v.pass_mail_sent > 0,
      }
    });

  } catch (error) {
    console.error("PUBLIC VISITOR PASS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load visitor pass" });
  }
};

/* =========================================================
   VISITOR DASHBOARD + PLAN USAGE

   FIXES APPLIED:
   ─────────────────────────────────────────────────────────
   BUG 1 (Stats key mismatch):
     Was returning { today, inside, out, pending }.
     Frontend reads totalVisitors / activeVisitors / pendingVisits.
     Fixed: return keys that match what the frontend expects.

   BUG 2 (checkedOutVisitors missing check_in):
     Duration calculation on frontend is:
       new Date(v.check_out) - new Date(v.check_in)
     check_in was not selected → always undefined → NaN → "—".
     Fixed: added check_in to the checkedOut SELECT.

   BUG 3 (activeVisitors missing from_company):
     Frontend shows v.from_company as the sub-label under visitor name.
     Was not selected in active query → always undefined → never shown.
     Fixed: added from_company to both SELECT lists.

   BUG 4 (CONVERT_TZ double-shifts checkout time by +5:30):
     MySQL server timezone is already IST (confirmed by user: checkout
     showed 5 hours ahead). CONVERT_TZ(NOW(), '+00:00', '+05:30') was
     treating IST NOW() as if it were UTC and adding another +5:30.
     Fixed: checkoutVisitor uses NOW() directly.
     Date filters that used CONVERT_TZ on stored columns also fixed.

   BUG 5 (checkedOut date filter wrong):
     Was: DATE(CONVERT_TZ(check_out, '+00:00', '+05:30')) = CURDATE()
     Same double-shift problem — stored value is already IST.
     Fixed: DATE(check_out) = CURDATE()

   BUG 6 (today filter wrong):
     Was: DATE(CONVERT_TZ(check_in, '+00:00', '+05:30')) = CURDATE()
     Fixed: DATE(check_in) = CURDATE()

   BUG 7 (plan usage not reaching frontend):
     Was returning plan as a separate top-level key that the frontend
     never reads. Frontend expects stats.planLimit / stats.planVisitorsUsed.
     Fixed: merge plan fields into the stats object.
   ─────────────────────────────────────────────────────────
========================================================= */
export const getVisitorDashboard = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // FIX 6: DATE(check_in) = CURDATE() — stored value is already IST, no conversion needed
    const [[today]] = await db.execute(
      `SELECT COUNT(*) AS count FROM visitors
       WHERE company_id = ? AND DATE(check_in) = CURDATE()`,
      [companyId]
    );

    // Currently inside (status = 'IN')
    const [[inside]] = await db.execute(
      `SELECT COUNT(*) AS count FROM visitors
       WHERE company_id = ? AND status = 'IN'`,
      [companyId]
    );

    // FIX 5: DATE(check_out) = CURDATE() — no CONVERT_TZ needed
    const [[out]] = await db.execute(
      `SELECT COUNT(*) AS count FROM visitors
       WHERE company_id = ? AND status = 'OUT'
         AND DATE(check_out) = CURDATE()`,
      [companyId]
    );

    // Pending approvals
    const [[pending]] = await db.execute(
      `SELECT COUNT(*) AS count FROM visitors
       WHERE company_id = ? AND visit_status = 'pending'`,
      [companyId]
    );

    // Datetime columns are stored as IST but MySQL returns them without a
    // timezone suffix (e.g. "2026-03-08 23:45:00"). When JS does
    // new Date("2026-03-08 23:45:00") it treats it as UTC, which shifts
    // times after ~6:30 PM IST to the next calendar day on the frontend.
    // Fix: tag every datetime with +05:30 in SQL so JS always parses as IST.
    const [activeVisitors] = await db.execute(
      `SELECT
         visitor_code, name, phone,
         from_company,
         DATE_FORMAT(check_in, '%Y-%m-%dT%H:%i:%s+05:30') AS check_in,
         visit_status,
         pass_mail_sent AS pass_issued,
         person_to_meet
       FROM visitors
       WHERE company_id = ? AND status = 'IN'
       ORDER BY check_in DESC`,
      [companyId]
    );

    const [checkedOutVisitors] = await db.execute(
      `SELECT
         visitor_code, name, phone,
         from_company,
         DATE_FORMAT(check_in,  '%Y-%m-%dT%H:%i:%s+05:30') AS check_in,
         DATE_FORMAT(check_out, '%Y-%m-%dT%H:%i:%s+05:30') AS check_out,
         visit_status,
         pass_mail_sent AS pass_issued,
         person_to_meet
       FROM visitors
       WHERE company_id = ? AND status = 'OUT'
         AND DATE(check_out) = CURDATE()
       ORDER BY check_out DESC`,
      [companyId]
    );

    // FIX 7: Get plan usage and merge into stats so frontend can read
    // stats.planLimit and stats.planVisitorsUsed directly.
    // plan.service returns { limit, used } — NOT { limit, visitorsUsed }.
    // Non-trial plans return limit:"UNLIMITED" (string) — treat as 0 so
    // the frontend skips rendering the plan bar (planLimit === 0 hides it).
    const plan = await getPlanUsage(companyId);
    const planLimit        = typeof plan?.limit === "number" ? plan.limit : 0;
    const planVisitorsUsed = plan?.used ?? 0;

    // FIX 1: Use key names that match what the frontend reads
    return res.json({
      success: true,
      stats: {
        totalVisitors:    today.count,
        activeVisitors:   inside.count,
        checkedOutToday:  out.count,
        pendingVisits:    pending.count,
        planLimit,
        planVisitorsUsed,
      },
      activeVisitors,
      checkedOutVisitors,
    });

  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to load dashboard" });
  }
};

/* =========================================================
   ADMIN UPDATE VISIT STATUS (Accept / Decline)
   PATCH /api/visitors/:visitorCode/visit-status
========================================================= */
export const updateVisitStatus = async (req, res) => {
  try {
    const { visitorCode } = req.params;
    const companyId = req.user?.companyId;
    const { status } = req.body;

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'accepted' or 'declined'" });
    }

    const [result] = await db.execute(
      `UPDATE visitors
       SET visit_status = ?, response_token = NULL
       WHERE visitor_code = ? AND company_id = ?`,
      [status, visitorCode, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    return res.json({
      success: true,
      message: `Visit ${status} successfully`,
      visitStatus: status,
    });

  } catch (error) {
    console.error("UPDATE VISIT STATUS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update visit status" });
  }
};

/* =========================================================
   CHECKOUT VISITOR

   FIX 4: Was CONVERT_TZ(NOW(), '+00:00', '+05:30')
   MySQL server is already in IST so NOW() already returns IST.
   CONVERT_TZ was treating the IST value as UTC and adding another
   +5:30, causing checkout time to appear ~5.5 hours in the future.
   Fix: use NOW() directly — it's already IST on this server.
========================================================= */
export const checkoutVisitor = async (req, res) => {
  try {
    const { visitorCode } = req.params;
    const companyId = req.user?.companyId;

    if (!visitorCode) {
      return res.status(400).json({ success: false, message: "Visitor code is required" });
    }

    const [result] = await db.execute(
      `UPDATE visitors
       SET status       = 'OUT',
           visit_status = 'checked_out',
           check_out    = NOW()
       WHERE visitor_code = ? AND company_id = ? AND status = 'IN'`,
      [visitorCode, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found or already checked out",
      });
    }

    return res.json({ success: true, message: "Visitor checked out successfully" });

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    return res.status(500).json({ success: false, message: "Checkout failed" });
  }
};

/* =========================================================
   RESEND VISITOR PASS EMAIL
========================================================= */
export const resendVisitorPass = async (req, res) => {
  try {
    const { visitorCode } = req.params;
    const companyId = req.user?.companyId;

    if (!visitorCode) {
      return res.status(400).json({ success: false, message: "Visitor code is required" });
    }

    const [[visitor]] = await db.execute(
      `SELECT
         v.id, v.visitor_code, v.name, v.phone, v.email,
         v.photo_url, v.check_in, v.person_to_meet, v.purpose,
         c.id AS company_id, c.name AS company_name,
         c.logo_url AS company_logo, c.whatsapp_url AS company_whatsapp_url
       FROM visitors v
       INNER JOIN companies c ON c.id = v.company_id
       WHERE v.visitor_code = ? AND v.company_id = ?
       LIMIT 1`,
      [visitorCode, companyId]
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    if (!visitor.email) {
      return res.status(400).json({ success: false, message: "Visitor does not have an email address" });
    }

    const { sendVisitorPassMail } = await import("../utils/visitorMail.service.js");

    const formatISTForDisplay = (date) => {
      if (!date) return "-";
      const d = new Date(date);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const day     = d.getDate();
      const month   = months[d.getMonth()];
      const year    = d.getFullYear();
      let hours     = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm    = hours >= 12 ? "PM" : "AM";
      hours         = hours % 12 || 12;
      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    };

    await sendVisitorPassMail({
      company: {
        id:           visitor.company_id,
        name:         visitor.company_name,
        logo:         visitor.company_logo,
        whatsapp_url: visitor.company_whatsapp_url || null,
      },
      visitor: {
        visitorCode:    visitor.visitor_code,
        name:           visitor.name,
        phone:          visitor.phone,
        email:          visitor.email,
        photoUrl:       visitor.photo_url,
        checkIn:        visitor.check_in,
        checkInDisplay: formatISTForDisplay(visitor.check_in),
        personToMeet:   visitor.person_to_meet || "Reception",
        purpose:        visitor.purpose || "Visit",
      },
    });

    await db.execute(
      `UPDATE visitors SET pass_mail_sent = pass_mail_sent + 1 WHERE id = ?`,
      [visitor.id]
    );

    return res.json({ success: true, message: "Visitor pass resent successfully" });

  } catch (error) {
    console.error("RESEND VISITOR PASS ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to resend visitor pass" });
  }
};
