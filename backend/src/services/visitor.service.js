import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";

/* ======================================================
   ABSOLUTE SAFE IST HANDLING  (NO DOUBLE +5:30 ISSUE)
   Works correctly whether server = UTC or already IST
====================================================== */
const getISTDate = () => {
  const now = new Date();

  // IST offset = +5:30 (330 minutes)
  const IST_OFFSET_MIN = 330;

  // Returns minutes local->UTC (IST systems return -330)
  const currentOffsetMin = -now.getTimezoneOffset();

  // Adjust only the difference
  const diff = IST_OFFSET_MIN - currentOffsetMin;

  return new Date(now.getTime() + diff * 60 * 1000);
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

  /* ================= TRUE IST ================= */
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
      checkInIST // stored as real IST datetime
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
    [companyId, istDateString] // no timezone conversion needed since stored IST
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
          checkIn:
            istDateString + " " + checkInIST.toTimeString().slice(0, 8)
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
