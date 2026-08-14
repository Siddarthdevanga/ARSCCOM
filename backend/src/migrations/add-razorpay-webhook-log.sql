-- ============================================================
-- RAZORPAY WEBHOOK LOG
-- ============================================================
-- Purpose: every payment.captured delivery gets a row here —
-- whatever name/email/phone was extracted from the payload, what
-- happened (created / resent / unmatched / ignored), and the raw
-- payload for debugging. Written regardless of outcome, so a
-- "duplicate payment matched an existing account" case is visible
-- here without having to SSH in and grep PM2 logs.
-- Date: 2026-08-14
-- ============================================================

CREATE TABLE razorpay_webhook_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(64) NULL,
  payment_id VARCHAR(64) NULL,
  name VARCHAR(150) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(10) NULL,
  status VARCHAR(32) NOT NULL COMMENT 'created | resent | unmatched | ignored | missing_fields | duplicate_delivery',
  company_id INT NULL,
  raw_payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- DROP TABLE IF EXISTS razorpay_webhook_log;
