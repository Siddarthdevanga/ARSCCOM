-- ============================================================
-- CUSTOMIZABLE VISITOR REGISTRATION FIELDS - DATABASE MIGRATION
-- ============================================================
-- Purpose: Let each company toggle which visitor-registration fields
--          (beyond the always-required Name / WhatsApp Number / Photo)
--          are collected, on both the public registration form and the
--          admin "add visitor" flow.
-- Date: 2026-07-28
-- ============================================================

ALTER TABLE companies
ADD COLUMN visitor_form_fields JSON NULL
  COMMENT 'Per-company toggle state for optional visitor registration fields. NULL = all fields enabled (default).'
  AFTER whatsapp_url;

-- ============================================================
-- IMPORTANT — check this before you rely on the email toggle
-- ============================================================
-- Email can now be turned off per company, so the app will start
-- inserting NULL into visitors.email for any company that disables it.
-- First check whether that column currently allows NULL:
--
--   SHOW COLUMNS FROM visitors LIKE 'email';
--
-- If "Null" comes back as "NO", relax it — match the VARCHAR length
-- shown by the command above (don't just copy 255 blindly):
--
--   ALTER TABLE visitors MODIFY COLUMN email VARCHAR(255) NULL;
--
-- If it already allows NULL, no action needed.

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE companies DROP COLUMN visitor_form_fields;
