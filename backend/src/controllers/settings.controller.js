import bcrypt from "bcrypt";
import path from "path";
import { db } from "../config/db.js";
import { uploadToS3, deleteFromS3 } from "../services/s3.service.js";
import { sendEmail } from "../utils/mailer.js";
import {
  TOGGLEABLE_VISITOR_FIELDS,
  normalizeVisitorFormFields,
} from "../constants/visitorFormFields.js";

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;

/* ======================================================
   EMAIL FOOTER
====================================================== */
const emailFooter = () => `
<br/>
Regards,<br/>
<img 
  src="https://www.haivisitor.zodopt.com/haivisitor.png"
  alt="Hai Visitor Logo"
  style="height:65px;margin:10px 0;display:block"
/>
<hr style="border:0;border-top:1px solid #ddd;margin:10px 0;" />
<p style="font-size:13px;color:#666">
This email was automatically sent from the Hai Visitor Platform.
</p>`;

/* ======================================================
   VALIDATORS
====================================================== */

/**
 * Single validator — accepts ALL WhatsApp link formats in one field:
 *
 *   Direct chat:
 *     +91XXXXXXXXXX           → auto-converts → https://wa.me/91XXXXXXXXXX
 *     91XXXXXXXXXX            → auto-converts → https://wa.me/91XXXXXXXXXX
 *     https://wa.me/...
 *     https://api.whatsapp.com/send/?phone=...
 *
 *   Group invite:
 *     https://chat.whatsapp.com/<invite-code>
 */
const validateWhatsAppUrl = (input) => {
  if (!input || !input.trim()) return null;
  const v = input.trim();

  // Plain phone number → auto-convert to wa.me link
  if (/^\+?\d{7,15}$/.test(v)) {
    return `https://wa.me/${v.replace(/^\+/, "")}`;
  }

  // Direct chat URLs
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\/.+/i.test(v)) {
    return v;
  }

  // Group invite URL
  if (/^https:\/\/chat\.whatsapp\.com\/.+/i.test(v)) {
    return v;
  }

  // Channel URL — www. is how WhatsApp's own share button actually
  // generates these links, so it must be optional here, not required.
  if (/^https:\/\/(www\.)?whatsapp\.com\/channel\/.+/i.test(v)) {
    return v;
  }

  throw new Error(
    "Invalid WhatsApp value. Accepted formats:\n" +
    "• Phone number: +918647878785\n" +
    "• Direct chat: https://wa.me/... or https://api.whatsapp.com/...\n" +
    "• Group invite: https://chat.whatsapp.com/...\n" +
    "• Channel: https://whatsapp.com/channel/... or https://www.whatsapp.com/channel/..."
  );
};

/* ======================================================
   GET SETTINGS
   GET /api/settings
====================================================== */
export const getSettings = async (req, res) => {
  try {
    const userId    = req.user?.userId;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const [[company]] = await db.execute(
      `SELECT
         id, name, slug, code_prefix, logo_url, rooms,
         whatsapp_url,
         plan, subscription_status
       FROM companies
       WHERE id = ?`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const [[user]] = await db.execute(
      `SELECT id, email, name, phone
       FROM users
       WHERE id = ? AND company_id = ?`,
      [userId, companyId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      company: {
        id:                  company.id,
        name:                company.name,
        slug:                company.slug,
        code_prefix:         company.code_prefix || null,
        logo_url:            company.logo_url ? `/api/logo/${company.id}` : null,
        rooms:               company.rooms,
        whatsapp_url:        company.whatsapp_url || null,
        plan:                company.plan,
        subscription_status: company.subscription_status,
      },
      user: {
        id:    user.id,
        email: user.email,
        name:  user.name  || null,
        phone: user.phone || null,
      },
    });

  } catch (error) {
    console.error("GET SETTINGS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
};

/* ======================================================
   UPDATE COMPANY SETTINGS
   PUT /api/settings/company
   Body: { name, whatsappUrl, whatsappGroupUrl }
====================================================== */
export const updateCompanySettings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { name, whatsappUrl, codePrefix } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Company name is required" });
    }

    // Single validator handles direct chat, group invites, and phone numbers
    const validatedWhatsAppUrl = validateWhatsAppUrl(whatsappUrl);

    // codePrefix is optional in the request — only touched when provided,
    // so name/whatsapp-only updates don't require re-sending it.
    let updatedCodePrefix;
    if (codePrefix !== undefined) {
      const cleaned = String(codePrefix || "").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(cleaned)) {
        return res.status(400).json({ success: false, message: "Visitor code prefix must be exactly 3 letters (A-Z)" });
      }
      updatedCodePrefix = cleaned;
    }

    if (updatedCodePrefix !== undefined) {
      await db.execute(
        `UPDATE companies SET name = ?, whatsapp_url = ?, code_prefix = ? WHERE id = ?`,
        [name.trim(), validatedWhatsAppUrl, updatedCodePrefix, companyId]
      );
    } else {
      await db.execute(
        `UPDATE companies SET name = ?, whatsapp_url = ? WHERE id = ?`,
        [name.trim(), validatedWhatsAppUrl, companyId]
      );
    }

    const [[updated]] = await db.execute(
      `SELECT name, whatsapp_url, logo_url, slug, code_prefix
       FROM companies WHERE id = ?`,
      [companyId]
    );

    return res.json({
      success: true,
      message: "Company settings updated successfully",
      company: {
        id:           companyId,
        name:         updated.name,
        slug:         updated.slug,
        code_prefix:  updated.code_prefix || null,
        logo_url:     updated.logo_url ? `/api/logo/${companyId}` : null,
        whatsapp_url: updated.whatsapp_url || null,
      },
    });

  } catch (error) {
    console.error("UPDATE COMPANY SETTINGS ERROR:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update company settings",
    });
  }
};

/* ======================================================
   UPDATE COMPANY LOGO
   PUT /api/settings/company/logo
====================================================== */
export const updateCompanyLogo = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Logo file is required" });
    }

    const [[company]] = await db.execute(
      `SELECT slug, logo_url FROM companies WHERE id = ?`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const oldLogoKey = company.logo_url || null;

    const ext     = path.extname(req.file.originalname || "").toLowerCase() || ".png";
    const logoKey = `companies/${company.slug}/logo${ext}`;
    const key     = await uploadToS3(req.file, logoKey); // returns S3 key

    await db.execute(
      `UPDATE companies SET logo_url = ? WHERE id = ?`,
      [key, companyId]
    );

    // Clean up the previous logo if the new upload got a different key
    // (happens when the file extension changes, e.g. .png → .jpg) —
    // otherwise the old file would sit in S3 forever, unused.
    if (oldLogoKey && oldLogoKey !== key) {
      await deleteFromS3(oldLogoKey);
    }

    return res.json({
      success:  true,
      message:  "Company logo updated successfully",
      logo_url: `/api/logo/${companyId}`,
    });

  } catch (error) {
    console.error("UPDATE COMPANY LOGO ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update company logo",
    });
  }
};

/* ======================================================
   UPDATE USER PROFILE
   PUT /api/settings/profile
====================================================== */
export const updateUserProfile = async (req, res) => {
  try {
    const userId    = req.user?.userId;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { name, phone } = req.body;

    if (!name && !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide name or phone to update",
      });
    }

    const updates = [];
    const values  = [];
    if (name  && name.trim())  { updates.push("name = ?");  values.push(name.trim()); }
    if (phone && phone.trim()) { updates.push("phone = ?"); values.push(phone.trim()); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    values.push(userId, companyId);

    await db.execute(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`,
      values
    );

    const [[updated]] = await db.execute(
      `SELECT id, email, name, phone FROM users WHERE id = ?`,
      [userId]
    );

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id:    updated.id,
        email: updated.email,
        name:  updated.name,
        phone: updated.phone,
      },
    });

  } catch (error) {
    console.error("UPDATE USER PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

/* ======================================================
   CHANGE PASSWORD
   PUT /api/settings/password
====================================================== */
export const changePassword = async (req, res) => {
  try {
    const userId    = req.user?.userId;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
      });
    }

    const [[user]] = await db.execute(
      `SELECT u.id, u.password_hash, u.email, c.name AS company_name
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = ? AND u.company_id = ?`,
      [userId, companyId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);

    // Non-blocking confirmation email
    sendPasswordChangedEmail(user.email, user.company_name).catch(console.error);

    return res.json({ success: true, message: "Password changed successfully" });

  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to change password" });
  }
};

/* ======================================================
   SEND PASSWORD CHANGED EMAIL  (internal helper)
====================================================== */
const sendPasswordChangedEmail = async (email, companyName) => {
  await sendEmail({
    to:      email,
    subject: "Hai Visitor — Password Successfully Changed",
    html: `
      <p>Hello <b>${companyName}</b>,</p>
      <p>
        This email confirms that your Hai Visitor account password has been
        <b style="color:#00c853;">successfully changed</b>.
      </p>
      <div style="background:#e8f5e9;border-left:4px solid #00c853;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#2e7d32;font-weight:600;">
          ✓ Your password has been updated securely
        </p>
      </div>
      <h3 style="color:#6c2bd9;margin-top:30px;margin-bottom:10px;">
        Important Security Notice
      </h3>
      <p><b style="color:#ff1744;">Did you make this change?</b></p>
      <ul style="font-size:14px;line-height:1.8;">
        <li><b>If yes:</b> No further action required. Your account is secure.</li>
        <li>
          <b>If no:</b> Someone may have unauthorized access.
          Please contact support <b>immediately</b>.
        </li>
      </ul>
      ${emailFooter()}
    `,
  });
};

/* ======================================================
   VISITOR FORM FIELDS — Form Builder
   GET  /api/settings/visitor-fields
   PUT  /api/settings/visitor-fields
   Body (PUT): { fields: { <fieldKey>: boolean, ... } }
   Name, WhatsApp Number, and Photo are always collected and
   are not part of this toggle set at all.
====================================================== */
export const getVisitorFormFields = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const [[company]] = await db.execute(
      `SELECT visitor_form_fields FROM companies WHERE id = ?`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    return res.json({
      success: true,
      fields: normalizeVisitorFormFields(company.visitor_form_fields),
    });
  } catch (error) {
    console.error("GET VISITOR FORM FIELDS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch form field settings" });
  }
};

export const updateVisitorFormFields = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const incoming = req.body?.fields;
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ success: false, message: "fields object is required" });
    }

    // Merge against the current stored value so a partial update (e.g. one
    // toggle flipped) never silently resets the other fields to defaults.
    const [[company]] = await db.execute(
      `SELECT visitor_form_fields FROM companies WHERE id = ?`,
      [companyId]
    );
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const current = normalizeVisitorFormFields(company.visitor_form_fields);
    const merged  = { ...current };
    for (const key of TOGGLEABLE_VISITOR_FIELDS) {
      if (typeof incoming[key] === "boolean") merged[key] = incoming[key];
    }

    await db.execute(
      `UPDATE companies SET visitor_form_fields = ? WHERE id = ?`,
      [JSON.stringify(merged), companyId]
    );

    return res.json({
      success: true,
      message: "Registration form fields updated successfully",
      fields: merged,
    });
  } catch (error) {
    console.error("UPDATE VISITOR FORM FIELDS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update form field settings" });
  }
};

/* ======================================================
   PURPOSE OF VISIT — CATEGORIES & SUB-CATEGORIES
   ------------------------------------------------------
   Company-defined categories (max 10) each with their own
   sub-purposes (max 10 per category). A company with zero
   categories keeps the plain free-text Purpose field on the
   registration form — the picker only appears once at least
   one category exists.
   GET    /api/settings/purpose-categories
   POST   /api/settings/purpose-categories                body:{name}
   PUT    /api/settings/purpose-categories/:id             body:{name}
   DELETE /api/settings/purpose-categories/:id
   PUT    /api/settings/purpose-categories/reorder         body:{order:[id,...]}
   POST   /api/settings/purpose-categories/:categoryId/subcategories  body:{name}
   PUT    /api/settings/purpose-subcategories/:id          body:{name}
   DELETE /api/settings/purpose-subcategories/:id
   PUT    /api/settings/purpose-categories/:categoryId/subcategories/reorder body:{order:[id,...]}
====================================================== */
const MAX_CATEGORIES = 10;
const MAX_SUBCATEGORIES = 10;

export const getPurposeCategories = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const [categories] = await db.execute(
      `SELECT id, name, sort_order FROM company_purpose_categories
       WHERE company_id = ? ORDER BY sort_order ASC, id ASC`,
      [companyId]
    );
    const [subcategories] = await db.execute(
      `SELECT id, category_id, name, sort_order FROM company_purpose_subcategories
       WHERE company_id = ? ORDER BY sort_order ASC, id ASC`,
      [companyId]
    );

    const categoriesOut = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sort_order,
      subcategories: subcategories
        .filter((sub) => sub.category_id === cat.id)
        .map((sub) => ({ id: sub.id, name: sub.name, sortOrder: sub.sort_order })),
    }));

    return res.json({ success: true, categories: categoriesOut });
  } catch (error) {
    console.error("GET PURPOSE CATEGORIES ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch purpose categories" });
  }
};

export const createPurposeCategory = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const name = req.body?.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: "Category name is required" });

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM company_purpose_categories WHERE company_id = ?`,
      [companyId]
    );
    if (total >= MAX_CATEGORIES) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_CATEGORIES} categories allowed` });
    }

    const [[{ nextOrder }]] = await db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM company_purpose_categories WHERE company_id = ?`,
      [companyId]
    );

    const [result] = await db.execute(
      `INSERT INTO company_purpose_categories (company_id, name, sort_order) VALUES (?, ?, ?)`,
      [companyId, name, nextOrder]
    );

    return res.status(201).json({
      success: true,
      category: { id: result.insertId, name, sortOrder: nextOrder, subcategories: [] },
    });
  } catch (error) {
    console.error("CREATE PURPOSE CATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

export const updatePurposeCategory = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const name = req.body?.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: "Category name is required" });

    const [result] = await db.execute(
      `UPDATE company_purpose_categories SET name = ? WHERE id = ? AND company_id = ?`,
      [name, id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Category not found" });

    return res.json({ success: true, message: "Category updated" });
  } catch (error) {
    console.error("UPDATE PURPOSE CATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update category" });
  }
};

export const deletePurposeCategory = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    // Sub-categories cascade-delete via FK — historical visitor records are
    // unaffected since visitors.purpose_category/purpose_subcategory are
    // plain-text snapshots, not live references to these rows.
    const [result] = await db.execute(
      `DELETE FROM company_purpose_categories WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Category not found" });

    return res.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("DELETE PURPOSE CATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to delete category" });
  }
};

export const reorderPurposeCategories = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const order = req.body?.order;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ success: false, message: "order array is required" });
    }

    await Promise.all(
      order.map((id, index) =>
        db.execute(
          `UPDATE company_purpose_categories SET sort_order = ? WHERE id = ? AND company_id = ?`,
          [index, id, companyId]
        )
      )
    );

    return res.json({ success: true, message: "Order updated" });
  } catch (error) {
    console.error("REORDER PURPOSE CATEGORIES ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to reorder categories" });
  }
};

export const createPurposeSubcategory = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { categoryId } = req.params;
    const name = req.body?.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: "Sub-purpose name is required" });

    const [[category]] = await db.execute(
      `SELECT id FROM company_purpose_categories WHERE id = ? AND company_id = ?`,
      [categoryId, companyId]
    );
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM company_purpose_subcategories WHERE category_id = ?`,
      [categoryId]
    );
    if (total >= MAX_SUBCATEGORIES) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_SUBCATEGORIES} sub-purposes allowed per category` });
    }

    const [[{ nextOrder }]] = await db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM company_purpose_subcategories WHERE category_id = ?`,
      [categoryId]
    );

    const [result] = await db.execute(
      `INSERT INTO company_purpose_subcategories (category_id, company_id, name, sort_order) VALUES (?, ?, ?, ?)`,
      [categoryId, companyId, name, nextOrder]
    );

    return res.status(201).json({
      success: true,
      subcategory: { id: result.insertId, name, sortOrder: nextOrder },
    });
  } catch (error) {
    console.error("CREATE PURPOSE SUBCATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to create sub-purpose" });
  }
};

export const updatePurposeSubcategory = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const name = req.body?.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: "Sub-purpose name is required" });

    const [result] = await db.execute(
      `UPDATE company_purpose_subcategories SET name = ? WHERE id = ? AND company_id = ?`,
      [name, id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Sub-purpose not found" });

    return res.json({ success: true, message: "Sub-purpose updated" });
  } catch (error) {
    console.error("UPDATE PURPOSE SUBCATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update sub-purpose" });
  }
};

export const deletePurposeSubcategory = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const [result] = await db.execute(
      `DELETE FROM company_purpose_subcategories WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Sub-purpose not found" });

    return res.json({ success: true, message: "Sub-purpose deleted" });
  } catch (error) {
    console.error("DELETE PURPOSE SUBCATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to delete sub-purpose" });
  }
};

export const reorderPurposeSubcategories = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { categoryId } = req.params;
    const order = req.body?.order;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ success: false, message: "order array is required" });
    }

    await Promise.all(
      order.map((id, index) =>
        db.execute(
          `UPDATE company_purpose_subcategories SET sort_order = ? WHERE id = ? AND category_id = ? AND company_id = ?`,
          [index, id, categoryId, companyId]
        )
      )
    );

    return res.json({ success: true, message: "Order updated" });
  } catch (error) {
    console.error("REORDER PURPOSE SUBCATEGORIES ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to reorder sub-purposes" });
  }
};

/* ======================================================
   CUSTOM FIELDS
   ------------------------------------------------------
   Company-defined custom fields (max 5) of type text, number,
   or dropdown, optionally marked required. Dropdown fields have
   their own company-scoped options (max 20 per field).
   Submitted values are stored as plain-text snapshots on
   visitor_custom_field_values (see visitor.service.js), so
   editing/deleting a field here never changes historical
   visitor records — it only affects future registrations.
   GET    /api/settings/custom-fields
   POST   /api/settings/custom-fields                 body:{label, fieldType, isRequired}
   PUT    /api/settings/custom-fields/:id              body:{label, fieldType, isRequired}
   DELETE /api/settings/custom-fields/:id
   PUT    /api/settings/custom-fields/reorder          body:{order:[id,...]}
   POST   /api/settings/custom-fields/:fieldId/options body:{label}
   PUT    /api/settings/custom-field-options/:id       body:{label}
   DELETE /api/settings/custom-field-options/:id
   PUT    /api/settings/custom-fields/:fieldId/options/reorder body:{order:[id,...]}
====================================================== */
const MAX_CUSTOM_FIELDS = 5;
const MAX_CUSTOM_FIELD_OPTIONS = 20;
const CUSTOM_FIELD_TYPES = ["text", "number", "dropdown"];

export const getCustomFields = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const [fields] = await db.execute(
      `SELECT id, label, field_type, is_required, sort_order FROM company_custom_fields
       WHERE company_id = ? ORDER BY sort_order ASC, id ASC`,
      [companyId]
    );
    const [options] = await db.execute(
      `SELECT id, field_id, label, sort_order FROM company_custom_field_options
       WHERE company_id = ? ORDER BY sort_order ASC, id ASC`,
      [companyId]
    );

    const fieldsOut = fields.map((f) => ({
      id: f.id,
      label: f.label,
      fieldType: f.field_type,
      isRequired: !!f.is_required,
      sortOrder: f.sort_order,
      options: f.field_type === "dropdown"
        ? options.filter((o) => o.field_id === f.id).map((o) => ({ id: o.id, label: o.label, sortOrder: o.sort_order }))
        : [],
    }));

    return res.json({ success: true, fields: fieldsOut });
  } catch (error) {
    console.error("GET CUSTOM FIELDS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch custom fields" });
  }
};

export const createCustomField = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const label = req.body?.label?.trim();
    const fieldType = req.body?.fieldType;
    const isRequired = !!req.body?.isRequired;
    if (!label) return res.status(400).json({ success: false, message: "Field label is required" });
    if (!CUSTOM_FIELD_TYPES.includes(fieldType)) {
      return res.status(400).json({ success: false, message: "fieldType must be text, number, or dropdown" });
    }

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM company_custom_fields WHERE company_id = ?`,
      [companyId]
    );
    if (total >= MAX_CUSTOM_FIELDS) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_CUSTOM_FIELDS} custom fields allowed` });
    }

    const [[{ nextOrder }]] = await db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM company_custom_fields WHERE company_id = ?`,
      [companyId]
    );

    const [result] = await db.execute(
      `INSERT INTO company_custom_fields (company_id, label, field_type, is_required, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [companyId, label, fieldType, isRequired ? 1 : 0, nextOrder]
    );

    return res.status(201).json({
      success: true,
      field: { id: result.insertId, label, fieldType, isRequired, sortOrder: nextOrder, options: [] },
    });
  } catch (error) {
    console.error("CREATE CUSTOM FIELD ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to create custom field" });
  }
};

export const updateCustomField = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const label = req.body?.label?.trim();
    const fieldType = req.body?.fieldType;
    const isRequired = !!req.body?.isRequired;
    if (!label) return res.status(400).json({ success: false, message: "Field label is required" });
    if (!CUSTOM_FIELD_TYPES.includes(fieldType)) {
      return res.status(400).json({ success: false, message: "fieldType must be text, number, or dropdown" });
    }

    const [result] = await db.execute(
      `UPDATE company_custom_fields SET label = ?, field_type = ?, is_required = ? WHERE id = ? AND company_id = ?`,
      [label, fieldType, isRequired ? 1 : 0, id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Custom field not found" });

    return res.json({ success: true, message: "Custom field updated" });
  } catch (error) {
    console.error("UPDATE CUSTOM FIELD ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update custom field" });
  }
};

export const deleteCustomField = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    // Options cascade-delete via FK — historical visitor records are
    // unaffected since visitor_custom_field_values.field_label/field_value
    // are plain-text snapshots, not live references to this row.
    const [result] = await db.execute(
      `DELETE FROM company_custom_fields WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Custom field not found" });

    return res.json({ success: true, message: "Custom field deleted" });
  } catch (error) {
    console.error("DELETE CUSTOM FIELD ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to delete custom field" });
  }
};

export const reorderCustomFields = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const order = req.body?.order;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ success: false, message: "order array is required" });
    }

    await Promise.all(
      order.map((id, index) =>
        db.execute(
          `UPDATE company_custom_fields SET sort_order = ? WHERE id = ? AND company_id = ?`,
          [index, id, companyId]
        )
      )
    );

    return res.json({ success: true, message: "Order updated" });
  } catch (error) {
    console.error("REORDER CUSTOM FIELDS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to reorder custom fields" });
  }
};

export const createCustomFieldOption = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { fieldId } = req.params;
    const label = req.body?.label?.trim();
    if (!label) return res.status(400).json({ success: false, message: "Option label is required" });

    const [[field]] = await db.execute(
      `SELECT id FROM company_custom_fields WHERE id = ? AND company_id = ?`,
      [fieldId, companyId]
    );
    if (!field) return res.status(404).json({ success: false, message: "Custom field not found" });

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM company_custom_field_options WHERE field_id = ?`,
      [fieldId]
    );
    if (total >= MAX_CUSTOM_FIELD_OPTIONS) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_CUSTOM_FIELD_OPTIONS} options allowed per field` });
    }

    const [[{ nextOrder }]] = await db.execute(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM company_custom_field_options WHERE field_id = ?`,
      [fieldId]
    );

    const [result] = await db.execute(
      `INSERT INTO company_custom_field_options (field_id, company_id, label, sort_order) VALUES (?, ?, ?, ?)`,
      [fieldId, companyId, label, nextOrder]
    );

    return res.status(201).json({
      success: true,
      option: { id: result.insertId, label, sortOrder: nextOrder },
    });
  } catch (error) {
    console.error("CREATE CUSTOM FIELD OPTION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to create option" });
  }
};

export const updateCustomFieldOption = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const label = req.body?.label?.trim();
    if (!label) return res.status(400).json({ success: false, message: "Option label is required" });

    const [result] = await db.execute(
      `UPDATE company_custom_field_options SET label = ? WHERE id = ? AND company_id = ?`,
      [label, id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Option not found" });

    return res.json({ success: true, message: "Option updated" });
  } catch (error) {
    console.error("UPDATE CUSTOM FIELD OPTION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update option" });
  }
};

export const deleteCustomFieldOption = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const [result] = await db.execute(
      `DELETE FROM company_custom_field_options WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Option not found" });

    return res.json({ success: true, message: "Option deleted" });
  } catch (error) {
    console.error("DELETE CUSTOM FIELD OPTION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to delete option" });
  }
};

export const reorderCustomFieldOptions = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { fieldId } = req.params;
    const order = req.body?.order;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ success: false, message: "order array is required" });
    }

    await Promise.all(
      order.map((id, index) =>
        db.execute(
          `UPDATE company_custom_field_options SET sort_order = ? WHERE id = ? AND field_id = ? AND company_id = ?`,
          [index, id, fieldId, companyId]
        )
      )
    );

    return res.json({ success: true, message: "Order updated" });
  } catch (error) {
    console.error("REORDER CUSTOM FIELD OPTIONS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to reorder options" });
  }
};
