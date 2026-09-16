import { db } from "../config/db.js";
import crypto from "crypto";
import path from "path";
import { uploadToS3, deleteFromS3, getS3Object } from "./s3.service.js";
import {
  MAX_ACTIVE_FORMS, MAX_FIELDS_PER_FORM, MAX_OPTIONS_PER_FIELD,
  FIELD_TYPES, THEME_KEYS, DEFAULT_THEME,
} from "../constants/smartForms.js";

/* ======================================================
   HELPERS
====================================================== */
const generateSlug = () => crypto.randomBytes(16).toString("hex"); // unguessable, not sequential

const validateFieldsPayload = (fields) => {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("At least one field is required");
  }
  if (fields.length > MAX_FIELDS_PER_FORM) {
    throw new Error(`Maximum ${MAX_FIELDS_PER_FORM} fields allowed`);
  }
  fields.forEach((f, i) => {
    if (!f.label?.trim()) throw new Error(`Field ${i + 1}: label is required`);
    if (!FIELD_TYPES.includes(f.fieldType)) throw new Error(`Field ${i + 1}: invalid field type`);
    if (f.fieldType === "dependent_dropdown") {
      if (typeof f.dependsOnFieldIndex !== "number" || f.dependsOnFieldIndex >= i || f.dependsOnFieldIndex < 0) {
        throw new Error(`Field ${i + 1}: dependent dropdown must depend on an earlier field in the list`);
      }
      const parent = fields[f.dependsOnFieldIndex];
      if (!parent || !["dropdown", "dependent_dropdown"].includes(parent.fieldType)) {
        throw new Error(`Field ${i + 1}: the field it depends on must itself be a dropdown`);
      }
    }
    if (["dropdown", "dependent_dropdown"].includes(f.fieldType)) {
      if (!Array.isArray(f.options) || f.options.length === 0) {
        throw new Error(`Field ${i + 1}: at least one option is required`);
      }
      if (f.options.length > MAX_OPTIONS_PER_FIELD) {
        throw new Error(`Field ${i + 1}: maximum ${MAX_OPTIONS_PER_FIELD} options allowed`);
      }
      f.options.forEach((o, oi) => {
        if (!o.label?.trim()) throw new Error(`Field ${i + 1}, option ${oi + 1}: label is required`);
        if (f.fieldType === "dependent_dropdown") {
          const parentOptions = fields[f.dependsOnFieldIndex].options || [];
          if (typeof o.parentOptionIndex !== "number" || o.parentOptionIndex < 0 || o.parentOptionIndex >= parentOptions.length) {
            throw new Error(`Field ${i + 1}, option ${oi + 1}: must be linked to a valid parent option`);
          }
        }
      });
    }
  });
};

const insertFields = async (conn, formId, fields) => {
  const fieldIds = [];
  const optionIdsByField = [];

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const parentFieldId = f.fieldType === "dependent_dropdown" ? fieldIds[f.dependsOnFieldIndex] : null;

    const [result] = await conn.execute(
      `INSERT INTO smart_form_fields (form_id, label, field_type, is_required, sort_order, parent_field_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [formId, f.label.trim(), f.fieldType, f.isRequired ? 1 : 0, i, parentFieldId]
    );
    const fieldId = result.insertId;
    fieldIds.push(fieldId);

    const optionIds = [];
    if (["dropdown", "dependent_dropdown"].includes(f.fieldType)) {
      for (let oi = 0; oi < f.options.length; oi++) {
        const o = f.options[oi];
        const parentOptionId = f.fieldType === "dependent_dropdown"
          ? optionIdsByField[f.dependsOnFieldIndex][o.parentOptionIndex]
          : null;
        const [optResult] = await conn.execute(
          `INSERT INTO smart_form_field_options (field_id, label, parent_option_id, sort_order) VALUES (?, ?, ?, ?)`,
          [fieldId, o.label.trim(), parentOptionId, oi]
        );
        optionIds.push(optResult.insertId);
      }
    }
    optionIdsByField.push(optionIds);
  }
  return fieldIds;
};

/* ======================================================
   CREATE FORM
====================================================== */
export const createForm = async (companyId, payload) => {
  const name = payload?.name?.trim();
  if (!name) throw new Error("Form name is required");

  const theme = THEME_KEYS.includes(payload?.theme) ? payload.theme : DEFAULT_THEME;
  validateFieldsPayload(payload?.fields);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[{ activeCount }]] = await conn.execute(
      `SELECT COUNT(*) AS activeCount FROM smart_forms WHERE company_id = ? AND status = 'active' FOR UPDATE`,
      [companyId]
    );
    if (activeCount >= MAX_ACTIVE_FORMS) {
      throw new Error(`Maximum ${MAX_ACTIVE_FORMS} active Smart Forms allowed — retire one before creating another`);
    }

    const slug = generateSlug();
    const [formResult] = await conn.execute(
      `INSERT INTO smart_forms (company_id, name, slug, theme, display_name_override, logo_override_url, headline, subtext)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, name, slug, theme,
        payload.displayNameOverride?.trim() || null,
        payload.logoOverrideUrl?.trim() || null,
        payload.headline?.trim() || null,
        payload.subtext?.trim() || null,
      ]
    );
    const formId = formResult.insertId;
    await insertFields(conn, formId, payload.fields);

    await conn.commit();
    return { id: formId, slug };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   UPDATE FORM — branding + full field replacement (simplest
   correct approach given dependent-dropdown option relations;
   existing field ids are not preserved across an edit, but
   historical responses are unaffected since values are
   snapshotted, not live-linked).
====================================================== */
export const updateForm = async (companyId, formId, payload) => {
  const name = payload?.name?.trim();
  if (!name) throw new Error("Form name is required");
  const theme = THEME_KEYS.includes(payload?.theme) ? payload.theme : DEFAULT_THEME;
  validateFieldsPayload(payload?.fields);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[form]] = await conn.execute(
      `SELECT id FROM smart_forms WHERE id = ? AND company_id = ? FOR UPDATE`,
      [formId, companyId]
    );
    if (!form) throw new Error("Smart Form not found");

    await conn.execute(
      `UPDATE smart_forms SET name = ?, theme = ?, display_name_override = ?, logo_override_url = ?, headline = ?, subtext = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name, theme,
        payload.displayNameOverride?.trim() || null,
        payload.logoOverrideUrl?.trim() || null,
        payload.headline?.trim() || null,
        payload.subtext?.trim() || null,
        formId,
      ]
    );

    // Replace fields entirely — options cascade-delete with their field.
    await conn.execute(`DELETE FROM smart_form_fields WHERE form_id = ?`, [formId]);
    await insertFields(conn, formId, payload.fields);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   LOGO OVERRIDE UPLOAD — per-form branding, separate from the
   company's own account logo (a form can be styled for a
   specific campaign/event without touching the real logo).
====================================================== */
export const uploadFormLogo = async (companyId, formId, file) => {
  if (!file) throw new Error("Logo file is required");

  const [[form]] = await db.execute(
    `SELECT slug, logo_override_url FROM smart_forms WHERE id = ? AND company_id = ?`,
    [formId, companyId]
  );
  if (!form) throw new Error("Smart Form not found");

  const oldKey = form.logo_override_url || null;
  const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
  const key = await uploadToS3(file, `smart-forms/${form.slug}/logo${ext}`);

  await db.execute(`UPDATE smart_forms SET logo_override_url = ? WHERE id = ?`, [key, formId]);
  if (oldKey && oldKey !== key) await deleteFromS3(oldKey);

  return { logoUrl: `/api/public/smart-forms/${form.slug}/logo` };
};

export const getFormLogoBySlug = async (slug) => {
  const [[form]] = await db.execute(
    `SELECT logo_override_url FROM smart_forms WHERE slug = ? AND status = 'active'`,
    [slug]
  );
  if (!form?.logo_override_url) return null;
  return getS3Object(form.logo_override_url);
};

/* ======================================================
   RETIRE FORM — keeps the row + all historical responses,
   just stops accepting new submissions and frees a slot.
====================================================== */
export const retireForm = async (companyId, formId) => {
  const [result] = await db.execute(
    `UPDATE smart_forms SET status = 'retired', retired_at = NOW() WHERE id = ? AND company_id = ? AND status = 'active'`,
    [formId, companyId]
  );
  if (!result.affectedRows) throw new Error("Active Smart Form not found");
};

/* ======================================================
   LIST FORMS (company dashboard)
====================================================== */
export const listForms = async (companyId) => {
  const [forms] = await db.execute(
    `SELECT f.id, f.name, f.slug, f.status, f.theme, f.display_name_override, f.logo_override_url,
        f.created_at, f.retired_at,
        (SELECT COUNT(*) FROM smart_form_responses r WHERE r.form_id = f.id) AS response_count
     FROM smart_forms f
     WHERE f.company_id = ?
     ORDER BY f.status = 'active' DESC, f.created_at DESC`,
    [companyId]
  );
  // The raw S3 key (logo_override_url) is an internal detail — the
  // frontend only needs to know whether an override exists, and can
  // fetch it via the public logo-proxy route by slug.
  return forms.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    status: f.status,
    theme: f.theme,
    displayNameOverride: f.display_name_override,
    hasLogoOverride: !!f.logo_override_url,
    created_at: f.created_at,
    retired_at: f.retired_at,
    response_count: f.response_count,
  }));
};

/* ======================================================
   GET FORM FOR EDIT (with fields + options, company-owned)
====================================================== */
export const getFormForEdit = async (companyId, formId) => {
  const [[form]] = await db.execute(
    `SELECT id, name, slug, status, theme, display_name_override, logo_override_url, headline, subtext
     FROM smart_forms WHERE id = ? AND company_id = ?`,
    [formId, companyId]
  );
  if (!form) throw new Error("Smart Form not found");

  const [fields] = await db.execute(
    `SELECT id, label, field_type, is_required, sort_order, parent_field_id
     FROM smart_form_fields WHERE form_id = ? ORDER BY sort_order ASC, id ASC`,
    [formId]
  );
  const fieldIds = fields.map((f) => f.id);
  let options = [];
  if (fieldIds.length) {
    const [rows] = await db.query(
      `SELECT id, field_id, label, parent_option_id, sort_order FROM smart_form_field_options
       WHERE field_id IN (${fieldIds.map(() => "?").join(",")}) ORDER BY sort_order ASC, id ASC`,
      fieldIds
    );
    options = rows;
  }

  const fieldIndexById = new Map(fields.map((f, i) => [f.id, i]));
  const optionIndexById = new Map(options.map((o, i) => [o.id, i]));

  return {
    id: form.id,
    name: form.name,
    slug: form.slug,
    status: form.status,
    theme: form.theme,
    displayNameOverride: form.display_name_override,
    logoOverrideUrl: form.logo_override_url,
    headline: form.headline,
    subtext: form.subtext,
    fields: fields.map((f) => ({
      label: f.label,
      fieldType: f.field_type,
      isRequired: !!f.is_required,
      dependsOnFieldIndex: f.parent_field_id ? fieldIndexById.get(f.parent_field_id) : null,
      options: options
        .filter((o) => o.field_id === f.id)
        .map((o) => ({
          label: o.label,
          parentOptionIndex: o.parent_option_id ? optionIndexById.get(o.parent_option_id) : null,
        })),
    })),
  };
};

/* ======================================================
   PUBLIC — get an active form by slug for the scan page
====================================================== */
export const getPublicForm = async (slug) => {
  const [[form]] = await db.execute(
    `SELECT f.id, f.name, f.theme, f.display_name_override, f.logo_override_url, f.headline, f.subtext,
        c.id AS company_id, c.name AS company_name, c.logo_url
     FROM smart_forms f
     JOIN companies c ON c.id = f.company_id
     WHERE f.slug = ? AND f.status = 'active'`,
    [slug]
  );
  if (!form) return null;

  const [fields] = await db.execute(
    `SELECT id, label, field_type, is_required, sort_order, parent_field_id
     FROM smart_form_fields WHERE form_id = ? ORDER BY sort_order ASC, id ASC`,
    [form.id]
  );
  const fieldIds = fields.map((f) => f.id);
  let options = [];
  if (fieldIds.length) {
    const [rows] = await db.query(
      `SELECT id, field_id, label, parent_option_id, sort_order FROM smart_form_field_options
       WHERE field_id IN (${fieldIds.map(() => "?").join(",")}) ORDER BY sort_order ASC, id ASC`,
      fieldIds
    );
    options = rows;
  }

  return {
    theme: form.theme,
    displayName: form.display_name_override || form.company_name,
    logoUrl: form.logo_override_url || null,
    companyId: form.company_id,
    headline: form.headline || `Welcome to ${form.display_name_override || form.company_name}`,
    subtext: form.subtext || "Please fill in your details below.",
    fields: fields.map((f) => ({
      id: f.id,
      label: f.label,
      fieldType: f.field_type,
      isRequired: !!f.is_required,
      parentFieldId: f.parent_field_id,
      options: options
        .filter((o) => o.field_id === f.id)
        .map((o) => ({ id: o.id, label: o.label, parentOptionId: o.parent_option_id })),
    })),
  };
};

/* ======================================================
   PUBLIC — submit a response
====================================================== */
export const submitResponse = async (slug, values, ipAddress) => {
  const [[form]] = await db.execute(
    `SELECT id FROM smart_forms WHERE slug = ? AND status = 'active'`,
    [slug]
  );
  if (!form) throw new Error("This form is no longer accepting responses");

  const [fields] = await db.execute(
    `SELECT id, label, field_type, is_required FROM smart_form_fields WHERE form_id = ?`,
    [form.id]
  );

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const f of fields) {
      const raw = values?.[f.id];
      const val = raw === undefined || raw === null ? "" : String(raw).trim();
      if (f.is_required && !val) throw new Error(`${f.label} is required`);
      if (val && f.field_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        throw new Error(`${f.label}: enter a valid email address`);
      }
      if (val && f.field_type === "phone" && !/^\d{10}$/.test(val.replace(/\D/g, ""))) {
        throw new Error(`${f.label}: enter a valid 10-digit phone number`);
      }
    }

    const [respResult] = await conn.execute(
      `INSERT INTO smart_form_responses (form_id, ip_address) VALUES (?, ?)`,
      [form.id, ipAddress || null]
    );
    const responseId = respResult.insertId;

    for (const f of fields) {
      const raw = values?.[f.id];
      const val = raw === undefined || raw === null ? null : String(raw).trim() || null;
      await conn.execute(
        `INSERT INTO smart_form_response_values (response_id, field_id, field_label, field_value) VALUES (?, ?, ?, ?)`,
        [responseId, f.id, f.label, val]
      );
    }

    await conn.commit();
    return { responseId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   RESPONSES — list + export (company dashboard)
====================================================== */
export const getResponses = async (companyId, formId, { search, from, to } = {}) => {
  const [[form]] = await db.execute(
    `SELECT id, name FROM smart_forms WHERE id = ? AND company_id = ?`,
    [formId, companyId]
  );
  if (!form) throw new Error("Smart Form not found");

  let where = "WHERE r.form_id = ?";
  const params = [formId];
  if (from) { where += " AND DATE(r.submitted_at) >= ?"; params.push(from); }
  if (to)   { where += " AND DATE(r.submitted_at) <= ?"; params.push(to); }

  const [responses] = await db.query(
    `SELECT id, submitted_at FROM smart_form_responses r ${where} ORDER BY submitted_at DESC`,
    params
  );
  const responseIds = responses.map((r) => r.id);
  if (!responseIds.length) return { formName: form.name, responses: [] };

  const [values] = await db.query(
    `SELECT response_id, field_label, field_value FROM smart_form_response_values
     WHERE response_id IN (${responseIds.map(() => "?").join(",")})`,
    responseIds
  );

  const valuesByResponse = new Map();
  for (const v of values) {
    if (!valuesByResponse.has(v.response_id)) valuesByResponse.set(v.response_id, {});
    valuesByResponse.get(v.response_id)[v.field_label] = v.field_value;
  }

  let rows = responses.map((r) => ({
    id: r.id,
    submittedAt: r.submitted_at,
    values: valuesByResponse.get(r.id) || {},
  }));

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter((r) => Object.values(r.values).some((v) => String(v || "").toLowerCase().includes(q)));
  }

  return { formName: form.name, responses: rows };
};
