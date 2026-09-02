-- ======================================================
-- Migration: add-companies-mandate-nudge-sent.sql
-- Purpose:   Tracks which "add auto-pay" nudge emails have gone out to a
--            trial-plan company that has NO Razorpay mandate on file yet
--            (signed up under the old one-time-Order flow, before the
--            auto-convert-to-Business subscription flow existed). CSV of
--            stage names sent so far: pre_expiry, grace_start, grace_final.
-- Date:      2026-09-02
-- ======================================================

ALTER TABLE companies
  ADD COLUMN mandate_nudge_sent VARCHAR(64) NOT NULL DEFAULT ''
    COMMENT 'CSV of add-auto-pay nudge stages already emailed: pre_expiry, grace_start, grace_final'
    AFTER razorpay_charge_reminder_sent;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE companies DROP COLUMN mandate_nudge_sent;
-- ------------------------------------------------------
