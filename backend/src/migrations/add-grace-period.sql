-- ============================================================
-- GRACE PERIOD IMPLEMENTATION - DATABASE MIGRATION
-- ============================================================
-- Purpose: Add 10-day grace period functionality after subscription expiration
-- Date: 2026-03-30
-- ============================================================

-- Add grace period columns to companies table
ALTER TABLE companies
ADD COLUMN grace_period_ends_at DATETIME NULL
  COMMENT 'End date of 10-day grace period after subscription expires'
  AFTER subscription_ends_at,
ADD COLUMN grace_period_day INT DEFAULT 0
  COMMENT 'Current day in grace period (0-10, 0 = not in grace period)'
  AFTER grace_period_ends_at;

-- Add index for efficient grace period queries
CREATE INDEX idx_grace_period_ends_at ON companies(grace_period_ends_at);

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE companies DROP COLUMN grace_period_ends_at;
-- ALTER TABLE companies DROP COLUMN grace_period_day;
-- DROP INDEX idx_grace_period_ends_at ON companies;
