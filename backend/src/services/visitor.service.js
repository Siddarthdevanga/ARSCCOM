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
   SAVE VISITOR (REFINED WITH WHATSAPP SUPPORT)
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

  // Validation
  if (!name?.trim() || !phone?.trim()) {
    throw new Error("Visitor name and phone are required");
  }

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
       LOCK COMPANY (PREVENT PARALLEL INSERTS) + GET WHATSAPP
    ======================================================= */
    const [[company]] = await conn.execute(
      `
      SELECT 
        name,
        logo_url,
        whatsapp_url,
        plan, 
        subscription_status, 
        trial_ends_at, 
        subscription_ends_at
      FROM companies
      WHERE id = ?
      FOR UPDATE
      `,
      [companyId]
    );

    if (!company) {
      throw new Error("Company not found");
    }

    const PLAN = (company.plan || "TRIAL").toUpperCase();
    const STATUS = (company.subscription_status || "PENDING").toUpperCase();

    /* ======================================================
       SUBSCRIPTION VALIDATION
    ======================================================= */
    if (STATUS === "EXPIRED") {
      const error = new Error("Your subscription has expired. Please renew your subscription to continue using our services.");
      error.code = "SUBSCRIPTION_EXPIRED";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    if (!["ACTIVE", "TRIAL"].includes(STATUS)) {
      const error = new Error("Subscription inactive. Please activate your subscription to continue.");
      error.code = "SUBSCRIPTION_INACTIVE";
      error.redirectTo = "/auth/subscription";
      throw error;
    }

    /* ======================================================
       PLAN LIMITS VALIDATION
    ======================================================= */
    if (PLAN === "TRIAL") {
      if (!company.trial_ends_at) {
        const error = new Error("Trial not initialized. Please contact support or upgrade your plan.");
        error.code = "TRIAL_NOT_INITIALIZED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }

      const trialEndsDate = new Date(company.trial_ends_at);
      if (trialEndsDate < new Date(checkInMySQL)) {
        const error = new Error("Your trial period has expired. Please upgrade to a paid plan to continue using our services.");
        error.code = "TRIAL_EXPIRED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }

      const [[{ total }]] = await conn.execute(
        `
        SELECT COUNT(*) AS total
        FROM visitors
        WHERE company_id = ?
        FOR UPDATE
        `,
        [companyId]
      );

      if (total >= 100) {
        const error = new Error("Trial limit reached (100 visitors). Please upgrade to a paid plan to register more visitors.");
        error.code = "TRIAL_LIMIT_REACHED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
    } else {
      if (!company.subscription_ends_at) {
        const error = new Error("Subscription not properly initialized. Please contact support or renew your subscription.");
        error.code = "SUBSCRIPTION_NOT_INITIALIZED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }

      const subEndsDate = new Date(company.subscription_ends_at);
      if (subEndsDate < new Date(checkInMySQL)) {
        const error = new Error(`Your ${PLAN} subscription has expired. Please renew your subscription to continue using our services.`);
        error.code = "SUBSCRIPTION_EXPIRED";
        error.redirectTo = "/auth/subscription";
        throw error;
      }
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
        email?.trim() || null,
        fromCompany?.trim() || null,
        department?.trim() || null,
        designation?.trim() || null,
        address?.trim() || null,
        city?.trim() || null,
        state?.trim() || null,
        postalCode?.trim() || null,
        country?.trim() || null,
        personToMeet?.trim() || null,
        purpose?.trim() || null,
        Array.isArray(belongings)
          ? belongings.join(", ")
          : belongings?.trim() || null,
        idType?.trim() || null,
        idNumber?.trim() || null,
        checkInMySQL,
      ]
    );

    const visitorId = insertResult.insertId;

    /* ======================================================
       GENERATE VISITOR CODE (DAILY SEQUENCE)
    ======================================================= */
    const dateKey = formatISTDateKey(checkInIST);

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
       UPLOAD PHOTO TO S3
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
       SEND VISITOR PASS EMAIL (NON-BLOCKING)
    ======================================================= */
    if (email?.trim()) {
      try {
        console.log("📧 Sending visitor pass email to:", email);

        await sendVisitorPassMail({
          company: {
            id: companyId,
            name: company.name,
            logo: company.logo_url,
            whatsappUrl: company.whatsapp_url || null, // Include WhatsApp URL
          },
          visitor: {
            visitorCode,
            name,
            phone,
            email,
            photoUrl,
            checkIn: checkInMySQL,
            checkInDisplay: formatISTForDisplay(checkInIST),
          },
        });

        await db.execute(
          `UPDATE visitors SET pass_mail_sent = 1 WHERE id = ?`,
          [visitorId]
        );

        console.log("✅ Visitor pass email sent successfully");
      } catch (err) {
        console.error("❌ VISITOR MAIL ERROR:", err.message);
        // Don't throw - visitor is already saved
      }
    }

    /* ======================================================
       RETURN VISITOR DATA
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
      companyWhatsappUrl: company.whatsapp_url || null, // Return WhatsApp URL
    };

  } catch (err) {
    await conn.rollback();
    console.error("❌ VISITOR SAVE ERROR:", err.message);
    throw err;
  } finally {
    conn.release();
  }
};
