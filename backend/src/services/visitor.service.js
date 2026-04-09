import { db } from "../config/db.js";
import { uploadToS3, getPresignedUrl } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";
import { sendVisitorPassWhatsApp, sendApprovalWhatsApp } from "../utils/whatsapp.js";
import crypto from "crypto";

/* ======================================================
   IST HELPERS
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

  if (!name?.trim() || !phone?.trim() || !email?.trim())
    throw new Error("Visitor name, phone, and email are required");

  const employeeId   = sanitizeEmployeeId(data.employeeId);
  const checkInIST   = getISTDate();
  const checkInMySQL = formatISTForMySQL(checkInIST);

  console.log("[VISITOR] IST (for display):", formatISTForDisplay(checkInIST));
  console.log("[VISITOR] employeeId raw:", data.employeeId, "→ sanitized:", employeeId);

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* ── Lock company ── */
    const [[company]] = await conn.execute(
      `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at,
              grace_period_ends_at, grace_period_day
       FROM companies WHERE id = ? FOR UPDATE`,
      [companyId]
    );

    if (!company) throw new Error("Company not found");

    const PLAN   = (company.plan                || "TRIAL").toUpperCase();
    const STATUS = (company.subscription_status || "PENDING").toUpperCase();

    // Check if in grace period
    const inGracePeriod = STATUS === "GRACE_PERIOD" &&
                          company.grace_period_ends_at &&
                          new Date(company.grace_period_ends_at) > new Date();

    // Calculate grace period days remaining
    let gracePeriodDaysRemaining = 0;
    if (inGracePeriod) {
      const endsAt = new Date(company.grace_period_ends_at);
      const now = new Date();
      gracePeriodDaysRemaining = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
    }

    // Log grace period status
    if (inGracePeriod) {
      console.log(`[VISITOR] Company in grace period: ${gracePeriodDaysRemaining} days remaining`);
    }

    // Block only terminal/inactive statuses. Trust the status field for ACTIVE/TRIAL —
    // the grace period cron transitions them when their subscription actually expires.
    if (!["ACTIVE", "TRIAL", "GRACE_PERIOD"].includes(STATUS)) {
      const error = new Error("Subscription inactive. Please activate your subscription.");
      error.code = "SUBSCRIPTION_INACTIVE";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    // If in GRACE_PERIOD, verify it hasn't ended yet
    if (STATUS === "GRACE_PERIOD" && !inGracePeriod) {
      const error = new Error("Your grace period has ended. Please renew to continue.");
      error.code = "GRACE_PERIOD_EXPIRED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    // Enforce trial visitor limit (100) regardless of grace period
    if (PLAN === "TRIAL") {
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
    }

    /* ── Resolve employee ── */
    let resolvedEmployeeId    = null;
    let resolvedEmployeeEmail = null;
    let resolvedEmployeePhone = null;
    let resolvedEmployeeName  = personToMeet || null;

    if (employeeId) {
      const [[emp]] = await conn.execute(
        `SELECT id, name, email, phone FROM company_employees
         WHERE id = ? AND company_id = ? AND is_active = 1`,
        [employeeId, companyId]
      );
      if (emp) {
        resolvedEmployeeId    = emp.id;
        resolvedEmployeeEmail = emp.email;
        resolvedEmployeePhone = emp.phone;
        resolvedEmployeeName  = emp.name;
        console.log(`[VISITOR] Employee resolved: ${emp.name} <${emp.email}> | phone: ${emp.phone || "none"}`);
      } else {
        console.warn(`[VISITOR] Employee id=${employeeId} not found or inactive for company ${companyId}`);
      }
    } else {
      console.log(`[VISITOR] No employeeId — person_to_meet: "${resolvedEmployeeName || "none"}"`);
    }

    /* ── Generate response token ── */
    const responseToken     = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt    = new Date(checkInIST.getTime() + 48 * 60 * 60 * 1000);
    const tokenExpiresMySQL = formatISTForMySQL(tokenExpiresAt);

    /* ── Insert visitor ── */
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

    /* ── Visitor code ── */
    const dateKey = formatISTDateKey(checkInIST);
    const [[{ count }]] = await conn.execute(
      `SELECT COUNT(*) AS count FROM visitors
       WHERE company_id = ? AND DATE(check_in) = CURDATE()`,
      [companyId]
    );
    const visitorCode = `CMP${companyId}-${dateKey}-${String(count).padStart(5, "0")}`;
    console.log("[VISITOR] Generated code:", visitorCode);

    /* ── Upload visitor selfie photo to S3 ── */
    const photoUrl = await uploadToS3(
      file,
      `companies/${companyId}/visitors/${visitorCode}.jpg`
    );

    await conn.execute(
      `UPDATE visitors SET visitor_code = ?, photo_url = ? WHERE id = ?`,
      [visitorCode, photoUrl, visitorId]
    );

    /* ── Fetch actual check_in stored by MySQL ── */
    const [[inserted]] = await conn.execute(
      `SELECT check_in FROM visitors WHERE id = ?`,
      [visitorId]
    );
    const storedCheckIn = inserted?.check_in;

    await conn.commit();
    console.log("[VISITOR] Saved successfully, id:", visitorId);

    /* ── Fetch company info ── */
    const [[companyInfo]] = await db.execute(
      `SELECT id, name, logo_url, whatsapp_url FROM companies WHERE id = ?`,
      [companyId]
    );

    // 48-hour presigned URLs for emails
    const logoForEmail   = companyInfo.logo_url ? await getPresignedUrl(companyInfo.logo_url, 172800) : null;
    const photoForEmail  = photoUrl              ? await getPresignedUrl(photoUrl, 172800)             : null;

    const formatForDisplay = (mysqlDatetime) => {
      if (!mysqlDatetime) return formatISTForDisplay(checkInIST);
      const raw = String(mysqlDatetime).trim();
      const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
      const d   = new Date(iso);
      if (isNaN(d.getTime())) return formatISTForDisplay(checkInIST);
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day:      "2-digit",
        month:    "short",
        year:     "numeric",
        hour:     "2-digit",
        minute:   "2-digit",
        hour12:   true,
      });
    };

    const checkInDisplay = formatForDisplay(storedCheckIn);

    /* ──────────────────────────────────────────────────────────────
       SEND VISITOR PASS VIA WHATSAPP
       ──────────────────────────────────────────────────────────────
       Flow:
         1. Generate visitor pass image as PNG buffer
         2. Send pass image + details via WhatsApp using Gupshup
       Non-blocking — errors logged, never thrown.
       Both phone and email are required fields.
    ────────────────────────────────────────────────────────────── */
    /* ── Send visitor pass link via WhatsApp ── */
    if (phone) {
      try {
        console.log("[VISITOR] Sending visitor pass link via WHATSAPP to:", phone);

        await sendVisitorPassWhatsApp({
          phone,
          company: { name: companyInfo.name },
          visitor: {
            visitorCode,
            name,
            purpose:      purpose || "Visit",
            checkInDisplay,
          },
        });

        await db.execute(
          `UPDATE visitors SET pass_mail_sent = 1 WHERE id = ?`,
          [visitorId]
        );

        console.log("[VISITOR] WhatsApp pass link sent to:", phone);
      } catch (err) {
        console.error("[VISITOR] WHATSAPP PASS ERROR:", err.message);
      }
    } else {
      console.warn("[VISITOR] No phone — visitor pass not sent");
    }

    /* ── Send visitor pass + approval request via WhatsApp to employee ── */
    if (resolvedEmployeePhone) {
      try {
        console.log("[VISITOR] Sending visitor pass WhatsApp to employee:", resolvedEmployeePhone);
        await sendVisitorPassWhatsApp({
          phone: resolvedEmployeePhone,
          company: { name: companyInfo.name },
          visitor: {
            visitorCode,
            name,
            purpose:       purpose || "Visit",
            checkInDisplay,
          },
        });
        console.log("[VISITOR] Visitor pass WhatsApp sent to employee:", resolvedEmployeePhone);
      } catch (err) {
        console.error("[VISITOR] EMPLOYEE PASS WHATSAPP ERROR:", err.message);
      }

      try {
        console.log("[VISITOR] Sending approval WhatsApp to employee:", resolvedEmployeePhone);
        await sendApprovalWhatsApp({
          phone: resolvedEmployeePhone,
          visitor: { visitorCode, name },
          responseToken,
        });
        console.log("[VISITOR] Approval WhatsApp sent to:", resolvedEmployeePhone);
      } catch (err) {
        console.error("[VISITOR] APPROVAL WHATSAPP ERROR:", err.message);
      }
    } else if (resolvedEmployeeEmail) {
      /* fallback — employee has no phone, send email */
      try {
        const { sendEmployeeNotificationMail } = await import("../utils/visitorMail.service.js");
        await sendEmployeeNotificationMail({
          company: { id: companyId, name: companyInfo.name, logo: logoForEmail },
          employee: { name: resolvedEmployeeName, email: resolvedEmployeeEmail },
          visitor: {
            visitorCode, name, phone, email: email || null,
            fromCompany: fromCompany || null, purpose: purpose || "Visit",
            checkIn: storedCheckIn || checkInMySQL, checkInDisplay,
            photoUrl: photoForEmail,
          },
          responseToken,
        });
        console.log("[VISITOR] Employee notification email sent (no phone fallback)");
      } catch (err) {
        console.error("[VISITOR] EMPLOYEE NOTIFICATION EMAIL ERROR:", err.message);
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
      gracePeriodWarning: inGracePeriod ? {
        inGracePeriod: true,
        daysRemaining: gracePeriodDaysRemaining,
        gracePeriodEndsAt: company.grace_period_ends_at,
      } : null,
    };

  } catch (err) {
    await conn.rollback();
    console.error("[VISITOR] SAVE ERROR:", err.message);
    throw err;
  } finally {
    conn.release();
  }
};
