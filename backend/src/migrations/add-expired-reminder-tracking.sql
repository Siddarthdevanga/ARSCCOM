-- ============================================================
-- EXPIRED-ACCOUNT MONTHLY REMINDER TRACKING
-- ============================================================
-- Purpose: Track the last time a fully-suspended (subscription_status =
-- 'expired') company was sent a renewal reminder, so the grace period
-- cron can send one email per month instead of never (or, before the
-- related bug fix, daily forever).
-- Date: 2026-07-28
-- ============================================================

ALTER TABLE companies
ADD COLUMN expired_reminder_last_sent_at DATETIME NULL
  COMMENT 'Last time a monthly renewal reminder was sent while subscription_status = expired'
  AFTER grace_period_day;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE companies DROP COLUMN expired_reminder_last_sent_at;
