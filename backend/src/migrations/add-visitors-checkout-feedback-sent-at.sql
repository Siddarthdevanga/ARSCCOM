-- ======================================================
-- Migration: add-visitors-checkout-feedback-sent-at.sql
-- Purpose:   Adds a timestamp for when the checkout+feedback message was
--            sent, used to bound which visit a WhatsApp reply gets applied
--            to. Without this, a reply could be misattributed to any old
--            visit still sitting in a "message sent, no feedback yet"
--            state for that phone — exactly what happened with the ~22
--            backlog rows from the mass-send incident (fixed separately
--            in checkoutFeedbackCron.js), where a real reply to today's
--            visit got absorbed by a stale visit from days earlier.
--
--            Existing rows with checkout_feedback_sent=1 are backfilled
--            with check_in as their sent time — an approximation, but
--            since those are all several days old already, it correctly
--            pushes them outside any reasonable future matching window
--            (see WHATSAPP_REPLY_WINDOW_HOURS in whatsapp.routes.js),
--            so they can no longer absorb a new reply by mistake.
-- Date:      2026-08-25
-- ======================================================

ALTER TABLE visitors
  ADD COLUMN checkout_feedback_sent_at DATETIME NULL
    COMMENT 'When the checkout+feedback WhatsApp message was sent — bounds which visit a reply can apply to'
    AFTER checkout_feedback_sent;

UPDATE visitors
SET checkout_feedback_sent_at = check_in
WHERE checkout_feedback_sent = 1
  AND checkout_feedback_sent_at IS NULL;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE visitors DROP COLUMN checkout_feedback_sent_at;
-- ------------------------------------------------------
