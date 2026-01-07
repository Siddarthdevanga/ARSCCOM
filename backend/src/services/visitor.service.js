import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js"; 
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";

/* ======================================================
   ABSOLUTE SAFE IST
====================================================== */
const getISTDate = () => {
  const now = new Date();
  const IST_OFFSET_MIN = 330;
  const currentOffsetMin = -now.getTimezoneOffset();
  const diff = IST_OFFSET_MIN - currentOffsetMin;
  return new Date(now.getTime() + diff * 60 * 1000);
};

const formatISTDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

/* ======================================================
   SAVE VISITOR + PLAN GUARDRAILS
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

  const checkInIST = getISTDate();
  if (isNaN(checkInIST.getTime())) throw new Error("Invalid IST datetime");

  /* ======================================================
       FETCH COMPANY
  ======================================================= */
  const [[company]] = await db.execute(
    `
      SELECT 
        plan,
        subscription_status,
        trial_ends_at,
        subscription_ends_at
      FROM companies
      WHERE id = ?
      LIMIT 1
    `,
    [companyId]
  );

  if (!company) throw new Error("Company not found");

  const PLAN = (company.plan || "trial").toUpperCase();
  const STATUS = (company.subscription_status || "pending").toUpperCase();

  const now = checkInIST;

  /* ======================================================
       SUBSCRIPTION STATE VALIDATION
  ======================================================= */
  if (STATUS !== "ACTIVE" && STATUS !== "TRIAL") {
    throw new Error("Subscription inactive. Please renew subscription.");
  }

  /* ======================================================
       TRIAL RULES — 15 DAYS + 100 VISITORS
  ======================================================= */
  if (PLAN === "TRIAL") {
    if (!company.trial_ends_at) throw new Error("Trial not initialized");

    const trialEnd = new Date(company.trial_ends_at);
    if (trialEnd < now) throw new Error("Trial expired. Please upgrade plan.");

    const [[countRow]] = await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM visitors
        WHERE company_id = ?
      `,
      [companyId]
    );

    if (countRow.total >= 100) {
      throw new Error(
        "Trial limit reached. Max 100 visitors allowed. Upgrade to continue."
      );
    }
  }

  /* ======================================================
       BUSINESS & ENTERPRISE — SAME RULE NOW
       VALIDITY 30 DAYS
  ======================================================= */
  if (PLAN === "BUSINESS" || PLAN === "ENTERPRISE") {
    if (!company.subscription_ends_at) {
      throw new Error("Subscription not initialized");
    }

    const subEnd = new Date(company.subscription_ends_at);

    if (subEnd < now) {
      throw new Error(
        `${PLAN} plan expired. Please renew subscription.`
      );
    }

    // Unlimited Visitors — No Count Check
  }

  /* ======================================================
       INSERT VISITOR
  ======================================================= */
  const dateKey = formatISTDateKey(checkInIST);

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
      checkInIST
    ]
  );

  const visitorId = insertResult.insertId;

  /* ======================================================
       DAILY VISITOR COUNT CODE
  ======================================================= */
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
    [companyId, istDateString]
  );

  const dailyVisitorNumber = countRow.count;

  const visitorCode = `CMP${companyId}-${dateKey}-${String(
    dailyVisitorNumber
  ).padStart(5, "0")}`;

  /* ================= PHOTO ================= */
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
      const [[companyInfo]] = await db.execute(
        `SELECT name, logo_url FROM companies WHERE id = ?`,
        [companyId]
      );

      await sendVisitorPassMail({
        company: {
          id: companyId,
          name: companyInfo.name,
          logo: companyInfo.logo_url
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
