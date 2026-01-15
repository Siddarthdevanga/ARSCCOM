import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";

/* ======================================================
   IST HELPERS (CORRECTED)
====================================================== */

/**
 * Get current IST date/time
 * IST is UTC+5:30 (330 minutes ahead of UTC)
 */
const getISTDate = () => {
  const now = new Date();
  // Convert to IST by adding 5 hours 30 minutes to UTC
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  return new Date(now.getTime() + istOffset);
};

/**
 * Format IST date to MySQL datetime string
 * Returns: "YYYY-MM-DD HH:MM:SS"
 */
const formatISTForMySQL = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Format IST date to date key for visitor code
 * Returns: "YYYYMMDD"
 */
const formatISTDateKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

/**
 * Format IST date for display
 * Returns: "DD MMM YYYY, HH:MM AM/PM"
 */
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
   SAVE VISITOR (FIXED TRANSACTION WITH CORRECT IST)
====================================================== */
export const saveVisitor = async (companyId, data, file) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!file) throw new Error("Visitor photo is required");

  const {
    name,
    phone,
    email,
    fromCompany,
    department,
    designation,
    address,
    city,
    state,
    postalCode,
    country,
    personToMeet,
    purpose,
    belongings,
    idType,
    idNumber,
  } = data;

  if (!name?.trim() || !phone?.trim())
    throw new Error("Visitor name and phone are required");

  // Get current IST time
  const checkInIST = getISTDate();
  const checkInMySQL = formatISTForMySQL(checkInIST);
  
  console.log("✅ Current IST Time:", formatISTForDisplay(checkInIST));
  console.log("✅ MySQL Format:", checkInMySQL);

  /* ======================================================
     GET CONNECTION FOR TRANSACTION
  ======================================================= */
  const conn = await db.getConnection();

  try {
    /* ======================================================
       START TRANSACTION
    ======================================================= */
    await conn.beginTransaction();

    /* ======================================================
       LOCK COMPANY (PREVENT PARALLEL INSERTS)
    ======================================================= */
    const [[company]] = await conn.execute(
      `
      SELECT plan, subscription_status, trial_ends_at, subscription_ends_at
      FROM companies
      WHERE id = ?
      FOR UPDATE
      `,
      [companyId]
    );

    if (!company) throw new Error("Company not found");

    const PLAN = (company.plan || "TRIAL").toUpperCase();
    const STATUS = (company.subscription_status || "PENDING").toUpperCase();

    if (!["ACTIVE", "TRIAL"].includes(STATUS))
      throw new Error("Subscription inactive. Please renew.");

    /* ======================================================
       PLAN VALIDATION
    ======================================================= */
    if (PLAN === "TRIAL") {
      if (!company.trial_ends_at)
        throw new Error("Trial not initialized");

      // Compare using current IST time
      const trialEndsDate = new Date(company.trial_ends_at);
      if (trialEndsDate < new Date(checkInMySQL))
        throw new Error("Trial expired. Please upgrade.");

      const [[{ total }]] = await conn.execute(
        `
        SELECT COUNT(*) AS total
        FROM visitors
        WHERE company_id = ?
        FOR UPDATE
        `,
        [companyId]
      );

      if (total >= 100)
        throw new Error(
          "Trial limit reached (100 visitors). Please upgrade."
        );
    } else {
      if (!company.subscription_ends_at)
        throw new Error("Subscription not initialized");

      // Compare using current IST time
      const subEndsDate = new Date(company.subscription_ends_at);
      if (subEndsDate < new Date(checkInMySQL))
        throw new Error(`${PLAN} subscription expired. Please renew.`);
    }

    /* ======================================================
       INSERT VISITOR WITH CORRECT IST TIME
    ======================================================= */
    const [insertResult] = await conn.execute(
      `
      INSERT INTO visitors (
        company_id, name, phone, email, from_company, department, designation,
        address, city, state, postal_code, country,
        person_to_meet, purpose, belongings,
        id_type, id_number,
        status, check_in, pass_mail_sent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN', ?, 0)
      `,
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
        personToMeet || null,
        purpose || null,
        Array.isArray(belongings)
          ? belongings.join(", ")
          : belongings || null,
        idType || null,
        idNumber || null,
        checkInMySQL, // Store as MySQL datetime string
      ]
    );

    const visitorId = insertResult.insertId;

    /* ======================================================
       GENERATE VISITOR CODE (DAILY SEQUENCE)
    ======================================================= */
    const dateKey = formatISTDateKey(checkInIST);

    // Count visitors for today (using DATE function on stored datetime)
    const [[{ count }]] = await conn.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND DATE(check_in) = DATE(?)
      `,
      [companyId, checkInMySQL]
    );

    const visitorCode = `CMP${companyId}-${dateKey}-${String(count).padStart(5, "0")}`;

    console.log("✅ Generated Visitor Code:", visitorCode);

    /* ======================================================
       UPLOAD PHOTO
    ======================================================= */
    const photoUrl = await uploadToS3(
      file,
      `companies/${companyId}/visitors/${visitorCode}.jpg`
    );

    await conn.execute(
      `
      UPDATE visitors
      SET visitor_code = ?, photo_url = ?
      WHERE id = ?
      `,
      [visitorCode, photoUrl, visitorId]
    );

    /* ======================================================
       COMMIT TRANSACTION
    ======================================================= */
    await conn.commit();

    console.log("✅ Visitor saved successfully with ID:", visitorId);

    /* ======================================================
       SEND MAIL (NON-BLOCKING)
    ======================================================= */
    if (email) {
      try {
        const [[companyInfo]] = await db.execute(
          `SELECT name, logo_url FROM companies WHERE id = ?`,
          [companyId]
        );

        console.log("📧 Sending visitor pass email to:", email);

        await sendVisitorPassMail({
          company: {
            id: companyId,
            name: companyInfo.name,
            logo: companyInfo.logo_url,
          },
          visitor: {
            visitorCode,
            name,
            phone,
            email,
            photoUrl,
            checkIn: checkInMySQL, // Pass MySQL datetime string
            checkInDisplay: formatISTForDisplay(checkInIST), // Pass formatted display time
          },
        });

        await db.execute(
          `UPDATE visitors SET pass_mail_sent = 1 WHERE id = ?`,
          [visitorId]
        );

        console.log("✅ Visitor pass email sent successfully");
      } catch (err) {
        console.error("❌ VISITOR MAIL ERROR:", err.message);
      }
    }

    /* ======================================================
       FINAL RESPONSE
    ======================================================= */
    return {
      id: visitorId,
      visitorCode,
      name,
      phone,
      email,
      photoUrl,
      status: "IN",
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
