-- ======================================================
-- Migration: add-companies-charge-reminder-sent.sql
-- Purpose:   Tracks whether the "you'll be charged in 3 days" pre-debit
--            WhatsApp/email reminder has already gone out for the CURRENT
--            billing cycle. Reset to 0 every time a subscription activates/
--            renews (subscription.activated or subscription.charged), so
--            it naturally fires once per cycle rather than needing a CSV
--            of already-sent dates like wa_reminders_sent uses.
-- Date:      2026-08-25
-- ======================================================

ALTER TABLE companies
  ADD COLUMN razorpay_charge_reminder_sent TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 once the pre-charge reminder has been sent for the current billing cycle'
    AFTER razorpay_subscription_id;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE companies DROP COLUMN razorpay_charge_reminder_sent;
-- ------------------------------------------------------
