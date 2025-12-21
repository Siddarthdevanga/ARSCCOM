import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";

/* ======================================================
   HELPERS
====================================================== */

/**
 * Returns IST Date (UTC + 5:30)
 * Server safe
 */
const getISTDate = () => {
  const nowUtc = new Date();
  return new Date(nowUtc.getTime() + 5.5 * 60 * 60 * 1000);
};

/**
 * YYYYMMDD from IST Date
 */
const formatISTDateKey = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

/* ======================================================
   SAVE VISITOR
   - Daily reset per company
   - IST consistent
   - Single mail only
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
    idNumber
  } = data;

  if (!name || !phone) {
    throw new Error("Visitor name and phone are required");
  }

  // 🔒 IST TIME (single source of truth)
  const checkInIST = getISTDate();
  if (isNaN(checkInIST.getTime())) {
    throw new Error("Invalid IST datetime");
  }

  const dateKey = formatISTDateKey(checkInIST);

  /* ======================================================
     STEP 1: INSERT VISITOR (NO CODE YET)
  ====================================================== */
  const [insertResult] = await db.execute(
    `
    INSERT INTO visitors (
      company_id,
      name,
      phone,
      email,
      from_company,
      department,
      designation,
      address,
      city,
      state,
      postal_code,
      country,
      person_to_meet,
      purpose,
      belongings,
      id_type,
      id_number,
      status,
      check_in,
      pass_mail_sent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN', ?, 0)
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
      checkInIST
    ]
  );

  const visitorId = insertResult.insertId;

  /* ======================================================
     STEP 2: DAILY COUNT (COMPANY + DATE)
  ====================================================== */
  const [[countRow]] = await db.execute(
    `
    SELECT COUNT(*) AS count
    FROM visitors
    WHERE company_id = ?
      AND DATE(check_in) = DATE(?)
    `,
    [companyId, checkInIST]
  );

  const dailyVisitorNumber = countRow.count;

  const visitorCode = `CMP${companyId}-${dateKey}-${String(
    dailyVisitorNumber
  ).padStart(5, "0")}`;

  /* ======================================================
     STEP 3: UPLOAD PHOTO
  ====================================================== */
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
     STEP 4: SEND VISITOR PASS MAIL (ONCE)
  ====================================================== */
  if (email) {
    const [[row]] = await db.execute(
      `SELECT pass_mail_sent FROM visitors WHERE id = ?`,
      [visitorId]
    );

    if (!row.pass_mail_sent) {
      try {
        const [[company]] = await db.execute(
          `SELECT name, logo_url FROM companies WHERE id = ?`,
          [companyId]
        );

        await sendVisitorPassMail({
          company: {
            id: companyId,
            name: company.name,
            logo: company.logo_url
          },
          visitor: {
            visitorCode,
            name,
            phone,
            email,
            photoUrl,
            checkIn: checkInIST
          }
        });

        await db.execute(
          `UPDATE visitors SET pass_mail_sent = 1 WHERE id = ?`,
          [visitorId]
        );
      } catch (err) {
        console.error("VISITOR MAIL ERROR:", err.message);
      }
    }
  }

  /* ======================================================
     STEP 5: RETURN RESPONSE
  ====================================================== */
  return {
    id: visitorId,
    visitorCode,
    name,
    phone,
    email,
    photoUrl,
    status: "IN",
    checkIn: checkInIST
  };
};
