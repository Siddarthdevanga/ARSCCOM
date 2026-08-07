-- ============================================================
-- CUSTOM PURPOSE OF VISIT — CATEGORIES & SUB-CATEGORIES
-- ============================================================
-- Purpose: let each company optionally define their own Purpose of
-- Visit categories (e.g. "Classes & Learning") and sub-purposes under
-- each (e.g. "Pottery Course"). A company with zero categories keeps
-- the existing free-text Purpose field untouched.
--
-- purpose_category/purpose_subcategory on visitors are plain-text
-- SNAPSHOTS of what was selected at check-in time — not live foreign
-- keys — so renaming or deleting a category later never changes what
-- historical visitor records show.
-- Date: 2026-08-07
-- ============================================================

CREATE TABLE company_purpose_categories (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_purpose_categories_company (company_id),
  CONSTRAINT fk_purpose_categories_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE company_purpose_subcategories (
  id INT NOT NULL AUTO_INCREMENT,
  category_id INT NOT NULL,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_purpose_subcategories_category (category_id),
  KEY idx_company_purpose_subcategories_company (company_id),
  CONSTRAINT fk_purpose_subcategories_category
    FOREIGN KEY (category_id) REFERENCES company_purpose_categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_purpose_subcategories_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

ALTER TABLE visitors
  ADD COLUMN purpose_category VARCHAR(255) NULL
    COMMENT 'Snapshot of the selected category name at check-in time, not a live FK'
    AFTER purpose,
  ADD COLUMN purpose_subcategory VARCHAR(255) NULL
    COMMENT 'Snapshot of the selected sub-purpose name at check-in time, not a live FK'
    AFTER purpose_category;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE visitors DROP COLUMN purpose_category, DROP COLUMN purpose_subcategory;
-- DROP TABLE company_purpose_subcategories;
-- DROP TABLE company_purpose_categories;
