-- ============================================================
-- BILLING INTERVAL (MONTHLY / ANNUAL) FOR THE BUSINESS PLAN
-- ============================================================
-- Purpose: support an annual Business plan alongside the existing
-- monthly one. billing_interval tracks the interval of a company's
-- CURRENT active plan (only meaningful when plan = 'business').
-- pending_billing_interval mirrors the existing pending_upgrade_plan
-- pattern — the interval of an unpaid pending upgrade/renewal, read
-- by the Zoho webhook on activation and cleared alongside
-- pending_upgrade_plan once payment is confirmed.
-- Date: 2026-08-11
-- ============================================================

ALTER TABLE companies
  ADD COLUMN billing_interval ENUM('monthly','annual') NOT NULL DEFAULT 'monthly'
    COMMENT 'Interval of the current active plan; only meaningful when plan = business'
    AFTER plan,
  ADD COLUMN pending_billing_interval ENUM('monthly','annual') NULL
    COMMENT 'Interval of an unpaid pending upgrade/renewal, mirrors pending_upgrade_plan'
    AFTER pending_upgrade_plan;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE companies DROP COLUMN billing_interval, DROP COLUMN pending_billing_interval;
