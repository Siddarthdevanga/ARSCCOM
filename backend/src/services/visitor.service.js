import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";

/* ======================================================
   IST HELPERS (ABSOLUTE SAFE)
====================================================== */
const IST_OFFSET_MIN = 330;

const getISTDate = () => {
  const now = new Date();
  const offset = IST_OFFSET_MIN + now.getTimezoneOffset();
  return new Date(now.getTime() + offset * 60 * 1000);
};

const formatISTDateKey = (date) => {
  return (
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0")
  );
};

/* ======================================================
   SAVE VISITOR (HARD GUARDED)
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

  const checkInIST = getISTDate();
  if (isNaN(checkInIST.getTime()))
    throw new Error("Invalid IST datetime");

  /* ======================================================
     TRANSACTION START
  ======================================================= */
  await db.beginTransaction();

  try {
    /* ======================================================
       LOCK COMPANY (PREVENT PARALLEL INSERTS)
    ======================================================= */
    const [[company]] = await db.execute(
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

      if (new Date(company.trial_ends_at) < checkInIST)
        throw new Error("Trial expired. Please upgrade.");

      const [[{ total }]] = await db.execute(
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

      if (new Date(company.subscription_ends_at) < checkInIST)
        throw new Error(`${PLAN} subscription expired. Please renew.`);
    }

    /* ======================================================
       INSERT VISITOR
    ======================================================= */
    const [insertResult] = await db.execute(
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
        checkInIST,
      ]
    );

    const visitorId = insertResult.insertId;

    /* ======================================================
       GENERATE VISITOR CODE (DAILY SEQUENCE)
    ======================================================= */
    const dateKey = formatISTDateKey(checkInIST);

    const [[{ count }]] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
        AND DATE(check_in) = DATE(?)
      `,
      [companyId, checkInIST]
    );

    const visitorCode = `CMP${companyId}-${dateKey}-${String(count).padStart(5, "0")}`;

    /* ======================================================
       UPLOAD PHOTO
    ======================================================= */
    const photoUrl = await uploadToS3(
      file,
      `companies/${companyId}/visitors/${visitorCode}.jpg`
    );

    await db.execute(
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
    await db.commit();

    /* ======================================================
       SEND MAIL (NON-BLOCKING)
    ======================================================= */
    if (email) {
      try {
        const [[companyInfo]] = await db.execute(
          `SELECT name, logo_url FROM companies WHERE id = ?`,
          [companyId]
        );

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
            checkIn: checkInIST,
          },
        });

        await db.execute(
          `UPDATE visitors SET pass_mail_sent = 1 WHERE id = ?`,
          [visitorId]
        );
      } catch (err) {
        console.error("VISITOR MAIL ERROR:", err.message);
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
      checkInIST,
    };

  } catch (err) {
    await db.rollback();
    throw err;
  }
};
