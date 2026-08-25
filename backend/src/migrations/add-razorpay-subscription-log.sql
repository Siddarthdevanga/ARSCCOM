-- ======================================================
-- Migration: add-razorpay-subscription-log.sql
-- Purpose:   One row per Razorpay subscription webhook delivery (activated/
--            charged/halted/cancelled), mirroring the razorpay_webhook_log
--            pattern already used for the one-time trial Orders flow — lets
--            you check what was received without SSHing in to grep logs.
-- Date:      2026-08-25
-- ======================================================

CREATE TABLE razorpay_subscription_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  event           VARCHAR(64) NOT NULL,
  subscription_id VARCHAR(64) NULL,
  company_id      INT NULL,
  status          VARCHAR(32) NOT NULL,
  raw_payload     JSON NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_subscription_id (subscription_id)
);

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- DROP TABLE razorpay_subscription_log;
-- ------------------------------------------------------
