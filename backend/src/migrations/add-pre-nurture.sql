-- Pre-nurture columns for re-engagement of no-action leads
-- (leads who messaged bot but never booked a demo)
--
-- pre_nurture_step : 0=not started, 1=msg1 sent, 2=msg2 sent, 3=msg3 sent (sequence complete)
-- last_pre_nurture_sent_at : timestamp of last pre-nurture message sent

ALTER TABLE whatsapp_leads
  ADD COLUMN pre_nurture_step TINYINT(1) NOT NULL DEFAULT 0
    AFTER nurture_step,
  ADD COLUMN last_pre_nurture_sent_at DATETIME NULL
    AFTER last_nurture_sent_at;
