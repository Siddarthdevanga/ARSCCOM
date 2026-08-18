-- ======================================================
-- Migration: add-superadmin-readonly-role.sql
-- Purpose:   Adds a restricted sub-admin role, scoped to viewing the
--            Landing Page Conversions tab only (read-only — no other
--            superadmin routes, no write actions). Enforced server-side
--            by requireFullSuperAdmin on every other route, and by the
--            frontend hiding all other UI when it sees this role.
-- Date:      2026-08-18
-- ======================================================

ALTER TABLE users
  MODIFY COLUMN role ENUM('user','superadmin','superadmin_readonly') NOT NULL DEFAULT 'user';

-- ------------------------------------------------------
-- Rollback (only safe once no superadmin_readonly rows exist):
-- ALTER TABLE users MODIFY COLUMN role ENUM('user','superadmin') NOT NULL DEFAULT 'user';
-- ------------------------------------------------------
