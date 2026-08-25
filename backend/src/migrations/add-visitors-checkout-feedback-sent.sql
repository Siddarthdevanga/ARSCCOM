-- ======================================================
-- Migration: add-visitors-checkout-feedback-sent.sql
-- Purpose:   Tracks whether the combined checkout+feedback WhatsApp
--            message (sent 60 minutes after check-in) has already gone
--            out for a visitor, so the cron never sends it twice.
-- Date:      2026-08-21
-- ======================================================

ALTER TABLE visitors
  ADD COLUMN checkout_feedback_sent TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 once the 60-minute checkout+feedback WhatsApp message has been sent'
    AFTER feedback_rating;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE visitors DROP COLUMN checkout_feedback_sent;
-- ------------------------------------------------------
