-- ======================================================
-- Migration: add-companies-landing-page.sql
-- Purpose:   Records which landing page a Razorpay trial signup came
--            from. The industry pages (currently /jewellery) pass a
--            tag through the order notes; the main landing page sends
--            none and stays NULL, shown as "Main page" in the
--            superadmin. Kept separate from registration_source, which
--            says how the account was created (web / razorpay), not
--            where the visitor landed.
-- Date:      2026-09-29
-- ======================================================

ALTER TABLE companies
  ADD COLUMN landing_page VARCHAR(40) NULL DEFAULT NULL
    COMMENT 'Landing page of a trial signup, e.g. "jewellery"; NULL = main page'
    AFTER registration_source;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE companies DROP COLUMN landing_page;
-- ------------------------------------------------------
