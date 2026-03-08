import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";
import { sendEmployeeNotificationMail } from "../utils/visitorMail.service.js";
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
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatISTDateKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const formatISTForDisplay = (date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
};

/* ======================================================
   SAVE VISITOR
====================================================== */
export const saveVisitor = async (companyId, data, file) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!file) throw new Error("Visitor photo is required");

  const {
    name, phone, email, fromCompany, department, designation,
    address, city, state, postalCode, country,
    personToMeet, employeeId,
    purpose, belongings, idType, idNumber,
  } = data;

  if (!name?.trim() || !phone?.trim())
    throw new Error("Visitor name and phone are required");

  const checkInIST = getISTDate();
  const checkInMySQL = formatISTForMySQL(checkInIST);

  console.log("✅ Current IST Time:", formatISTForDisplay(checkInIST));
  console.log("✅ MySQL Format:", checkInMySQL);

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

    const PLAN = (company.plan || "TRIAL").toUpperCase();
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
      if (trialEndsDate < new Date(checkInMySQL)) {
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
      if (subEndsDate < new Date(checkInMySQL)) {
        const error = new Error(`Your ${PLAN} subscription has expired. Please renew.`);
        error.code = "SUBSCRIPTION_EXPIRED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
    }

    /* ── Resolve employee ── */
    let resolvedEmployeeId = null;
    let resolvedEmployeeEmail = null;
    let resolvedEmployeeName = personToMeet || null;

    if (employeeId) {
      const [[emp]] = await conn.execute(
        `SELECT id, name, email FROM company_employees
         WHERE id = ? AND company_id = ? AND is_active = 1`,
        [employeeId, companyId]
      );
      if (emp) {
        resolvedEmployeeId = emp.id;
        resolvedEmployeeEmail = emp.email;
        resolvedEmployeeName = emp.name;
      }
    }

    /* ── Generate response token ── */
    const responseToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(checkInIST.getTime() + 48 * 60 * 60 * 1000);
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN', 'pending', ?, 0, ?, ?)`,
      [
        companyId,
        name.trim(),
        phone.trim(),
        email || null,
        fromCompany || null,
        department || null,
        designation || null,
        address || null,
        city || null,
        state || null,
        postalCode || null,
        country || null,
        resolvedEmployeeName,
        resolvedEmployeeId,
        purpose || null,
        Array.isArray(belongings) ? belongings.join(", ") : belongings || null,
        idType || null,
        idNumber || null,
        checkInMySQL,
        responseToken,
        tokenExpiresMySQL,
      ]
    );

    const visitorId = insertResult.insertId;

    /* ── Visitor code ── */
    const dateKey = formatISTDateKey(checkInIST);
    const [[{ count }]] = await conn.execute(
      `SELECT COUNT(*) AS count FROM visitors
       WHERE company_id = ? AND DATE(check_in) = DATE(?)`,
      [companyId, checkInMySQL]
    );
    const visitorCode = `CMP${companyId}-${dateKey}-${String(count).padStart(5, "0")}`;

    console.log("✅ Generated Visitor Code:", visitorCode);

    /* ── Upload photo ── */
    const photoUrl = await uploadToS3(
      file,
      `companies/${companyId}/visitors/${visitorCode}.jpg`
    );

    await conn.execute(
      `UPDATE visitors SET visitor_code = ?, photo_url = ? WHERE id = ?`,
      [visitorCode, photoUrl, visitorId]
    );

    await conn.commit();

    console.log("✅ Visitor saved successfully with ID:", visitorId);

    /* ── Fetch company info for emails ── */
    const [[companyInfo]] = await db.execute(
      `SELECT name, logo_url, whatsapp_url FROM companies WHERE id = ?`,
      [companyId]
    );

    /* ── Send visitor pass email (non-blocking) ── */
    if (email) {
      try {
        console.log("📧 Sending visitor pass email to:", email);
        await sendVisitorPassMail({
          company: {
            id: companyId,
            name: companyInfo.name,
            logo: companyInfo.logo_url,
            whatsapp_url: companyInfo.whatsapp_url || null,
          },
          visitor: {
            visitorCode,
            name,
            phone,
            email,
            photoUrl,
            checkIn: checkInMySQL,
            checkInDisplay: formatISTForDisplay(checkInIST),
            personToMeet: resolvedEmployeeName || "Reception",
            purpose: purpose || "Visit",
          },
        });
        await db.execute(
          `UPDATE visitors SET pass_mail_sent = 1 WHERE id = ?`,
          [visitorId]
        );
        console.log("✅ Visitor pass email sent");
      } catch (err) {
        console.error("❌ VISITOR PASS MAIL ERROR:", err.message);
      }
    }

    /* ── Send employee notification email (non-blocking) ── */
    if (resolvedEmployeeEmail) {
      try {
        console.log("📧 Sending employee notification to:", resolvedEmployeeEmail);
        await sendEmployeeNotificationMail({
          company: {
            id: companyId,
            name: companyInfo.name,
            logo: companyInfo.logo_url,
          },
          employee: {
            name: resolvedEmployeeName,
            email: resolvedEmployeeEmail,
          },
          visitor: {
            visitorCode,
            name,
            phone,
            email: email || null,
            fromCompany: fromCompany || null,
            purpose: purpose || "Visit",
            checkIn: checkInMySQL,
            checkInDisplay: formatISTForDisplay(checkInIST),
            photoUrl,
          },
          responseToken,
        });
        console.log("✅ Employee notification email sent");
      } catch (err) {
        console.error("❌ EMPLOYEE NOTIFICATION MAIL ERROR:", err.message);
      }
    }

    return {
      id: visitorId,
      visitorCode,
      name,
      phone,
      email,
      photoUrl,
      status: "IN",
      visitStatus: "pending",
      checkIn: checkInMySQL,
      checkInDisplay: formatISTForDisplay(checkInIST),
    };

  } catch (err) {
    await conn.rollback();
    console.error("❌ VISITOR SAVE ERROR:", err.message);
    throw err;
  } finally {
    conn.release();
  }
};
