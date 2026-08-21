-- ======================================================
-- Migration: add-companies-onboarding-nurture.sql
-- Purpose:   Tracks which post-signup onboarding WhatsApp messages
--            (day 1 video walkthrough, day 5 WhatsApp community,
--            day 7 testimonial, day 10 CRM export, day 12 upgrade
--            nudge) have already been sent for a trial company —
--            separate from wa_reminders_sent, which tracks the
--            existing days-before-expiry reminders and uses
--            overlapping day numbers with a different meaning.
-- Date:      2026-08-18
-- ======================================================

ALTER TABLE companies
  ADD COLUMN onboarding_nurture_sent VARCHAR(50) NOT NULL DEFAULT ''
    COMMENT 'CSV of onboarding-drip day numbers already sent, e.g. "1,5,7"'
    AFTER wa_reminders_sent;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE companies DROP COLUMN onboarding_nurture_sent;
-- ------------------------------------------------------
