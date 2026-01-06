import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";

/* ======================================================
   ABSOLUTE SAFE IST (No Intl, No Browser Influence)
====================================================== */
const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 60 * 60 * 1000);
};

/* YYYYMMDD */
const formatISTDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

/* ======================================================
   SAVE VISITOR
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

  if (!name || !phone) throw new Error("Visitor name and phone are required");

  // TRUE IST (Stored same as India time)
  const checkInIST = getISTDate();
  if (isNaN(checkInIST.getTime())) throw new Error("Invalid IST datetime");

  const dateKey = formatISTDateKey(checkInIST);

  /* ================= INSERT ================= */
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
      Array.isArray(belongings) ? belongings.join(", ") : belongings || null,
      idType || null,
      idNumber || null,
      checkInIST     // ✅ Stored as REAL IST in DB
    ]
  );

  const visitorId = insertResult.insertId;

  /* ================= DAILY COUNT ================= */
  const istDateString = `${checkInIST.getFullYear()}-${String(
    checkInIST.getMonth() + 1
  ).padStart(2, "0")}-${String(checkInIST.getDate()).padStart(2, "0")}`;

  const [[countRow]] = await db.execute(
    `
      SELECT COUNT(*) AS count
      FROM visitors
      WHERE company_id = ?
      AND DATE(check_in) = ?
    `,
    [companyId, istDateString]       // ❌ removed CONVERT_TZ
  );

  const dailyVisitorNumber = countRow.count;

  const visitorCode = `CMP${companyId}-${dateKey}-${String(
    dailyVisitorNumber
  ).padStart(5, "0")}`;

  /* ================= PHOTO UPLOAD ================= */
  const photoUrl = await uploadToS3(
    file,
    `companies/${companyId}/visitors/${visitorCode}.jpg`
  );

  await db.execute(
    `UPDATE visitors SET visitor_code = ?, photo_url = ? WHERE id = ?`,
    [visitorCode, photoUrl, visitorId]
  );

  /* ================= MAIL ================= */
  if (email) {
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
          checkIn: istDateString + " " + checkInIST.toTimeString().slice(0, 8)
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

  return {
    id: visitorId,
    visitorCode,
    name,
    phone,
    email,
    photoUrl,
    status: "IN",
    checkInIST
  };
};
