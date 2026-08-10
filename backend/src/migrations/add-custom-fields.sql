-- ============================================================
-- COMPANY-DEFINED CUSTOM FIELDS
-- ============================================================
-- Purpose: let each company optionally define up to 5 custom fields
-- of their own (text, number, or dropdown) that appear on the
-- visitor registration form, in addition to the fixed field set.
--
-- Submitted values are stored as plain-text SNAPSHOTS (field_label +
-- field_value) on visitor_custom_field_values, not live foreign keys
-- into company_custom_fields — so editing or deleting a field
-- definition later never changes what historical visitor records
-- show. field_id is kept only as a soft/best-effort link (ON DELETE
-- SET NULL) for admin convenience, mirroring the purpose_category /
-- purpose_subcategory snapshot pattern on visitors.
-- Date: 2026-08-10
-- ============================================================

CREATE TABLE company_custom_fields (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  field_type ENUM('text','number','dropdown') NOT NULL DEFAULT 'text',
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_custom_fields_company (company_id),
  CONSTRAINT fk_custom_fields_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE company_custom_field_options (
  id INT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  company_id INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_custom_field_options_field (field_id),
  KEY idx_company_custom_field_options_company (company_id),
  CONSTRAINT fk_custom_field_options_field
    FOREIGN KEY (field_id) REFERENCES company_custom_fields(id) ON DELETE CASCADE,
  CONSTRAINT fk_custom_field_options_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE visitor_custom_field_values (
  id INT NOT NULL AUTO_INCREMENT,
  visitor_id INT NOT NULL,
  field_id INT NULL COMMENT 'Soft link only, not relied on for rendering history',
  field_label VARCHAR(100) NOT NULL COMMENT 'Snapshot of the field label at submission time',
  field_value TEXT NULL COMMENT 'Snapshot of the submitted value at submission time',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_visitor_custom_field_values_visitor (visitor_id),
  KEY idx_visitor_custom_field_values_field (field_id),
  CONSTRAINT fk_custom_field_values_visitor
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE,
  CONSTRAINT fk_custom_field_values_field
    FOREIGN KEY (field_id) REFERENCES company_custom_fields(id) ON DELETE SET NULL
);

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- DROP TABLE visitor_custom_field_values;
-- DROP TABLE company_custom_field_options;
-- DROP TABLE company_custom_fields;
