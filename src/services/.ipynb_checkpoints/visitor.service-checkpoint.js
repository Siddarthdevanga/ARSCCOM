import { db } from "../config/db.js";
import { uploadToS3 } from "./s3.service.js";
import { sendVisitorPassMail } from "../utils/visitorMail.service.js";

/**
 * Save visitor with company-specific visitor code
 */
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

  /* ======================================================
     STEP 1: INSERT VISITOR (WITHOUT CODE & PHOTO)
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
      check_in
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN', NOW())
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
      idNumber || null
    ]
  );

  const visitorId = insertResult.insertId;

  /* ======================================================
     STEP 2: GENERATE COMPANY-SAFE VISITOR CODE
     Example: CMP12-00045
  ====================================================== */
  const visitorCode = `CMP${companyId}-${String(visitorId).padStart(5, "0")}`;

  /* ======================================================
     STEP 3: UPLOAD PHOTO TO S3
  ====================================================== */
  const photoUrl = await uploadToS3(
    file,
    `companies/${companyId}/visitors/${visitorCode}.jpg`
  );

  /* ======================================================
     STEP 4: UPDATE VISITOR WITH CODE & PHOTO
  ====================================================== */
  await db.execute(
    `
    UPDATE visitors
    SET visitor_code = ?, photo_url = ?
    WHERE id = ?
    `,
    [visitorCode, photoUrl, visitorId]
  );

  /* ======================================================
     STEP 5: SEND VISITOR PASS EMAIL (NON-BLOCKING)
  ====================================================== */
  try {
    if (email) {
      await sendVisitorPassMail({
        company: { id: companyId },
        visitor: {
          visitorCode,
          name,
          phone,
          email,
          checkIn: new Date(),
          photoUrl
        }
      });
    }
  } catch (mailErr) {
    // Do NOT fail visitor creation if mail fails
    console.error("VISITOR MAIL ERROR:", mailErr.message);
  }

  /* ======================================================
     STEP 6: RETURN CLEAN RESPONSE
  ====================================================== */
  return {
    id: visitorId,
    visitorCode,
    name,
    phone,
    email,
    photoUrl,
    status: "IN"
  };
};
