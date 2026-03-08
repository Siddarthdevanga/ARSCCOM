import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";
import { sendEmployeeNotificationMail } from "../utils/visitorMail.service.js";
import crypto from "crypto";

/* ======================================================
   IST HELPERS

   IMPORTANT — WHY THESE ARE KEPT BUT check_in USES NOW():
   ─────────────────────────────────────────────────────────
   MySQL server timezone is IST (confirmed: checkout was appearing
   5.5 hours ahead when CONVERT_TZ(NOW(), '+00:00', '+05:30') was
   used — it was double-shifting an already-IST NOW()).

   For check_in and check_out we now use MySQL NOW() directly,
   since it already returns the correct IST time on this server.

   These helpers are kept for:
   - Display formatting in email (formatISTForDisplay)
   - Visitor code date key (formatISTDateKey) — generates YYYYMMDD
     from the current IST date for the visitor_code suffix
   - token_expires_at calculation (tokenExpiresMySQL)
====================================================== */
const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
};

const formatISTForMySQL = (date) => {
  const year    = date.getUTCFullYear();
  const month   = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day     = String(date.getUTCDate()).padStart(2, "0");
  const hours   = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatISTDateKey = (date) => {
  const year  = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const formatISTForDisplay = (date) => {
  const months  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day     = date.getUTCDate();
  const month   = months[date.getUTCMonth()];
  const year    = date.getUTCFullYear();
  let hours     = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const ampm    = hours >= 12 ? "PM" : "AM";
  hours         = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
};

/* ======================================================
   SANITIZE EMPLOYEE ID
====================================================== */
const sanitizeEmployeeId = (raw) => {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str || str === "null" || str === "undefined" || str === "0") return null;
  const n = parseInt(str, 10);
  return isNaN(n) || n <= 0 ? null : n;
};

/* ======================================================
   SAVE VISITOR
====================================================== */
export const saveVisitor = async (companyId, data, file) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!file)      throw new Error("Visitor photo is required");

  const {
    name, phone, email, fromCompany, department, designation,
    address, city, state, postalCode, country,
    personToMeet, purpose, belongings, idType, idNumber,
  } = data;

  if (!name?.trim() || !phone?.trim())
    throw new Error("Visitor name and phone are required");

  const employeeId = sanitizeEmployeeId(data.employeeId);

  // Used for email display, visitor code date key, and token expiry only.
  // check_in in DB is written as NOW() by MySQL (already IST on this server).
  const checkInIST   = getISTDate();
  const checkInMySQL = formatISTForMySQL(checkInIST); // used for token expiry + display only

  console.log("[VISITOR] IST (for display):", formatISTForDisplay(checkInIST));
  console.log("[VISITOR] employeeId raw:", data.employeeId, "→ sanitized:", employeeId);

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* ── Lock company ── */
    const [[company]] = await conn.execute(
      `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at
       FROM companies WHERE id = ? FOR UPDATE`,
      [companyId]
    );

    if (!company) throw new Error("Company not found");

    const PLAN   = (company.plan                || "TRIAL").toUpperCase();
    const STATUS = (company.subscription_status || "PENDING").toUpperCase();

    if (STATUS === "EXPIRED") {
      const error = new Error("Your subscription has expired. Please renew to continue.");
      error.code = "SUBSCRIPTION_EXPIRED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    if (!["ACTIVE", "TRIAL"].includes(STATUS)) {
      const error = new Error("Subscription inactive. Please activate your subscription.");
      error.code = "SUBSCRIPTION_INACTIVE";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    if (PLAN === "TRIAL") {
      if (!company.trial_ends_at) {
        const error = new Error("Trial not initialized. Please contact support.");
        error.code = "TRIAL_NOT_INITIALIZED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
      const trialEndsDate = new Date(company.trial_ends_at);
      if (trialEndsDate < new Date()) {
        const error = new Error("Your trial has expired. Please upgrade to continue.");
        error.code = "TRIAL_EXPIRED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
      const [[{ total }]] = await conn.execute(
        `SELECT COUNT(*) AS total FROM visitors WHERE company_id = ? FOR UPDATE`,
        [companyId]
      );
      if (total >= 100) {
        const error = new Error("Trial limit reached (100 visitors). Please upgrade.");
        error.code = "TRIAL_LIMIT_REACHED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
    } else {
      if (!company.subscription_ends_at) {
        const error = new Error("Subscription not properly initialized. Please contact support.");
        error.code = "SUBSCRIPTION_NOT_INITIALIZED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
      const subEndsDate = new Date(company.subscription_ends_at);
      if (subEndsDate < new Date()) {
        const error = new Error(`Your ${PLAN} subscription has expired. Please renew.`);
        error.code = "SUBSCRIPTION_EXPIRED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
    }

    /* ── Resolve employee ── */
    let resolvedEmployeeId    = null;
    let resolvedEmployeeEmail = null;
    let resolvedEmployeeName  = personToMeet || null;

    if (employeeId) {
      const [[emp]] = await conn.execute(
        `SELECT id, name, email FROM company_employees
         WHERE id = ? AND company_id = ? AND is_active = 1`,
        [employeeId, companyId]
      );
      if (emp) {
        resolvedEmployeeId    = emp.id;
        resolvedEmployeeEmail = emp.email;
        resolvedEmployeeName  = emp.name;
        console.log(`[VISITOR] Employee resolved: ${emp.name} <${emp.email}>`);
      } else {
        console.warn(`[VISITOR] Employee id=${employeeId} not found or inactive for company ${companyId}`);
      }
    } else {
      console.log(`[VISITOR] No employeeId — person_to_meet: "${resolvedEmployeeName || "none"}". No notification will be sent.`);
    }

    /* ── Generate response token (expires 48h from now) ── */
    const responseToken     = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt    = new Date(checkInIST.getTime() + 48 * 60 * 60 * 1000);
    const tokenExpiresMySQL = formatISTForMySQL(tokenExpiresAt);

    /* ── Insert visitor
       FIX: check_in = NOW() — MySQL server is already in IST.
       Previously used a manually computed IST string from JS which
       could drift from server time. NOW() is always authoritative.
    ── */
    const [insertResult] = await conn.execute(
      `INSERT INTO visitors (
        company_id, name, phone, email, from_company, department, designation,
        address, city, state, postal_code, country,
        person_to_meet, employee_id, purpose, belongings,
        id_type, id_number,
        status, visit_status, check_in, pass_mail_sent,
        response_token, response_token_expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN', 'pending', NOW(), 0, ?, ?)`,
      [
        companyId,
        name.trim(),
        phone.trim(),
        email        || null,
        fromCompany  || null,
        department   || null,
        designation  || null,
        address      || null,
        city         || null,
        state        || null,
        postalCode   || null,
        country      || null,
        resolvedEmployeeName,
        resolvedEmployeeId,
        purpose      || null,
        Array.isArray(belongings) ? belongings.join(", ") : belongings || null,
        idType       || null,
        idNumber     || null,
        responseToken,
        tokenExpiresMySQL,
      ]
    );

    const visitorId = insertResult.insertId;

    /* ── Visitor code — date key from IST ── */
    const dateKey = formatISTDateKey(checkInIST);
    const [[{ count }]] = await conn.execute(
      `SELECT COUNT(*) AS count FROM visitors
       WHERE company_id = ? AND DATE(check_in) = CURDATE()`,
      [companyId]
    );
    const visitorCode = `CMP${companyId}-${dateKey}-${String(count).padStart(5, "0")}`;

    console.log("[VISITOR] Generated code:", visitorCode);

    /* ── Upload photo ── */
    const photoUrl = await uploadToS3(
      file,
      `companies/${companyId}/visitors/${visitorCode}.jpg`
    );

    await conn.execute(
      `UPDATE visitors SET visitor_code = ?, photo_url = ? WHERE id = ?`,
      [visitorCode, photoUrl, visitorId]
    );

    /* ── Fetch actual check_in stored by MySQL for emails ── */
    const [[inserted]] = await conn.execute(
      `SELECT check_in FROM visitors WHERE id = ?`,
      [visitorId]
    );
    const storedCheckIn = inserted?.check_in;

    await conn.commit();
    console.log("[VISITOR] Saved successfully, id:", visitorId);

    /* ── Fetch company info for emails ── */
    const [[companyInfo]] = await db.execute(
      `SELECT name, logo_url, whatsapp_url FROM companies WHERE id = ?`,
      [companyId]
    );

    // Display formatter for emails — reads from the stored datetime directly
    const formatForDisplay = (mysqlDatetime) => {
      if (!mysqlDatetime) return formatISTForDisplay(checkInIST);
      const d = new Date(mysqlDatetime);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const day    = d.getDate();
      const month  = months[d.getMonth()];
      const year   = d.getFullYear();
      let hours    = d.getHours();
      const mins   = String(d.getMinutes()).padStart(2, "0");
      const ampm   = hours >= 12 ? "PM" : "AM";
      hours        = hours % 12 || 12;
      return `${day} ${month} ${year}, ${hours}:${mins} ${ampm}`;
    };

    const checkInDisplay = formatForDisplay(storedCheckIn);

    /* ── Send visitor pass email (non-blocking) ── */
    if (email) {
      try {
        console.log("[VISITOR] Sending pass email to:", email);
        await sendVisitorPassMail({
          company: {
            id:           companyId,
            name:         companyInfo.name,
            logo:         companyInfo.logo_url,
            whatsapp_url: companyInfo.whatsapp_url || null,
          },
          visitor: {
            visitorCode,
            name,
            phone,
            email,
            photoUrl,
            checkIn:        storedCheckIn || checkInMySQL,
            checkInDisplay,
            personToMeet:   resolvedEmployeeName || "Reception",
            purpose:        purpose || "Visit",
          },
        });
        await db.execute(
          `UPDATE visitors SET pass_mail_sent = 1 WHERE id = ?`,
          [visitorId]
        );
        console.log("[VISITOR] Pass email sent");
      } catch (err) {
        console.error("[VISITOR] PASS MAIL ERROR:", err.message);
      }
    }

    /* ── Send employee notification email (non-blocking) ── */
    if (resolvedEmployeeEmail) {
      try {
        console.log("[VISITOR] Sending employee notification to:", resolvedEmployeeEmail);
        await sendEmployeeNotificationMail({
          company: {
            id:   companyId,
            name: companyInfo.name,
            logo: companyInfo.logo_url,
          },
          employee: {
            name:  resolvedEmployeeName,
            email: resolvedEmployeeEmail,
          },
          visitor: {
            visitorCode,
            name,
            phone,
            email:       email || null,
            fromCompany: fromCompany || null,
            purpose:     purpose || "Visit",
            checkIn:        storedCheckIn || checkInMySQL,
            checkInDisplay,
            photoUrl,
          },
          responseToken,
        });
        console.log("[VISITOR] Employee notification sent");
      } catch (err) {
        console.error("[VISITOR] EMPLOYEE NOTIFICATION MAIL ERROR:", err.message);
      }
    }

    return {
      id:             visitorId,
      visitorCode,
      name,
      phone,
      email,
      photoUrl,
      status:         "IN",
      visitStatus:    "pending",
      checkIn:        storedCheckIn || checkInMySQL,
      checkInDisplay,
    };

  } catch (err) {
    await conn.rollback();
    console.error("[VISITOR] SAVE ERROR:", err.message);
    throw err;
  } finally {
    conn.release();
  }
};
