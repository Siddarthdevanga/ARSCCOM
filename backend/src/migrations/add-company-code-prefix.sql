-- ============================================================
-- COMPANY-DERIVED VISITOR CODE PREFIX
-- ============================================================
-- Purpose: replace the generic "CMP" prefix on visitor codes with a
-- 3-letter abbreviation derived from the company's name at
-- registration time (e.g. "Zodopt" -> "ZOD", "Good Business Lab" ->
-- "GBL"), editable later by the company in Settings.
--
-- The company's numeric id is still embedded in every visitor code
-- (PREFIX + companyId + date + count), so two companies landing on
-- the same 3-letter prefix is not a collision — the full code stays
-- globally unique regardless.
--
-- Existing companies get their prefix backfilled by a one-time script
-- (see backend/src/scripts/backfillCodePrefix.js) — this migration
-- only adds the column.
-- Date: 2026-08-12
-- ============================================================

ALTER TABLE companies
  ADD COLUMN code_prefix VARCHAR(3) NULL
    COMMENT '3-letter, all-caps abbreviation derived from company name, used as the visitor-code prefix; editable in Settings'
    AFTER slug;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE companies DROP COLUMN code_prefix;
