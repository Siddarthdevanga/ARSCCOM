-- ============================================================
-- SMART FORMS — QR-code based information collectors
-- ============================================================
-- Purpose: let each company create up to 2 ACTIVE "Smart Forms" —
-- standalone, unauthenticated data-collection pages reached by
-- scanning a QR code (no OTP, no check-in/pass concept). Each form
-- has up to 5 company-defined fields (text/email/phone/dropdown/
-- dependent dropdown/rating/date/feedback) and its own branding
-- (theme, optional logo/name override, headline/subtext).
--
-- The "max 2 active" and "max 5 fields" caps are enforced in
-- application code, not the schema — same approach as the existing
-- MAX_CUSTOM_FIELDS check in settings.controller.js.
--
-- smart_forms.slug is a random, unguessable token (not derived from
-- the company slug or any sequential id) — the public URL is
-- /smart-forms/<slug>. Deleting ("retiring") a form keeps its slug
-- and row (status='retired') so historical responses stay attached
-- and reportable, but the public page shows a branded "not found"
-- instead of accepting new submissions.
--
-- Response values are stored as plain-text SNAPSHOTS (field_label +
-- field_value) on smart_form_response_values, not live foreign keys
-- — same pattern as visitor_custom_field_values — so editing or
-- deleting a field/form later never changes what a historical
-- response shows. field_id is kept only as a soft/best-effort link
-- (ON DELETE SET NULL).
-- Date: 2026-09-16
-- ============================================================

CREATE TABLE smart_forms (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL COMMENT 'Internal reference name, e.g. "Trade Show Booth"',
  slug VARCHAR(64) NOT NULL COMMENT 'Random unguessable token used in the public URL',
  status ENUM('active','retired') NOT NULL DEFAULT 'active',
  theme VARCHAR(30) NOT NULL DEFAULT 'purple',
  display_name_override VARCHAR(150) NULL,
  logo_override_url VARCHAR(500) NULL,
  headline VARCHAR(150) NULL,
  subtext VARCHAR(300) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  retired_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_smart_forms_slug (slug),
  KEY idx_smart_forms_company_status (company_id, status),
  CONSTRAINT fk_smart_forms_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE smart_form_fields (
  id INT NOT NULL AUTO_INCREMENT,
  form_id INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  field_type ENUM('text','email','phone','dropdown','dependent_dropdown','rating','date','feedback')
    NOT NULL DEFAULT 'text',
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  parent_field_id INT NULL COMMENT 'For dependent_dropdown fields — the dropdown field it depends on',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_smart_form_fields_form (form_id),
  KEY idx_smart_form_fields_parent (parent_field_id),
  CONSTRAINT fk_smart_form_fields_form
    FOREIGN KEY (form_id) REFERENCES smart_forms(id) ON DELETE CASCADE,
  CONSTRAINT fk_smart_form_fields_parent
    FOREIGN KEY (parent_field_id) REFERENCES smart_form_fields(id) ON DELETE SET NULL
);

CREATE TABLE smart_form_field_options (
  id INT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  label VARCHAR(150) NOT NULL,
  parent_option_id INT NULL COMMENT 'For a dependent_dropdown field''s options — which parent-field option this belongs under',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_smart_form_field_options_field (field_id),
  KEY idx_smart_form_field_options_parent (parent_option_id),
  CONSTRAINT fk_smart_form_field_options_field
    FOREIGN KEY (field_id) REFERENCES smart_form_fields(id) ON DELETE CASCADE,
  CONSTRAINT fk_smart_form_field_options_parent
    FOREIGN KEY (parent_option_id) REFERENCES smart_form_field_options(id) ON DELETE CASCADE
);

CREATE TABLE smart_form_responses (
  id INT NOT NULL AUTO_INCREMENT,
  form_id INT NOT NULL,
  submitted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64) NULL,
  PRIMARY KEY (id),
  KEY idx_smart_form_responses_form (form_id),
  CONSTRAINT fk_smart_form_responses_form
    FOREIGN KEY (form_id) REFERENCES smart_forms(id) ON DELETE CASCADE
);

CREATE TABLE smart_form_response_values (
  id INT NOT NULL AUTO_INCREMENT,
  response_id INT NOT NULL,
  field_id INT NULL COMMENT 'Soft link only, not relied on for rendering history',
  field_label VARCHAR(100) NOT NULL COMMENT 'Snapshot of the field label at submission time',
  field_value TEXT NULL COMMENT 'Snapshot of the submitted value at submission time',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_smart_form_response_values_response (response_id),
  KEY idx_smart_form_response_values_field (field_id),
  CONSTRAINT fk_smart_form_response_values_response
    FOREIGN KEY (response_id) REFERENCES smart_form_responses(id) ON DELETE CASCADE,
  CONSTRAINT fk_smart_form_response_values_field
    FOREIGN KEY (field_id) REFERENCES smart_form_fields(id) ON DELETE SET NULL
);

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- DROP TABLE smart_form_response_values;
-- DROP TABLE smart_form_responses;
-- DROP TABLE smart_form_field_options;
-- DROP TABLE smart_form_fields;
-- DROP TABLE smart_forms;
