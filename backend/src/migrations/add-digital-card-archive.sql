-- ============================================================
-- DIGITAL CARD ARCHIVE
-- ============================================================
-- Purpose: an admin can delete any digital card. The card row goes, and
-- with it its public address (the printed QR stops working), its scans
-- and its leads (ON DELETE CASCADE), and the plan slot is freed. Only the
-- details that were filled in are kept, here, as a record. Nothing in the
-- app reads this table back; it is not shown on the Digital Cards page.
--
-- An empty card (nothing filled in) is deleted without a record.
--
-- Date: 2026-09-30
-- ============================================================

CREATE TABLE IF NOT EXISTS digital_card_archive (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  company_id       INT NOT NULL,
  card_id          INT NOT NULL COMMENT 'digital_cards.id before it was deleted; that row no longer exists',
  source           VARCHAR(16) NULL,
  serial_no        INT NULL COMMENT 'The card number (#N) for a company QR card',

  name             VARCHAR(120) NULL,
  phone            VARCHAR(20)  NULL,
  email            VARCHAR(190) NULL,
  details          JSON NOT NULL COMMENT 'Every filled-in field of the card, as it was',

  card_created_at  TIMESTAMP NULL,
  claimed_at       DATETIME NULL,
  deleted_by       INT NULL COMMENT 'users.id of the admin who deleted it',
  deleted_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_card_archive_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,

  INDEX idx_card_archive_company (company_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback:
-- DROP TABLE IF EXISTS digital_card_archive;
